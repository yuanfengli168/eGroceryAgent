/**
 * Patient probe: wait up to 30s for products to actually appear.
 * Capture all mtop / API calls to see what's happening.
 */
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-SG",
    timezoneId: "Asia/Singapore",
  });
  const page = await ctx.newPage();

  // Capture all mtop calls
  const mtopCalls: Array<{ url: string; status?: number; body?: string }> = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("mtop") || url.includes("acs-m.lazada") || url.includes("h5/mtop")) {
      try {
        const ct = resp.headers()["content-type"] ?? "";
        if (ct.includes("json") || ct.includes("text")) {
          const body = await resp.text();
          mtopCalls.push({ url, status: resp.status(), body: body.substring(0, 4000) });
        } else {
          mtopCalls.push({ url, status: resp.status() });
        }
      } catch (e) {
        mtopCalls.push({ url, status: resp.status() });
      }
    }
  });

  console.log("→ Navigating to RedMart search…");
  const start = Date.now();
  await page.goto("https://redmart.lazada.sg/search/?q=milk", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  console.log("Initial load took", Date.now() - start, "ms");

  // Wait for products to appear (longer timeout)
  let productCount = 0;
  try {
    await page.waitForSelector('[data-spm="product"]', { timeout: 30000 });
    productCount = await page.locator('[data-spm="product"]').count();
    console.log("✅ Products appeared:", productCount, "after", Date.now() - start, "ms");
  } catch {
    console.log("❌ No product cards after 30s");
  }

  // Print mtop calls
  console.log(`\n=== ${mtopCalls.length} mtop calls ===`);
  for (const call of mtopCalls) {
    console.log(`\n${call.status} ${call.url}`);
    if (call.body) {
      console.log("  Body:", call.body.substring(0, 400));
    }
  }

  // Also save final HTML
  const html = await page.content();
  const fs = await import("node:fs/promises");
  await fs.writeFile("/tmp/redmart_final.html", html);
  console.log("\nSaved final HTML to /tmp/redmart_final.html");
  console.log("Final HTML length:", html.length);
  console.log("Has rgv587?", html.includes("rgv587"));

  await browser.close();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
