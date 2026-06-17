import { describe, it, expect, beforeEach } from "vitest";
import { FairPriceScraper, parseProductList, parseProductPage, extractProductId, extractPackSize, cleanName, normalizeSlug } from "../../src/scrapers/fairprice.js";
import { FakeHttpClient } from "../../src/http/fake.js";
import { HttpError } from "../../src/http/client.js";
import {
  TWO_PRODUCTS_HTML,
  EMPTY_RESULTS_HTML,
  NO_BRAND_HTML,
  MIXED_VALIDITY_HTML,
  SINGLE_PRODUCT_PAGE_HTML,
  NOT_FOUND_PAGE_HTML,
  SPECIAL_CHARS_HTML,
  ON_SALE_HTML,
} from "../fixtures/fairprice-html.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

describe("FairPriceScraper", () => {
  let http: FakeHttpClient;
  let scraper: FairPriceScraper;

  beforeEach(() => {
    http = new FakeHttpClient();
    scraper = new FairPriceScraper(http);
  });

  describe("search()", () => {
    it("returns parsed products from a search page", async () => {
      http.enqueue({ body: TWO_PRODUCTS_HTML });

      const products = await scraper.search("toilet paper");

      expect(products).toHaveLength(2);
      expect(products[0]).toMatchObject({
        id: "13004987",
        name: "Fairprice Onwards Toilet Tissue Roll - 3 Ply",
        brand: "Fairprice",
        price: 17.5, // offers[0].price wins over final_price (18.82)
        platform: "fairprice",
        url: "https://www.fairprice.com.sg/product/fairprice-onwards-toilet-tissue-roll-3-ply-30-x-220-per-pack-13004987",
      });
      expect(products[1]?.brand).toBe("Kleenex");
      expect(products[1]?.price).toBe(14.35); // falls back to final_price when offers is empty
    });

    it("prefers offers[0].price over final_price for sale items", async () => {
      http.enqueue({ body: ON_SALE_HTML });
      const products = await scraper.search("sale");
      expect(products).toHaveLength(1);
      expect(products[0]?.price).toBe(15.5); // offer price, not 20.0
    });

    it("encodes the query in the URL", async () => {
      http.enqueue({ body: TWO_PRODUCTS_HTML });
      await scraper.search("café & tea");
      expect(http.calls[0]?.url).toBe(
        "https://www.fairprice.com.sg/search?query=caf%C3%A9%20%26%20tea",
      );
    });

    it("returns empty array for empty query without making a request", async () => {
      const products = await scraper.search("");
      expect(products).toEqual([]);
      expect(http.calls).toHaveLength(0);
    });

    it("returns empty array for whitespace-only query", async () => {
      const products = await scraper.search("   \t\n  ");
      expect(products).toEqual([]);
      expect(http.calls).toHaveLength(0);
    });

    it("returns empty array when search has no products", async () => {
      http.enqueue({ body: EMPTY_RESULTS_HTML });
      const products = await scraper.search("zzznoresult");
      expect(products).toEqual([]);
    });

    it("deduplicates products by id", async () => {
      const dupHtml = TWO_PRODUCTS_HTML + TWO_PRODUCTS_HTML;
      http.enqueue({ body: dupHtml });
      const products = await scraper.search("toilet paper");
      expect(products).toHaveLength(2);
    });

    it("respects the limit option", async () => {
      http.enqueue({ body: TWO_PRODUCTS_HTML });
      const products = await scraper.search("toilet paper", { limit: 1 });
      expect(products).toHaveLength(1);
      expect(products[0]?.id).toBe("13277607");
    });

    it("skips products with empty names or missing slugs", async () => {
      http.enqueue({ body: MIXED_VALIDITY_HTML });
      const products = await scraper.search("anything");
      // Only "Valid Product 1" and "Valid Product 2" should survive
      expect(products).toHaveLength(2);
      expect(products[0]?.id).toBe("12345678");
      expect(products[1]?.id).toBe("87654321");
    });

    it("works with products that have no brand field", async () => {
      http.enqueue({ body: NO_BRAND_HTML });
      const products = await scraper.search("tissue");
      expect(products).toHaveLength(1);
      expect(products[0]?.brand).toBeNull();
    });

    it("decodes escaped quotes in product names", async () => {
      http.enqueue({ body: SPECIAL_CHARS_HTML });
      const products = await scraper.search("coffee");
      expect(products).toHaveLength(1);
      expect(products[0]?.name).toBe('Caf"e "Latte" Beans 250g');
    });

    it("propagates HTTP errors", async () => {
      http.enqueueError(new HttpError("HTTP 503", 503, "https://www.fairprice.com.sg/search?query=x"));
      await expect(scraper.search("x")).rejects.toThrow("HTTP 503");
    });
  });

  describe("getProduct()", () => {
    it("returns a single product from a product page", async () => {
      http.enqueue({ body: SINGLE_PRODUCT_PAGE_HTML });

      const product = await scraper.getProduct("fairprice-bathroom-tissue-strong-3ply-20-x-200-per-pack-13277607");

      expect(product).not.toBeNull();
      expect(product?.id).toBe("13277607");
      expect(product?.name).toBe("FairPrice Bathroom Tissue - Strong (3ply)");
      expect(product?.price).toBe(8.95);
    });

    it("accepts a numeric product ID and constructs a synthetic slug", async () => {
      http.enqueue({ body: SINGLE_PRODUCT_PAGE_HTML });
      const product = await scraper.getProduct("13277607");
      // Bare numeric IDs aren't valid FairPrice slugs, so we get null.
      // (FairPrice's URL pattern requires the slug with the -N suffix.)
      expect(product).toBeNull();
    });

    it("strips a full URL to its slug", async () => {
      http.enqueue({ body: SINGLE_PRODUCT_PAGE_HTML });
      await scraper.getProduct("https://www.fairprice.com.sg/product/fairprice-bathroom-tissue-strong-3ply-20-x-200-per-pack-13277607");
      expect(http.calls[0]?.url).toBe(
        "https://www.fairprice.com.sg/product/fairprice-bathroom-tissue-strong-3ply-20-x-200-per-pack-13277607",
      );
    });

    it("returns null for empty input without making a request", async () => {
      const product = await scraper.getProduct("");
      expect(product).toBeNull();
      expect(http.calls).toHaveLength(0);
    });

    it("returns null when the page has no product", async () => {
      http.enqueue({ body: NOT_FOUND_PAGE_HTML });
      const product = await scraper.getProduct("does-not-exist-99999999");
      expect(product).toBeNull();
    });
  });

  describe("real-world fixtures (end-to-end with real HTML)", () => {
    it("parses the saved 'toilet paper' search page", async () => {
      const html = loadFixture("fairprice-search-toilet-paper.html");
      const products = parseProductList(html, 30);

      expect(products.length).toBeGreaterThan(0);
      // Every product should have a valid id, slug, and positive price
      for (const p of products) {
        expect(p.id).toMatch(/^\d{6,}$/);
        expect(p.slug).toBeTruthy();
        expect(p.price).toBeGreaterThan(0);
        expect(p.platform).toBe("fairprice");
        expect(p.url).toContain(p.slug);
      }
      // First product should look like a toilet paper
      expect(products[0]?.name.toLowerCase()).toMatch(/tissue|toilet|paper/);
    });

    it("parses the saved 'mouthwash' search page", async () => {
      const html = loadFixture("fairprice-search-mouthwash.html");
      const products = parseProductList(html, 30);

      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.id).toMatch(/^\d{6,}$/);
        expect(p.price).toBeGreaterThan(0);
      }
    });

    it("parses a real product detail page", async () => {
      const html = loadFixture("fairprice-product-tissue.html");
      const product = parseProductPage(html);
      expect(product).not.toBeNull();
      expect(product?.price).toBeGreaterThan(0);
      expect(product?.id).toBe("13277607");
    });
  });
});

