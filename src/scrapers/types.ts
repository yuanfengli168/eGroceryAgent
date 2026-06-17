/**
 * Core types shared across scrapers, cache, and compare layers.
 */

/** A product as returned by a scraper's search. */
export interface Product {
  /** Stable product identifier (platform-specific). */
  readonly id: string;
  /** URL slug (last numeric segment is the canonical product ID for FairPrice). */
  readonly slug: string;
  /** Display name, e.g. "FairPrice Bathroom Tissue - Strong (3ply)". */
  readonly name: string;
  /** Brand if known, e.g. "FairPrice", "Kleenex". */
  readonly brand: string | null;
  /** Price in SGD. */
  readonly price: number;
  /** Pack size, e.g. "20 x 200 per pack". */
  readonly packSize: string | null;
  /** Absolute URL to the product page on the platform. */
  readonly url: string;
  /** Which platform this came from. */
  readonly platform: Platform;
}

/** The two platforms we support in MVP. */
export type Platform = "fairprice" | "redmart";

/** Generic scraper interface. Both FairPrice and RedMart implement this. */
export interface Scraper {
  /** The platform this scraper targets. */
  readonly platform: Platform;

  /**
   * Search for products by free-text query.
   * Returns up to `limit` matching products.
   */
  search(query: string, options?: SearchOptions): Promise<readonly Product[]>;

  /**
   * Look up a single product by its slug or product ID.
   * Returns null if not found.
   */
  getProduct(slugOrId: string): Promise<Product | null>;
}

export interface SearchOptions {
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
}
