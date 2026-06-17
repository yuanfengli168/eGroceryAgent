/**
 * RedMart scraper.
 *
 * Strategy:
 *   1. Use Playwright + stealth to load the RedMart search page
 *   2. Wait for [data-tracking="product-card"] elements to render
 *   3. Extract product info from data-* attributes (stable, not obfuscated)
 *   4. Cache results for 48h to avoid re-hitting RedMart
 *
 * Notes:
 *   - We use a HEADED browser by default. The headless mode often triggers
 *     Lazada's TMD anti-bot. With a real window open, the user can solve
 *     any CAPTCHA challenge that appears.
 *   - 15-minute minimum interval between calls to reduce TMD pressure.
 *   - On CAPTCHA detection, we wait longer before retrying.
 */

import { chromium, Browser, Page } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import type { Product, Scraper, SearchOptions } from "./types.js";
import { TtlCache } from "../cache/ttl.js";
import { parseProductCards } from "./redmart-parser.js";

chromium.use(stealth());

const REDMART_BASE = "https://redmart.lazada.sg";
const DEFAULT_LIMIT = 20;
const PRODUCT_CARD_SELECTOR = '[data-tracking="product-card"]';
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h
const MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const CAPTCHA_COOLDOWN_MS = 30 * 60 * 1000; // 30 min after CAPTCHA

export class CaptchaBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaBlockedError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

interface RedMartScraperOptions {
  /** Run in headed mode (show browser window). Default true to allow CAPTCHA solving. */
  headed?: boolean;
  /** Time to wait for products to render. Default 20000. */
  pageTimeoutMs?: number;
  /** Path to a persistent browser profile. Default undefined (fresh). */
  userDataDir?: string;
}

export class RedMartScraper implements Scraper {
  readonly platform = "redmart" as const;

  private readonly cache = new TtlCache<readonly Product[]>(CACHE_TTL_MS);
  private lastRequestAt = 0;
  private captchaDetected = false;
  private captchaDetectedAt = 0;
  private readonly headed: boolean;
  private readonly pageTimeoutMs: number;
  private readonly userDataDir: string | undefined;
  private browser: Browser | null = null;

  constructor(options: RedMartScraperOptions = {}) {
    this.headed = options.headed ?? true; // Default headed for CAPTCHA
    this.pageTimeoutMs = options.pageTimeoutMs ?? 20000;
    this.userDataDir = options.userDataDir;
  }

  /**
   * Search for products on RedMart.
   * Throws CaptchaBlockedError if TMD is active and we need user intervention.
   */
  async search(query: string, options?: SearchOptions): Promise<readonly Product[]> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const cacheKey = `search:${query}:${limit}`;

    // 1. Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Check throttling
    const now = Date.now();
    if (this.captchaDetected && now - this.captchaDetectedAt < CAPTCHA_COOLDOWN_MS) {
      throw new CaptchaBlockedError(
        `CAPTCHA detected recently. Wait ${Math.round((CAPTCHA_COOLDOWN_MS - (now - this.captchaDetectedAt)) / 60000)} min before retry.`
      );
    }
    if (this.lastRequestAt > 0 && now - this.lastRequestAt < MIN_INTERVAL_MS) {
      const waitSec = Math.round((MIN_INTERVAL_MS - (now - this.lastRequestAt)) / 1000);
      throw new RateLimitError(`Throttled. Wait ${waitSec}s before next call.`);
    }

    // 3. Open browser if not already open
    await this.ensureBrowser();

    // 4. Navigate and extract
    const page = await this.browser!.newPage();
    const url = `${REDMART_BASE}/search/?q=${encodeURIComponent(query)}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Wait for products or CAPTCHA
      try {
        await page.waitForSelector(PRODUCT_CARD_SELECTOR, { timeout: this.pageTimeoutMs });
      } catch {
        // Check for CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
          return !!document.querySelector('.J_MIDDLEWARE_FRAME_WIDGET, [class*="tmd"], iframe[src*="captcha"]');
        });
        if (hasCaptcha) {
          this.captchaDetected = true;
          this.captchaDetectedAt = Date.now();
          throw new CaptchaBlockedError(
            "TMD CAPTCHA detected. Solve the CAPTCHA in the browser window, then retry."
          );
        }
        // No products and no captcha - empty result
        this.lastRequestAt = Date.now();
        this.cache.set(cacheKey, []);
        return [];
      }

      // Extract HTML and parse with our pure parser
      const html = await page.content();
      const raw = parseProductCards(html);

      // Map to Product
      const result: Product[] = raw.slice(0, limit).map((p) => ({
        id: p.id,
        slug: `pdp-i${p.id}.html`,
        name: p.name,
        brand: null, // RedMart doesn't expose brand in card view
        price: p.price,
        packSize: null,
        url: p.url,
        platform: "redmart" as const,
      }));

      this.lastRequestAt = Date.now();
      this.captchaDetected = false;
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * Get a single product by ID.
   * For RedMart, direct product page access is blocked by TMD CAPTCHA.
   * We use search to find the product instead. Returns null if not found.
   */
  async getProduct(slugOrId: string): Promise<Product | null> {
    // slugOrId might be a numeric ID like "3490850828" or a slug like "pdp-i3490850828.html"
    const id = slugOrId.replace(/^pdp-i/, "").replace(/\.html$/, "");
    if (!/^\d+$/.test(id)) return null;

    const cacheKey = `product:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached[0] || null;
    }

    // Direct product page access is blocked by TMD CAPTCHA.
    // We don't fetch the product page; return null and rely on search results
    // to identify products by ID.
    return null;
  }

  private async ensureBrowser(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      return;
    }
    this.browser = await chromium.launch({
      headless: !this.headed,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  /** Close the browser. Call this when done. */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
