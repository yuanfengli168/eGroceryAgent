/**
 * Tests for the pure RedMart HTML parser.
 * No network calls, no Playwright.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseProductCards } from "../../src/scrapers/redmart-parser.js";

const FIXTURE_PATH = join(__dirname, "..", "fixtures", "redmart-search-milk.html");

describe("RedMart HTML parser", () => {
  it("parses a real RedMart search page", () => {
    const html = readFileSync(FIXTURE_PATH, "utf-8");
    const products = parseProductCards(html);

    expect(products.length).toBeGreaterThan(0);
    // Each product should have an ID, name, price
    for (const p of products) {
      expect(p.id).toMatch(/^\d+$/);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.url).toContain("lazada.sg");
    }
  });

  it("returns at least 5 products from a real page", () => {
    const html = readFileSync(FIXTURE_PATH, "utf-8");
    const products = parseProductCards(html);
    expect(products.length).toBeGreaterThanOrEqual(5);
  });

  it("parses synthetic HTML correctly", () => {
    const html = `
      <html>
        <body>
          <div data-tracking="product-card" data-item-id="111111">
            <a href="//www.lazada.sg/products/pdp-i111111.html" title="Test Product 1">
              <span class="ooOxS">$10.50</span>
            </a>
          </div>
          <div data-tracking="product-card" data-item-id="222222">
            <a href="//www.lazada.sg/products/pdp-i222222.html" title="Test Product 2">
              <span class="ooOxS">$25.00</span>
            </a>
          </div>
        </body>
      </html>
    `;
    const products = parseProductCards(html);
    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({
      id: "111111",
      name: "Test Product 1",
      price: 10.50,
      url: "https://www.lazada.sg/products/pdp-i111111.html",
    });
    expect(products[1]).toEqual({
      id: "222222",
      name: "Test Product 2",
      price: 25.00,
      url: "https://www.lazada.sg/products/pdp-i222222.html",
    });
  });

  it("handles prices with commas", () => {
    const html = `
      <div data-tracking="product-card" data-item-id="999">
        <a href="//www.lazada.sg/products/pdp-i999.html" title="Expensive Item">
          <span class="ooOxS">$1,299.99</span>
        </a>
      </div>
    `;
    const products = parseProductCards(html);
    expect(products).toHaveLength(1);
    expect(products[0].price).toBe(1299.99);
  });

  it("returns empty array for HTML with no products", () => {
    const html = "<html><body><h1>No results</h1></body></html>";
    const products = parseProductCards(html);
    expect(products).toEqual([]);
  });

  it("skips cards with missing data", () => {
    const html = `
      <div data-tracking="product-card" data-item-id="">
        <a href="//www.lazada.sg/products/pdp-i.html" title="">
          <span class="ooOxS"></span>
        </a>
      </div>
    `;
    const products = parseProductCards(html);
    expect(products).toEqual([]);
  });
});
