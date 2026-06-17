/**
 * FairPrice.com.sg scraper.
 *
 * Strategy: parse the server-side-rendered Next.js __NEXT_DATA__ JSON
 * blob. The product list is fully embedded as structured data — no
 * headless browser needed.
 *
 * The product objects look like:
 *   {
 *     "name": "Fairprice Onwards Toilet Tissue Roll - 3 Ply",
 *     "slug": "fairprice-onwards-...-13004987",
 *     "brand": { "name": "Fairprice", "slug": "fairprice", ... },
 *     "final_price": 18.82,
 *     "offers": [ { "price": 17.5, "description": "Buy 1 ... @ $17.50", ... } ]
 *   }
 *
 * Price resolution: prefer offers[0].price (the price you'll actually pay)
 * over final_price (the listed/MSRP price).
 *
 * Product URL: https://www.fairprice.com.sg/product/<slug>
 */

import type { HttpClient } from "../http/client.js";
import type { Product, Scraper, SearchOptions } from "./types.js";

const BASE_URL = "https://www.fairprice.com.sg";
const DEFAULT_LIMIT = 20;
const NEXT_DATA_RE = /<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]+?)<\/script>/i;

export class FairPriceScraper implements Scraper {
  readonly platform = "fairprice" as const;

  constructor(private readonly http: HttpClient) {}

  async search(query: string, options: SearchOptions = {}): Promise<readonly Product[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const limit = options.limit ?? DEFAULT_LIMIT;
    const url = `${BASE_URL}/search?query=${encodeURIComponent(trimmed)}`;
    const response = await this.http.get(url);
    return parseProductList(response.body, limit);
  }

  async getProduct(slugOrId: string): Promise<Product | null> {
    const slug = normalizeSlug(slugOrId);
    if (slug.length === 0) {
      return null;
    }
    const url = `${BASE_URL}/product/${slug}`;
    const response = await this.http.get(url);
    return parseProductPage(response.body);
  }
}

/* ------------------------------------------------------------------ */
/*  Public parsing functions (exported for testing)                   */
/* ------------------------------------------------------------------ */

/**
 * Extract the embedded product list from a search results page.
 *
 * Tries the canonical __NEXT_DATA__ path first, then falls back to
 * scanning any inline <script> blocks for product-shaped JSON arrays.
 * (Older test fixtures and some pages put the data in a plain script tag.)
 */
export function parseProductList(html: string, limit: number): readonly Product[] {
  const products: Product[] = [];
  const seen = new Set<string>();

  for (const data of extractProductsFromHtml(html)) {
    const product = toProduct(data);
    if (product && !seen.has(product.id)) {
      seen.add(product.id);
      products.push(product);
    }
  }

  // Stable order: by id (ascending) — deterministic, easy to reason about.
  products.sort((a, b) => a.id.localeCompare(b.id));

  return products.slice(0, Math.max(0, limit));
}

/** Parse a single product page. Returns the first product-shaped object found. */
export function parseProductPage(html: string): Product | null {
  const blob = extractNextData(html);
  if (!blob) return null;

  // For a product detail page, the main product lives in the
  // ProductDetail layout (`page.layouts[0].value`). Walk that path first.
  const detail = findProductDetailLayout(blob);
  if (detail) {
    const product = toProduct(detail);
    if (product) return product;
  }

  // Fall back to the generic "find any product in the blob" approach.
  for (const data of extractProductsFromHtml(html)) {
    const product = toProduct(data);
    if (product) return product;
  }
  return null;
}

