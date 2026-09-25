# Market Signal Workspace

A chart-led trading research workspace for Thai equities, DRs, TFEX, international equities, forex pairs, and crypto pairs. Forex is a first-class market; crypto is a separate secondary category.

The product's core promise is traceable signal evidence: every generated signal remains in the ledger, including wins, losses, expiries, and ambiguous outcomes. Charts, notifications, outcome grading, and aggregate statistics must all refer to the same immutable signal record.

## Project status

This repository has product research, an early visual prototype, and server-side read-only Settrade, Twelve Data Forex, and Binance Spot data adapters. It also has dated-universe helpers. The prototype uses illustrative sample data and does not connect to these adapters, generate production AI signals, grade trades, or send notifications.

- `docs/alphasigs-ux-audit.md` — reference product review and adaptation blueprint.
- `docs/market-data-readiness.md` — review of existing provider adapters and Vercel access limits.
- `docs/thai-market-coverage-and-widgets.md` — Thai market coverage, Settrade/SET/Yahoo source boundaries, and Investing.com Webmaster Tools assessment.
- `docs/settrade-adapter.md` — secure capability probe and data-quality rules for the new read-only Settrade module.
- `docs/market-universes-and-market-data.md` — agreed market universes, first-class Forex source assessment, Webull selection status, and secondary crypto market-data source.
- `prototype/index.html` — early workspace mockup for visual direction.
- `src/market-data/settrade.mjs` — server-only Settrade quote and daily-candle adapter.
- `src/market-data/binance-spot.mjs` — server-only Binance Spot exchange-info, quote and OHLCV adapter; uses public market data and needs no API secret.
- `src/market-data/twelve-data-forex.mjs` — server-only Forex pair, reference-rate and OHLC adapter; requires `TWELVE_DATA_API_KEY` and does not provide bid/ask quotes.
- `src/markets/universe.mjs` — dated snapshots and selection rules for SET100, mai Top 50, DR80, TFEX contracts, configured Forex pairs and crypto pairs.

## Product principles

- Real prices must identify their instrument, venue, source, currency, and freshness.
- TFEX futures are distinct from spot metals and cash indices; contract metadata and expiry/rollover matter.
- Confidence is not a win probability unless it has been calibrated and validated.
- Every outcome must be visible and drill down to its chart evidence.
- AI interpretation, simulated results, observed prices, and graded outcomes must be labeled separately.
- Market-data licensing and provider limitations must be resolved before a live integration is published.

## Initial asset groups

1. Thai equities
2. Depositary Receipts (DR)
3. TFEX: Gold, Silver, SET50
4. International equities
5. Forex pairs (major, minor and cross pairs)
6. Crypto pairs (secondary; spot initially unless perpetual futures are explicitly selected)

## First implementation milestone

Build one end-to-end vertical slice with a licensed real data source:

`instrument registry → OHLCV feed → Lightweight Charts → immutable signal record → deterministic outcome grading → per-trade evidence → aggregate statistics → alert state change`

The first instrument will be selected after confirming which market-data API and permissions are available.

`npm run probe:forex -- EUR/USD USD/JPY` and `npm run probe:binance-spot -- BTCUSDT` report provider availability without printing prices. Forex checks require `TWELVE_DATA_API_KEY`; neither market has a hardcoded user watchlist.

## Development notes

- Do not publish sample candles or sample outcomes as live or historical performance.
- Decide the outcome source, candle resolution, fees/spread assumptions, expiry rules, and same-candle TP/SL ambiguity policy before computing performance claims.
- Keep credentials in environment variables or a secrets manager; never commit keys or account identifiers.
