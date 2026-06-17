# eGroceryAgent

> A personal agent that watches your pantry, checks current grocery prices across Singapore supermarkets, and tells you where to buy what you need at the best price.

## Status

🚧 **Pre-alpha / brainstorming phase.** See [`docs/brainstorming.md`](docs/brainstorming.md) for the current thinking.

## The Idea (TL;DR)

You say: _"Toilet paper is running out."_

The agent:
1. Looks up your previous purchase of the same product (brand, size, pack count)
2. Checks today's price on FairPrice
3. Checks today's price on RedMart
4. Compares and recommends where to buy, with the savings

## Planned Scope

- **MVP:** FairPrice + RedMart, a small set of staples (toilet paper, dish soap, detergent, etc.)
- **Later:** Cold Storage, Sheng Siong, Giant; price history charts; auto-detection of "running out" from purchase cadence
- **Out of scope (for now):** placing orders, inventory management beyond chat, multi-user / household features

## License

Apache 2.0 — see [`LICENSE`](LICENSE).

## Contributing

This is currently a personal project. Issues and PRs welcome once the MVP is up.