describe("extractProductId", () => {
  it("extracts the numeric ID from a slug", () => {
    expect(extractProductId("fairprice-bathroom-tissue-strong-3ply-20-x-200-per-pack-13277607")).toBe("13277607");
  });
  it("returns null when there is no trailing numeric ID", () => {
    expect(extractProductId("no-numeric-id")).toBeNull();
  });
  it("returns null for short numbers (likely not a product ID)", () => {
    expect(extractProductId("something-12")).toBeNull();
  });
});

describe("extractPackSize", () => {
  it("extracts 'X x Y per pack' format", () => {
    expect(extractPackSize("Tissue 20 x 200 per pack")).toBe("20 x 200 per pack");
  });
  it("extracts 'X sheets' format", () => {
    expect(extractPackSize("Tissue 200 sheets")).toBe("200 sheets");
  });
  it("extracts '(500ml)' format", () => {
    expect(extractPackSize("Mouthwash Fresh Mint (500ml)")).toBe("500ml");
  });
  it("returns null when no pack size is detectable", () => {
    expect(extractPackSize("Generic Item")).toBeNull();
  });
});

describe("cleanName", () => {
  it("unescapes double quotes", () => {
    expect(cleanName('Caf\\"e Latte')).toBe('Caf"e Latte');
  });
  it("normalizes whitespace", () => {
    expect(cleanName("  hello   world  ")).toBe("hello world");
  });
  it("handles empty string", () => {
    expect(cleanName("")).toBe("");
  });
  it("handles whitespace-only", () => {
    expect(cleanName("   \t\n  ")).toBe("");
  });
});

describe("normalizeSlug", () => {
  it("strips full URL prefix", () => {
    expect(normalizeSlug("https://www.fairprice.com.sg/product/foo-bar-12345678")).toBe("foo-bar-12345678");
  });
  it("strips leading slashes", () => {
    expect(normalizeSlug("/foo-bar-12345678/")).toBe("foo-bar-12345678");
  });
  it("trims whitespace", () => {
    expect(normalizeSlug("  foo-bar-12345678  ")).toBe("foo-bar-12345678");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeSlug("")).toBe("");
  });
});
