# eGroceryAgent

> Personal agent that compares grocery prices across Singapore supermarkets and tells you where to buy what you need at the best price.

## Status

🚧 **Pre-alpha / FairPrice only.** RedMart is locked down by Lazada (CSR + CAPTCHA) and is not currently scrapable without a real browser session. See [`docs/brainstorming.md`](docs/brainstorming.md) §3.2 for details.

## Project Layout

```
src/
  http/           # HTTP client interface + real fetch implementation
  scrapers/       # Platform-specific scrapers (FairPrice, RedMart)
  cache/          # TTL cache for price lookups
  compare/        # Multi-platform price comparison
bin/
  check.ts        # CLI: check "toilet paper"
tests/
  scrapers/       # Scraper unit tests (mocked HTTP)
  fixtures/       # Saved HTML/JSON from real sites
docs/
  brainstorming.md
```

## Development

```bash
npm install
npm test              # run tests
npm run test:coverage # run tests + show coverage
npm run typecheck     # type-check
npm run lint          # lint
npm run check         # typecheck + test + lint
```

## License

Apache 2.0 — see [`LICENSE`](LICENSE).
