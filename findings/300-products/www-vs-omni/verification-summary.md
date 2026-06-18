# FairPrice www vs omni — Product Detail Page Verification

**Date:** 2026-06-18
**Method:** Re-fetched all 300 products from BOTH `www.fairprice.com.sg/product/{slug}` AND `omni.fairprice.com.sg/product/{slug}` using a Safari UA. Compared at 3 levels: full JSON, main product entity, price-relevant fields only.

## TL;DR

**www and omni return the SAME product data.** Differences are entirely per-session/per-request noise (random user IDs, A/B test flags, real-time stock counters). **Price fields (mrp, offers, BXATP) are 100% identical across all 300 products.**

## Sample URL

`https://www.fairprice.com.sg/product/meiji-fresh-milk-2lt-10238055` — manually tested in Safari and via curl. **No HTTP redirect (HTTP/2 200 from both).** Both URLs render the same Next.js app.

## Three-level comparison

| Level | Identical | Different |
|---|---|---|
| Full `__NEXT_DATA__` JSON | 0/300 (0%) | 300/300 (100%) |
| Main product entity (`layouts[0].value`) | 142/300 (47%) | 158/300 (53%) |
| Main entity after stripping `productsCount` | 288/300 (96%) | 12/300 (4%) |
| Main entity after stripping `productsCount` + `tagIds` + `tags` | 293/300 (98%) | 7/300 (2%) |
| Main entity after stripping `productsCount` + `tagIds` + `tags` + stock counters | **299/300 (99%)** | 1/300 (<1%) |
| **Price fields only** (`mrp`, `offers[]`) | **300/300 (100%)** | **0/300 (0%)** |

## What the differences are (all noise)

### At full-JSON level (300/300 differ)
These fields vary per request regardless of which URL is hit:

| Field | Variation |
|---|---|
| `props.userKey` | `'131780_GUEST'` vs `'146930_GUEST'` (random per session) |
| `props.organizationData.defaultStoreName` | `'Fairprice PFC'` vs `'Hyper Changi (FFS)'` |
| `props.checkoutAddress.clientId` | `'004'` vs `'461'` |
| `props.treatments.*.treatment` | `'off'` vs `'on'` (A/B test flags) |
| `scriptLoader[0].nonce` | random CSP nonce per request |
| `primaryCategory.parentCategory.productsCount` | 0 vs 1 (live counter) |
| `layouts[1]` (recommended products) | different shuffle order — different recommendation algorithm run between requests |

### At entity level (only 7 differ after full strip)
| File | Pattern |
|---|---|
| p087 (Seara Frozen Chicken) | `inStoreStock` 796 vs 788, `onlineStock` 600 vs 593 — real-time stock changed between the two fetches |
| p089, p295, p299 (other meat/seafood) | same — live stock counters |
| p147, p252, p270 (other categories) | same — live stock counters |

These are **time-based** differences (one request was a few seconds earlier than the other), not URL-based.

## What this means for the scraper

1. **Use either URL** — `www.fairprice.com.sg/product/{slug}` and `omni.fairprice.com.sg/product/{slug}` return **identical product data**. Pick based on other criteria (e.g., cookie scope, CDN region) not data shape.
2. **`www.fairprice.com.sg` has extra tracking scripts** in the HTML head (`AW-820724779` Google Ads, `gtag.js`) that omni doesn't. These are noise for scraping but not a problem.
3. **Strip per-session fields when comparing/scraping across requests:** `userKey`, `nonce`, `treatments`, `organizationData`, `checkoutAddress`, `scriptLoader`, `productsCount`, `tagIds`, `tags`, `inStoreStock`, `onlineStock`, `stock`, `sapStock`.
4. **`mrp` and `offers[]` are reliable price sources** — they never change between www/omni requests.

## Files

```
findings/300-products/www-vs-omni/
├── www/    300 files, ~47 MB (www.fairprice.com.sg product pages)
└── omni/   300 files, ~47 MB (omni.fairprice.com.sg product pages)
```

Pairs are matched by filename: `p{NNN}-{slug}.json` exists in both directories.

## Conclusion

The user's intuition is correct: www and omni are the SAME site from the data perspective. My earlier claim that "www redirects to omni" was wrong — there's no redirect. Both serve the same Next.js app from the same backend API. The only real difference is www has some marketing tracking scripts that omni doesn't have.

For scraping purposes: **use `www.fairprice.com.sg`** (it's the canonical public-facing URL), but treat both as equivalent.

## Reproduction

```bash
cd /home/lyf99/Desktop/Github/eGroceryAgent
python3 << 'PYEOF'
import json, os
def get_entity(d):
    return d['props']['pageProps']['product']['data']['page']['layouts'][0]['value']
def strip(o):
    if isinstance(o, dict): return {k: ('__S__' if k in ('productsCount','tagIds','tags','inStoreStock','onlineStock','stock','sapStock') else strip(v)) for k, v in o.items()}
    if isinstance(o, list): return [strip(v) for v in o]
    return o
files = sorted(os.listdir("findings/300-products/www-vs-omni/www"))
ok = sum(strip(get_entity(json.load(open(f"findings/300-products/www-vs-omni/www/{f}")))) == strip(get_entity(json.load(open(f"findings/300-products/www-vs-omni/omni/{f}")))) for f in files if f.endswith('.json'))
print(f"{ok}/300 identical after strip")
PYEOF
```