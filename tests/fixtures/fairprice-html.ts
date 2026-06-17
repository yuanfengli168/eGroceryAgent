/**
 * Minimal HTML fixtures for FairPrice scraper tests.
 *
 * These are NOT full pages — just enough to exercise the parser.
 * Real-world fixtures live in tests/fixtures/ for end-to-end tests.
 *
 * Product shape matches what FairPrice actually emits:
 *   { name, slug, brand: {name}, final_price, offers: [{price}], ... }
 */

/** A search page with two products. */
export const TWO_PRODUCTS_HTML = `
<!doctype html>
<html>
<head><title>Results | FairPrice</title></head>
<body>
<script id="__NEXT_DATA__" type="application/json">
{"page":{"layouts":[{"name":"ProductCollection","data":{"metaData":{"title":"toilet paper"}}}]}}
</script>

<script>
var data = [
{"barcodes":["9555227802803"],"brand":{"clientId":"FAIRPRICE","name":"Fairprice","slug":"fairprice"},"clientItemId":"13004987","final_price":18.82,"name":"Fairprice Onwards Toilet Tissue Roll - 3 Ply","offers":[{"description":"Buy 1 @ $17.50","price":17.5,"type":"BXATP"}],"slug":"fairprice-onwards-toilet-tissue-roll-3-ply-30-x-220-per-pack-13004987","status":"ENABLED"},
{"barcodes":["9555227802902"],"brand":{"clientId":"KLEENEX","name":"Kleenex","slug":"kleenex"},"clientItemId":"13199730","final_price":14.35,"name":"Kleenex Ultra Soft Toilet Tissue Roll - Cottonyclean 20 X 200 Per Pack","offers":[],"slug":"kleenex-ultra-soft-toilet-tissue-roll-cottonyclean-20-x-200-per-pack-13199730","status":"ENABLED"}
];
</script>
</body>
</html>
`;

/** A search page that returns no products. */
export const EMPTY_RESULTS_HTML = `
<!doctype html>
<html>
<head><title>Results | FairPrice</title></head>
<body>
<script id="__NEXT_DATA__" type="application/json">
{"page":{"layouts":[{"name":"ProductCollection","data":{"metaData":{"title":"zzznoresult"}}}]}}
</script>
<p>No results</p>
</body>
</html>
`;

/** A search page where products have no brand field. */
export const NO_BRAND_HTML = `
<!doctype html>
<html><body>
<script>
[
{"name":"Generic Tissue 10 Pack","slug":"generic-tissue-10-pack-12345678","final_price":5.5,"offers":[]}
]
</script>
</body></html>
`;

/** A search page with malformed data mixed with valid products. */
export const MIXED_VALIDITY_HTML = `
<!doctype html>
<html><body>
<script>
[
{"name":"Valid Product 1","slug":"valid-product-1-12345678","brand":{"name":"V1"},"final_price":2.99,"offers":[{"price":1.99}]},
{"name":"","slug":"empty-name-12345678","brand":{"name":"Empty"},"final_price":2.99,"offers":[]},
{"slug":"no-name-12345678","brand":{"name":"X"},"final_price":2.99,"offers":[]},
{"name":"Negative Price","slug":"neg-12345678","brand":{"name":"Neg"},"final_price":-1,"offers":[]},
{"name":"Valid Product 2","slug":"valid-product-2-87654321","brand":{"name":"V2"},"final_price":9.99,"offers":[]}
];
</script>
</body></html>
`;

/** A product detail page with one product. */
export const SINGLE_PRODUCT_PAGE_HTML = `
<!doctype html>
<html>
<head><title>FairPrice Bathroom Tissue - Strong (3ply) | FairPrice</title></head>
<body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"initialData":{"name":"FairPrice Bathroom Tissue - Strong (3ply)","slug":"fairprice-bathroom-tissue-strong-3ply-20-x-200-per-pack-13277607","brand":{"name":"FairPrice","slug":"fairprice"},"final_price":8.95,"offers":[]}}}}
</script>
</body>
</html>
`;

/** A product detail page where the product isn't found (404-like body). */
export const NOT_FOUND_PAGE_HTML = `
<!doctype html>
<html><body><h1>Page Not Found</h1></body></html>
`;

/** HTML with special characters and escaped quotes in product names. */
export const SPECIAL_CHARS_HTML = `
<!doctype html>
<html><body>
<script>
[
{"name":"Caf\\"e \\"Latte\\" Beans 250g","slug":"cafe-latte-beans-250g-12345678","brand":{"name":"CafeCo"},"final_price":12.5,"offers":[]}
]
</script>
</body></html>
`;

/** A product with a non-sale offer price (offers[0].price should win). */
export const ON_SALE_HTML = `
<!doctype html>
<html><body>
<script>
[
{"name":"Sale Product","slug":"sale-product-99999999","brand":{"name":"X"},"final_price":20.0,"offers":[{"price":15.5,"type":"BXATP"}]}
]
</script>
</body></html>
`;
