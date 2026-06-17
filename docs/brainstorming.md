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

**Decision: don't scrape on a schedule in MVP.** SKU-level prices in Singapore grocery are sticky — most products hold the same price for weeks. Daily scraping is wasted work. Triggers that actually matter:

1. **On-demand** — user says "x is running out" → check now. This is the 90% case.
2. **Cache hit** — if a price was checked < 48h ago for the same SKU, reuse it. Cold path becomes 1 scrape per SKU per week.
3. **Weekly digest** (opt-in, later) — Sunday evening scan of next week's promos.
4. **Watchlist threshold** (later) — "tell me when toilet paper drops below $10."
5. **Known sale event** (later) — small calendar of recurring sales (FairPrice members' sale, GSS, brand days); scrape watchlisted SKUs the day before.

This means no cron scheduler is required for the basic case. Sale-event handling is a separate opt-in feature, and even that is calendar-driven, not polling-driven.

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
- Considered using an LLM-driven browser tool (Browser-Use, Computer Use) instead of scraping. **Rejected as the primary approach.** Browser tools are slow (5-15s), expensive (~$0.02/page in tokens), non-deterministic, and produce free-text output that needs re-parsing. They are good fallbacks for hard cases (CAPTCHA, layout changes), not the workhorse. The agent orchestrates, the scraper fetches.
- Considered scraping on a daily schedule. **Rejected.** SKU-level grocery prices in Singapore are sticky (weeks-to-months per price point). Daily scraping is wasted work. The 90% case is on-demand: user says "x is running out" → check now, with a short cache (e.g. 48h) to absorb bursts.
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
| 7 | Don't scrape on a schedule (MVP)      | 2026-06-17 | ✅ confirmed |
| 8 | On-demand + cache-first architecture  | 2026-06-17 | ✅ confirmed |

---

## 6. Next Steps

- [ ] Confirm purchase-history data source (FairPrice export? credit card? manual?)
- [ ] Sketch the agent interface (`@pantry <message>` from the CEO router)
- [ ] Manually inspect 2-3 FairPrice product pages to confirm scrapability
- [ ] Initialize git repo and push to GitHub under `eGroceryAgent`
- [ ] Write a minimal proof-of-concept scraper for one SKU
