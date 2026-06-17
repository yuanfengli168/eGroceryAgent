/**
 * Pure parser for RedMart product cards from rendered HTML.
 * Extracted so it can be unit-tested without Playwright.
 *
 * Input: HTML string containing [data-tracking="product-card"] elements.
 * Output: array of normalized product data.
 */

export interface RawProduct {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly url: string;
}

const ITEM_ID_REGEX = /data-item-id="(\d+)"/;
const HREF_REGEX = /<a[^>]*href="(\/\/www\.lazada\.sg\/products\/pdp-i(\d+)\.html)"/;
const TITLE_REGEX = /<a[^>]*title="([^"]+)"/;
const PRICE_REGEX = /<span class="ooOxS">\$?([\d,]+(?:\.\d+)?)<\/span>/;

/** Parse a RedMart search page HTML and extract product cards. */
export function parseProductCards(html: string): RawProduct[] {
  const results: RawProduct[] = [];
  // Find each product card opening tag, then look for the next one or end of body
  const cardStartRegex = /<div[^>]*data-tracking="product-card"[^>]*data-item-id="(\d+)"[^>]*>/g;
  const positions: number[] = [];
  let match;
  while ((match = cardStartRegex.exec(html)) !== null) {
    positions.push(match.index);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const card = html.substring(start, end);

    const id = card.match(ITEM_ID_REGEX)?.[1];
    if (!id) continue;

    const hrefMatch = card.match(HREF_REGEX);
    const urlPath = hrefMatch?.[1] || `//www.lazada.sg/products/pdp-i${id}.html`;

    const titleMatch = card.match(TITLE_REGEX);
    const name = titleMatch?.[1]?.trim() || "";

    const priceMatch = card.match(PRICE_REGEX);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : 0;

    if (!name) continue;
    results.push({
      id,
      name,
      price,
      url: urlPath.startsWith("//") ? `https:${urlPath}` : urlPath,
    });
  }
  return results;
}
