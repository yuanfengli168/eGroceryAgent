# Brainstorming — eGroceryAgent

> Living document. Captures the design discussion, dead-ends, and decisions for the pantry agent.

**Owner:** Jacky Li
**Started:** 2026-06-17
**Status:** Pre-implementation

---

## 1. Problem Statement

When household consumables are about to run out (toilet paper, dish soap, detergent, etc.), the user wants to know **which supermarket has the best price today** for the product they actually buy, without having to manually check three apps.

Trigger: a natural-language message like _"toilet paper almost finished"_.

---

## 2. Proposed Flow

```
[user: "toilet paper almost out"]
            │
            ▼
   1. Identify product (NLP / keyword match)
            │
            ▼
   2. Look up prior purchases
      - Query user's purchase history for that product
      - Resolve to: brand, size, pack count, typical unit price
            │
            ▼
   3. Fetch current price
      - FairPrice: search product page → price
      - RedMart:  search product page → price
            │
            ▼
   4. Compare
      - Today vs last paid price
      - FairPrice vs RedMart
            │
            ▼
   5. Reply with recommendation
      e.g. "FairPrice $12.90 (you paid $13.50 last time).
            RedMart $13.20. Save $0.60 at FairPrice."
```

---

## 3. Open Questions

### 3.1 Data sources

- **Where does purchase history come from?**
  - FairPrice account order history export?
  - Credit card statement parsing?
  - Manual log?
- **Is there an official FairPrice / RedMart API?** Likely no.
- **RedMart was acquired by FairPrice in 2022** — prices are often identical, so cross-platform comparison value is limited. Consider adding Cold Storage / Sheng Siong / Giant for real price spread.

### 3.2 Scraping vs paid services

- Found `realdataapi.com/ntuc-fairprice-grocery-scraper.php` — a third-party paid scraper. **Decision: not using it.** Reasons: cost overkill for personal use, ToS risk, and the same job can be done with a small Node.js script against FairPrice's own product pages.
- Found `actowizsolutions.com/redmart-fairprice-grocery-price-intelligence-singapore.php` — an Indian B2B scraping-as-a-service company. **Decision: not using it.** Reasons: enterprise pricing, "CAPTCHA solver + proxy rotation" approach that will get blocked, no self-serve API, and the "sample data" in their marketing copy uses fake SKUs (e.g. `SKU-FP-000321`).
- Both pages are useful only as **signal that the niche exists** — not as building blocks.
- Better path: a small, polite scraper with rate limiting, focused only on the SKUs in our catalogue.

### 3.3 Product matching

- "The toilet paper I bought last time" vs "FairPrice's listing today" — match by brand + size + pack count.
- Needs a curated SKU mapping table for the staples we care about.
- Risk: FairPrice changes product names / rebrands; mapping needs maintenance.

### 3.4 Agent integration

- Should this be a standalone Node.js service, or a sub-agent of the existing `life-hq` CEO router?
- The CEO already does `@agentname` routing via `sessions_spawn`. Adding a `@pantry` specialist is the natural fit.
- Trade-off: standalone is easier to open-source; sub-agent is easier to use from the existing Telegram setup.

### 3.5 Triggering

- Manual (user says "x is running out") only?
- Or also periodic polling: "based on your last 3 purchases of toilet paper, you're due for more in ~5 days"?

### 3.6 Platforms to compare

| Platform     | Owner         | Status                    |
|--------------|---------------|---------------------------|
| FairPrice    | NTUC          | MVP target                |
| RedMart      | FairPrice     | MVP target (likely same prices) |
| Cold Storage | DFI Retail    | Stretch goal              |
| Sheng Siong  | Independent   | Stretch goal              |
| Giant        | DFI Retail    | Stretch goal              |

---

## 4. Findings Log

### 2026-06-17
- User wants an agent that checks FairPrice + RedMart prices against past purchases for the same item.
- Identified `realdataapi.com` as a third-party paid option. **Rejected** — overkill, ToS concerns, no real benefit over a small self-hosted scraper.
- Identified `actowizsolutions.com` as a B2B scraping service. **Rejected** — enterprise pricing, aggressive scraping techniques (CAPTCHA solvers, proxy rotation) that will get blocked, no self-serve API, fake SKUs in their sample data.
- Pattern: both sites are SEO landing pages from scraping-service companies ranking for "FairPrice scraper" / "RedMart API" queries. Useful as competitive signal, useless as building blocks.
- Decision: Apache 2.0 license, open source, standalone repo at `eGroceryAgent`.

---

## 5. Decisions

| # | Decision                              | Date       | Status   |
|---|---------------------------------------|------------|----------|
| 1 | License: Apache 2.0                   | 2026-06-17 | ✅ confirmed |
| 2 | Reject `realdataapi.com`              | 2026-06-17 | ✅ confirmed |
| 3 | MVP scope: FairPrice + RedMart        | 2026-06-17 | ✅ confirmed |
| 4 | Compare with Cold Storage / Sheng Siong | 2026-06-17 | ⏳ stretch |
| 5 | Reject `actowizsolutions.com`          | 2026-06-17 | ✅ confirmed |
| 6 | Standalone repo: `eGroceryAgent`      | 2026-06-17 | ✅ confirmed |

---

## 6. Next Steps

- [ ] Confirm purchase-history data source (FairPrice export? credit card? manual?)
- [ ] Sketch the agent interface (`@pantry <message>` from the CEO router)
- [ ] Manually inspect 2-3 FairPrice product pages to confirm scrapability
- [ ] Initialize git repo and push to GitHub under `eGroceryAgent`
- [ ] Write a minimal proof-of-concept scraper for one SKU
