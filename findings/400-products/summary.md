# FairPrice Price Resolution — Analysis of 400 Products (3 NEW Categories)

**Date:** 2026-06-18
**Source:** FairPrice.com.sg Singapore
**Sample size:** 379 products (bakery-deli had only 111 unique products available)
**New categories used:** health-beauty, bakery-deli, world-foods (never used in any prior dataset)

## Goal

Fill the remaining blind spots. The previous 3 datasets (50/100/300 = 449 products) focused on common grocery items. This dataset tests 3 categories that may have different pricing patterns:

- **health-beauty**: vitamins, supplements, skincare, hair care
- **bakery-deli**: cakes, pastries, fresh deli items (vs grocery bread which was in dairy)
- **world-foods**: Korean, Japanese, Thai, Indian specialty products

## Headline numbers

| Metric | Value |
|---|---|
| Products analyzed | 379/379 (100%) |
| With `storeSpecificData.mrp` populated | 379/379 (100%) |
| With valid `BXATP` (price > 0) | 135/379 (35%) |
| With `BXATP` (X≥2, price=null) — defensive fallback needed | 6/379 (1.6%) |
| With `BANYATP` | 37/379 (10%) |
| **With no offers at all** | **188/379 (50%)** |

## By category

| Category | Total | BXATP rate | No-offers rate |
|---|---|---|---|
| health-beauty | 134 | 56/134 (41%) | 55/134 (41%) |
| bakery-deli | 111 | 34/111 (30%) | 71/111 (64%) ⚠️ |
| world-foods | 134 | 45/134 (33%) | 62/134 (46%) |

## Key observation: bakery-deli has very high no-offers rate

64% of bakery-deli products have **no offers at all** — higher than any category in prior samples. This makes sense: fresh bakery items are produced daily with stable pricing, no need for promo discounts.

## Cumulative findings across ALL 4 datasets

| Dataset | Products | BXATP | BXATP (X≥2) | BANYATP | No-offers |
|---|---|---|---|---|---|
| 50-products | 50 | 18 | 3 | 17 | 12 (24%) |
| 100-products | 100 | 33 | 0 | 18 | 48 (48%) |
| 300-products | 299 | 95 | 17 | 62 | 121 (40%) |
| **400-products** | **379** | **135** | **6** | **37** | **188 (50%)** |
| **GRAND TOTAL** | **828** | **281 (33%)** | **26** | — | **369 (44%)** |

## Resolution rule (validated across 828 products)

For each product, the price to display:

1. **Find the first `BXATP` offer with `price > 0`** (a number). Use that price.
2. **Else** use `final_price` (> 0). [Note: only search-page products have this; product-detail pages never do]
3. **Else** use `storeSpecificData[0].mrp` (parseFloat, > 0).
4. **Else** return `null`.

Each step uses **strict type-and-value validation** (`typeof === 'number' && > 0`) to defend against:
- `price: null` (BXATP with X≥2 — should fall through)
- `price: ""` (empty string — hypothetical)
- `price: 0` (placeholder — defensive)

This rule produces a valid `currentPrice` for **all 828/828** products in our sample set.

## Original-price (strikethrough) detection

`storeSpecificData[0].mrp` is the "was" price, populated 100% of the time. If `mrp > currentPrice`, show as strikethrough.

## Worked example — World foods category (Korean product)

```
name:           CJ Bibigo Korean BBQ Sauce
final_price:    null (omni detail page, not search)
storeSpecificData[0].mrp:    "8.50"

offers: []
```

→ No BXATP → no `final_price` → use `mrp = 8.50`. Display: $8.50, no strikethrough.

## Worked example — Bakery-deli (cake)

```
name:           Baker's Oven Pandan Cake
final_price:    null
storeSpecificData[0].mrp:    "12.90"

offers[0]:
  type:     BXATP
  price:    9.90
  desc:     "Buy 1 At $9.90"
```

→ First BXATP with valid price = 9.90. Display: ~~$12.90~~ **$9.90** (BXATP discount).

## Worked example — Health-beauty (BXATP with X≥2)

```
name:           Centrum Multivitamin
offers[0]:
  type:     BXATP
  price:    null  ← because X=2
  desc:     "Buy 2 At $28.90"
```

→ BXATP but `price` is `null` — fall through (NOT a fallback failure!)
→ `final_price` is null (omni detail)
→ Use `mrp = 32.50` as `currentPrice`. Display promo description "Buy 2 At $28.90" as informational banner.

## Files

```
findings/400-products/
├── manifest.txt                         # 379 products × {cat, term, slug, name}
├── summary.md                           # this file
├── searches/                            # 24 raw __NEXT_DATA__ blobs
│   ├── search-health-beauty-vitamins.json
│   └── ... (24 files)
└── products/                            # 379 raw product page __NEXT_DATA__ blobs (~67 MB)
    ├── p001-health-beauty-vitamin-c-...json
    └── ... (379 files)
```

## Conclusion

The defensive price resolution rule (BXATP+price>0 → final_price+>0 → mrp>0 → null) is **stable across 828 products** spanning 9 different categories. The `price: null` edge case for BXATP with X≥2 is rare but real (26/828 = 3.1% of all BXATP offers) — without the `> 0` guard, the parser would treat these as fallback failures and incorrectly skip them.

The scraper is ready to be updated with this rule.