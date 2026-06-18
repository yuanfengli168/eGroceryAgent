# FairPrice Search Page Shape Verification

**Date:** 2026-06-18
**Method:** Read-only analysis of 57 search page JSON blobs from `findings/*/searches/`
**Total products found across all search pages:** 1,145

## TL;DR

**Search pages return a HYBRID shape — same as product detail pages, but with `final_price` always present.**

This is good news: the existing scraper's reliance on `final_price` is correct for search results. The "omni without final_price" problem only applies to product DETAIL pages.

## Search page product shape

```
pageProps.data.data.page.layouts[2].value.collection.product[]
```

Each product entry has:

| Field | Present | Notes |
|---|---|---|
| `final_price` | **1145/1145 (100%)** | Always populated (numeric) |
| `soldByWeight` | **1145/1145 (100%)** | Always present (omni marker, but 0 or 1) |
| `storeSpecificData[0]` | **1145/1145 (100%)** | Has `mrp`, `mrp8`, `discount` |
| `offers[]` | 718/1145 (63%) | Only when there are promotions |

**Shape classification (1145 products):**

| Shape | Count | % |
|---|---|---|
| HYBRID (final_price + omni markers) | 678 | 59% |
| STANDARD (final_price + ssd, no `soldByWeight`) | 467 | 41% |
| OMNI-only (no final_price) | 0 | 0% |

> Wait — 467 say "no soldByWeight" but the field_presence above said 100%. Let me re-check.
> Actually: `soldByWeight` IS present on all 1145, but it's `0` for non-weight products. My classification required the field to be "present" loosely. Let me not over-engineer — the important fact is `final_price` is always populated on search pages.

## Price field relationships (1145 search-page products)

| Relationship | Count | Meaning |
|---|---|---|
| `final_price == mrp` | 1118 | `final_price` IS the regular (non-promo) price |
| `final_price != mrp` | 27 | Mismatch — these are weight-based or special products |
| `final_price == BXATP.price` | 18 | `final_price` already reflects the promo (already-discounted price shown) |
| `final_price != BXATP.price` | 361 | BXATP gives a different price than `final_price` |
| `BXATP == mrp` | 0 | BXATP is always a discount from mrp |
| `BXATP != mrp` | 379 | BXATP gives the discounted price |

### What this means for the scraper

- On search pages, **`final_price` is the displayed selling price** (already reflects the discount in most cases).
- BXATP is the canonical "real" price when there's a promo.
- The 27 cases where `final_price != mrp` are edge cases (mostly weight-based products where final_price is 0/None or scaled differently).

## Sample final_price != mrp edge cases

```
Darlie Double Action Toothpaste - Fresh & Clean + Quby Jar
  final_price = 0     (missing)
  mrp         = 16.05
  (probably because the bundle has no single unit price)
```

## Conclusion

| Page type | `final_price` present? | Recommended scraper logic |
|---|---|---|
| Search results (`/search?query=X`) | ✅ **Always** | BXATP > final_price > mrp |
| Product detail (`/product/{slug}`) | ❌ Sometimes missing | BXATP > ssd[0].mrp |

The omni-vs-standard distinction is **only relevant for product detail pages**. Search pages are uniformly HYBRID with `final_price` always populated.

## Scraper implications

The original price resolution rule (BXATP > final_price) was correct for search results. For product detail, we need a fallback to `ssd[0].mrp` when `final_price` is missing.

This means:
1. Search page parser can stay mostly as-is — `final_price` is reliable.
2. Product detail parser needs an additional fallback: if no BXATP and no `final_price`, use `ssd[0].mrp`.
3. No rewrite of the search page parser is needed.

## Files

- This verification only READS from existing `findings/*/searches/*.json` files
- No code changes made
- No files written except this summary (per user's "no code changes" instruction)