/** Locate the value of the first "ProductDetail" layout, if present. */
function findProductDetailLayout(blob: any): any | null {
  const layouts =
    blob?.props?.pageProps?.product?.data?.page?.layouts ??
    blob?.props?.pageProps?.data?.data?.page?.layouts;
  if (!Array.isArray(layouts)) return null;
  for (const layout of layouts) {
    if (layout?.name === "ProductDetail" && layout?.value) {
      return layout.value;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Internals                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse the __NEXT_DATA__ JSON blob from the page and walk it to find
 * every product-shaped object.
 */
function* extractProductsFromHtml(html: string): IterableIterator<any> {
  // 1. Canonical __NEXT_DATA__ path.
  const blob = extractNextData(html);
  if (blob) {
    yield* findProducts(blob);
  }

  // 2. Inline <script> blocks — older pages and test fixtures put the
  //    product data here. We try to JSON.parse each script's body and
  //    yield any product-shaped objects we find.
  for (const data of extractProductsFromScriptTags(html)) {
    yield* findProducts(data);
  }
}

/**
 * Extract every JSON object/array from inline <script> tags.
 * Skips __NEXT_DATA__ (already handled) and external src= scripts.
 */
function* extractProductsFromScriptTags(html: string): IterableIterator<any> {
  const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const body = m[1]?.trim();
    if (!body || body.includes("__NEXT_DATA__")) continue;
    // Strip a leading "var <name> =" or "const <name> =" if present.
    const stripped = body
      .replace(/^(?:var|let|const)\s+\w+\s*=\s*/, "")
      .replace(/;?\s*$/, "");
    let data: any;
    try {
      data = JSON.parse(stripped);
    } catch {
      continue;
    }
    if (data) yield data;
  }
}

/** Extract the __NEXT_DATA__ JSON blob from the page HTML. */
function extractNextData(html: string): any {
  const m = NEXT_DATA_RE.exec(html);
  if (!m || !m[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * Walk any nested structure and yield every object that looks like a
 * FairPrice product: a `slug` matching the product URL pattern, a
 * non-empty `name`, and at least one of `final_price` or `offers`.
 */
function* findProducts(root: unknown): IterableIterator<any> {
  if (!root || typeof root !== "object") return;

  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (looksLikeProduct(node)) {
      yield node;
      // Don't recurse into a product's children — they're not products.
      continue;
    }
    for (const k of Object.keys(node)) {
      stack.push((node as Record<string, unknown>)[k]);
    }
  }
}

/** Heuristic: is this object a product? */
function looksLikeProduct(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.length < 3) return false;
  if (typeof o.slug !== "string") return false;
  if (!/-\d{6,}$/.test(o.slug)) return false;
  // Must have at least one of final_price or offers[0].price.
  const hasFinalPrice = typeof o.final_price === "number";
  const hasOfferPrice =
    Array.isArray(o.offers) &&
    o.offers.length > 0 &&
    o.offers[0] &&
    typeof o.offers[0].price === "number";
  return hasFinalPrice || hasOfferPrice;
}

/** Convert a parsed product object to our Product type. */
function toProduct(data: any): Product | null {
  if (!data || typeof data !== "object") return null;

  const rawName = typeof data.name === "string" ? data.name : "";
  const name = cleanName(rawName);
  if (name.length < 3) return null;

  const slug = typeof data.slug === "string" ? data.slug : null;
  if (!slug) return null;

  const productId = extractProductId(slug);
  if (!productId) return null;

  // Brand is optional.
  const brand =
    data.brand && typeof data.brand === "object" && typeof data.brand.name === "string"
      ? data.brand.name
      : null;

  // Price: prefer offers[0].price, else final_price.
  let price: number | null = null;
  if (Array.isArray(data.offers) && data.offers.length > 0) {
    const first = data.offers[0];
    if (first && typeof first === "object" && typeof first.price === "number") {
      price = first.price;
    }
  }
  if (price === null && typeof data.final_price === "number") {
    price = data.final_price;
  }
  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  return {
    id: productId,
    slug,
    name,
    brand,
    price,
    packSize: extractPackSize(name) ?? extractDisplayUnit(data),
    url: `${BASE_URL}/product/${slug}`,
    platform: "fairprice",
  };
}

/** Read the DisplayUnit field from a parsed product object, if present. */
function extractDisplayUnit(data: any): string | null {
  const v = data?.DisplayUnit;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (exported for testing)                                */
/* ------------------------------------------------------------------ */

/** Extract the product ID (numeric suffix) from a FairPrice slug. */
export function extractProductId(slug: string): string | null {
  const m = /-(\d{6,})$/.exec(slug);
  return m?.[1] ?? null;
}

/**
 * Pull out a "X x Y per pack" or "X per pack" hint from a product name.
 * Best-effort — returns null if nothing matches.
 */
export function extractPackSize(name: string): string | null {
  const patterns: readonly RegExp[] = [
    /\b(\d+\s*x\s*\d+(?:\s*(?:per\s*pack|per\s*roll|per\s*bottle|sheets?))?)/i,
    /\b(\d+\s*(?:per\s*pack|per\s*roll|per\s*bottle|sheets?))/i,
    /\((\d+(?:\.\d+)?\s*(?:kg|g|ml|l|pcs?))\)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(name);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/** Clean up a product name: trim, normalize whitespace, unescape quotes. */
export function cleanName(name: string): string {
  return name
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a user-supplied slug or product ID into a valid FairPrice slug. */
export function normalizeSlug(slugOrId: string): string {
  return slugOrId
    .trim()
    .replace(/^https?:\/\/[^/]+\/product\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}
