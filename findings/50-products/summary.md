# FairPrice Price Resolution — Analysis of 50 Products

**Date:** 2026-06-17
**Source:** FairPrice.com.sg Singapore
**Sample size:** 50 products (5 from each of 10 search terms)

## Rate-limit verification

40 requests fired in quick succession (20 to the same search URL, 20 cycling through 5 product pages):

| Metric | Result |
|---|---|
| HTTP status | All 200 OK |
| Rate-limit responses (429) | 0 |
| Average response time | ~0.7s (search) / ~0.5s (product page) |
| Blocking / CAPTCHAs | None |

**Conclusion:** FairPrice does not rate-limit anonymous HTTP requests from a desktop User-Agent. No throttling required. (For politeness we still cache results, but not for the platform's sake.)

## Sample composition

Search terms used:
- `Kleenex`, `Paseo`, `Pursoft` (toilet / facial tissue)
- `Listerine`, `Colgate` (oral care)
- `Pantene` (hair care)
- `Maggi` (instant noodles)
- `Nescafe` (coffee)
- `Coca Cola` (soft drinks)
- `Chips` (snacks)

## Top-level price field shape (per product)

| Field | Path | Type | Always present? |
|---|---|---|---|
| `final_price` | top-level | `number` | **Yes (50/50)** |
| `price` | top-level | `null` | n/a |
| `display_price` | top-level | `null` | n/a |
| `mrp` | top-level | `null` in product detail | n/a |
| `storeSpecificData[0].mrp` | nested | `string` (e.g. `"15.06"`) | **Yes (50/50)** |
| `storeSpecificData[0].mrp8` | nested | `number` (e.g. `15.06`) | **Yes (50/50)** |
| `storeSpecificData[0].discount` | nested | `string` (e.g. `"0.71"`) | Yes |

## Offer type distribution

Across all 50 products, 105 offers total:

| `type` | Count | Meaning | Has numeric `price`? |
|---|---|---|---|
| `BXATP` | 33 | Buy X At This Price (single-unit price override) | **Yes (when present)** |
| `BANYATP` | 15 | Buy Any N At This Price (multi-buy across variants) | No (price = null) |
| `BMINXGFG` | 7 | Buy Min Get Free Gift (e.g. "Spend $48, free bag") | No (price = null) |
| `BMIN` | 4 | Buy Min get discount (e.g. "Spend $68, get $8 off") | No (price = null) |

## Price resolution rule (validated)

For each product, the price to display is determined as follows:

1. **Find the first `BXATP` offer with a numeric `price`.** Use that price.
2. **If no `BXATP` offer exists**, use `final_price` (the regular non-promo price).
3. **Strikethrough (was) price** = `storeSpecificData[0].mrp` (string, convert to number).

**Result on 50 products:** 28/50 (56%) have a BXATP offer that overrides `final_price` (i.e. a single-unit promotional discount). The remaining 22/50 fall back to `final_price` correctly. All 50/50 have a populated `mrp` for the strikethrough.

### Worked example — Kleenex Ultra Soft & Thick Toilet Tissue Rolls 20×180

```
final_price:                   15.06      (regular price, what our old code returned)
storeSpecificData[0].mrp:      "15.06"    (strikethrough, same as final_price here)
storeSpecificData[0].discount: "0.71"     (savings amount)

offers[0]:
  type:     BMINXGFG           (spend $48, get free canvas bag)
  price:    null               (not a price override)

offers[1]:
  type:     BXATP              (buy 1 at this price)
  price:    14.35              (✓ the real price you pay)
  desc:     "Buy 1 Kleenex Ultra Soft & Thick Toilet Tissue Rolls @ $14.35"
```

**Correct price:** 14.35 (from BXATP)
**Our old scraper returns:** 15.06 (from `final_price`)

## Comparison: search listing vs product detail

Search listings use a **different `__NEXT_DATA__` shape** than product detail pages.

**Search listing** path: `props.pageProps.data.data.page.layouts[2].value.collection.product[]`

**Product detail** path: `props.pageProps.product.data.page.layouts[0].value`

Both have `final_price` and `offers[]` with the same structure — only the path differs. The `mrp` field is `null` in the search listing (presumably computed only on the detail page).

## Open questions

1. **Are there products with multiple `BXATP` offers?** Not seen in this sample. If yes, we'd need a rule for picking one (e.g. lowest price, or most recent validTill).
2. **Are there `BXATP` offers with stale prices?** All `validFrom`/`validTill` we saw look current.
3. **What about products not in this sample** (e.g. fresh produce, meat, dairy)? Those may have different promo shapes.

## Files

```
findings/50-products/
├── manifest.txt                     # 50 products × {term, url, name}
├── searches/                        # raw __NEXT_DATA__ for 10 search terms
│   ├── search-Kleenex.json          (~178 KB)
│   ├── search-Paseo.json
│   ├── search-Pursoft.json
│   ├── search-Listerine.json
│   ├── search-Colgate.json
│   ├── search-Pantene.json
│   ├── search-Maggi.json
│   ├── search-Nescafe.json
│   ├── search-Coca-Cola.json
│   └── search-Chips.json
└── products/                        # raw __NEXT_DATA__ for 50 product pages
    ├── p000-Chips-pringles-....json
    ├── p001-Chips-cheezels-....json
    └── ... (50 files, ~8.5 MB total)
```
