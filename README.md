# Nugaom AI Pick

A chart-led trading research workspace for Thai equities, DRs, TFEX, international equities, forex pairs, and crypto pairs. Forex is a first-class market; crypto is a separate secondary category.

The product's core promise is traceable signal evidence: every generated signal remains in the ledger, including wins, losses, expiries, and ambiguous outcomes. Charts, notifications, outcome grading, and aggregate statistics must all refer to the same immutable signal record.

## Project status

This repository has product research, a Next.js trading workspace with Lightweight Charts, and server-side read-only Settrade, FMP, Twelve Data Forex candidate, and Binance Spot adapters. The workspace requests real 15m, 1H, 4H or 1D candles for selected Thai/DR instruments through Settrade when credentials and coverage allow it. US stock charts use FMP EOD candles; intraday US candles remain unavailable. The AutoPick ledger scans the in-app SET100 + mai universe (150 names) and DR universe (141 names) across the applicable session, with per-symbol coverage and retries; an optional Nasdaq-100 daily-close pilot is also gated by source configuration and durable storage. US events are EOD-based and may arrive after the session, not as live intraday alerts. Other displayed prices remain labeled DEMO or unavailable. A local Ollama model can explain selected technical snapshots. The on-demand Market Scanner checks up to six Thai/DR symbols per request; Multi-TF compares candle intervals, and Volume Pulse is derived from OHLCV rather than net Fund Flow. The News window can show MarketDX theme articles locally when configured; public display rights still need confirmation. Browser-speech preview and analyst/marketing chat remain demos, Fund Flow awaits a licensed feed, and the web notification toast works only while a member has the app open.

- `docs/alphasigs-ux-audit.md` — reference product review and adaptation blueprint.
- `docs/alphasigs-workspace-deep-audit-2026-09-25.md` — detailed workspace interactions, signal-statistics audit, and honest gap matrix against the current Nugaom AI Pick demo.
- `docs/market-data-readiness.md` — review of existing provider adapters and Vercel access limits.
- `docs/symbol-search-and-analysis.md` — dated symbol catalogue, search coverage, technical rules, and local AI summary behavior.
- `docs/thai-market-coverage-and-widgets.md` — Thai market coverage, Settrade/SET/Yahoo source boundaries, and Investing.com Webmaster Tools assessment.
- `docs/settrade-adapter.md` — secure capability probe and data-quality rules for the new read-only Settrade module.
- `docs/market-universes-and-market-data.md` — agreed market universes, first-class Forex source assessment, and secondary crypto market-data source.
- `docs/mt5-forex-bridge.md` — review of the shared MT5 Colab notebook and the safe path from a broker's terminal to the web workspace.
- `prototype/index.html` — original single-file mockup for visual direction.
- `src/app` and `src/components/workspace.jsx` — Next.js workspace with separate primary navigation and symbol toolbar, full-catalogue search, Live Market Watch, a Toolbox below Lightweight Charts, popups, demo signal ledger/notifications, support-chat preview and selected-symbol technical monitor.
- `src/components/workspace-features.jsx` and `src/app/workspace-v5.css` — connected Market Scanner, Multi-TF, Volume Pulse, Terminal and News Guide popups, plus a pointer-responsive depth background that respects reduced-motion settings. Scanner rows and timeframe cards open the corresponding main chart state.
- `src/app/api/news/route.js` and `src/app/workspace-v8.css` — server-side MarketDX theme news and seven-day pulse, with source links, publication timestamps, bounded credit use, cached fallback and explicit source status. Add `MARKETDX_API_KEY` to private `.env.local`. Production public display is gated by `MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED=true` after rights confirmation. See `docs/news-data-integration.md`.
- `src/markets/us-watchlist.mjs` — the supplied US watchlist, organized as 200 stocks and 50 ETFs with searchable names and themes.
- `src/app/api/quote/route.js` — selected-symbol FMP snapshot for US stocks, ETFs, and Forex, with server-only credentials, observed timestamp, freshness label, and a production display-rights gate. See `docs/forex-data-sources.md`.
- `src/components/nugaom-assistant.jsx`, `src/app/api/assistant/route.js`, and `src/analysis/bigdata-research.mjs` — mascot research chat using the Bigdata.com Research Agent and source references. Requires an active LINE member account. Five successful questions per Bangkok day are free; each further successful answer costs one admin-granted AI credit. The server reserves the slot or credit atomically and restores it if the provider fails.
- `src/app/workspace-v6.css` and `public/nugaom-mascot.png` — Nugaom AI Pick identity, linked tool cards, source-status callout, and geometry-matched loading skeletons. The UI patterns follow [NameThatUI's web catalogue](https://namethatui.com/?platform=web).
- `src/components/workspace-hub.jsx` and `src/app/workspace-v7.css` — grouped scrollable sidebar, mobile menu, daily scan workflow, financial risk calculator, learning path, and visible product roadmap. Repeated account and tool launchers were consolidated.
- `src/app/api/daily-scan/route.js` — server-side daily rule scan for an allowlisted Settrade symbol batch, with freshness and source status; an upstream login failure is reported once before any batch is run.
- `src/app/account/page.jsx`, `src/components/account-page.jsx`, and `src/app/account.css` — member center for LINE login, brokerage portfolio submission, trial/renewal status, monthly code redemption, and admin review.
- `src/membership/store.mjs`, `src/membership/rights.mjs`, and account/auth/admin API routes — persistent local SQLite member records, hashed sessions, 14-day trial from first portfolio submission, server-side scan entitlements, portfolio verification, one-use account-bound monthly codes, and manual renewal approval. This does not collect payments online.
- `docs/account-and-sidebar-review-2026-09-26.md` — reference menu audit, current capability review, and deployment prerequisites.
- `docs/auto-pick-stage-03-04.md` — deterministic Thai AutoPick pilot, signal ledger, alerts and market readiness.
- `docs/us-autopick-eod.md` — Nasdaq-100 daily-only signal rules, data timing and remaining limits.
- `docs/daily-workspace-review-2026-09-26.md` — product review and prioritized path to a trustworthy daily-use service.
- `docs/build-order-2026-09-26.md` — current dependency-based build order, completion gates, and features to defer; supersedes the older priority table where account status has changed.
- `src/app/api/market-data/route.js` — catalogue-allowlisted, read-only 15m/1H/4H/1D candle API for selected Thai/DR instruments, with sanitized errors and a production display-rights gate.
- `src/app/api/market-watch/route.js` — allowlisted Thai/DR Settrade quote snapshots for up to six symbols per request, cached for 55 seconds and subject to the same production display-rights gate. The watch panel requests a new snapshot every 60 seconds; this is not a streaming feed.
- `src/app/api/ai-analysis/route.js` — local-only Ollama summary of the numeric technical snapshot; disabled in production.
- `src/markets/catalog.mjs`, `src/analysis/technical.mjs` and `src/analysis/indicator-details.mjs` — dated search entries and deterministic indicators, support/resistance and scan conditions calculated at the selected chart interval. Toolbox sections include Pivot/Donchian levels, EMA/SMA, ATR/Bollinger, volume/OBV, RSI/Stochastic and MACD.
- `src/market-data/settrade.mjs` — server-only Settrade quote and candle adapter. The provider interval codes for 15m, 1H and 4H are `15m`, `60m` and `240m`.
- `src/market-data/binance-spot.mjs` — server-only Binance Spot exchange-info, quote and OHLCV adapter; uses public market data and needs no API secret.
- `src/market-data/twelve-data-forex.mjs` — optional server-only Forex pair, reference-rate and OHLC adapter; requires `TWELVE_DATA_API_KEY` and does not provide bid/ask quotes.
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

The local daily-chart path has been observed for PTT, AOT and DR AAPL80. Intraday 15m/1H/4H responses have been observed for PTT and DR AAPL80, although coverage can vary by symbol. Intraday charts load snapshots on selection or manual refresh and do not stream. Thai AutoPick uses closed bars; US AutoPick is a separately gated daily-close pilot with an explicitly unvalidated rule. Production publication still requires source-display rights and a persistent worker/database; the browser does not receive alerts while closed.

`npm run probe:forex -- EUR/USD USD/JPY` and `npm run probe:binance-spot -- BTCUSDT` report provider availability without printing prices. Forex checks require `TWELVE_DATA_API_KEY`; neither market has a hardcoded user watchlist.

For the local SET / DR chart, use the four SET / DR variable names from `.env.example` with your existing values. Use the equity / DR app code with `BROKER_APP_ID` and `BROKER_API_SECRET`. TFEX has separate read-only credentials listed in `.env.example`; verified Z26 quote and candle feeds support its chart, while TFEX AutoPick remains off. Never add broker account-login, order, Telegram, or Webull credentials to this app. Run `npm run dev -- --hostname 127.0.0.1` and open `http://localhost:3000`. Production display stays unavailable until its matching `*_DISPLAY_RIGHTS_CONFIRMED=true` flag is set after rights are confirmed. See [TFEX Phase 1](docs/tfex-phase-one.md) for its current boundary.

## Member center setup

Use Node.js 22.13 or newer. Add `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_REDIRECT_URI`, `SESSION_SECRET`, and `PORTFOLIO_HASH_SECRET` to `.env.local`. The two secrets must each be at least 32 characters. Register the exact callback URL from `LINE_REDIRECT_URI` in the LINE Login channel. Set `ADMIN_LINE_IDS` to the comma-separated LINE user IDs of the people allowed to review accounts. Set `DATABASE_PATH` to a persistent, backed-up SQLite location; the default local path is `./data/nugaom.sqlite` and is ignored by Git. Restart the development server after changing `.env.local`.

The first portfolio submission starts a 14-day trial. The full portfolio number is not stored: the database keeps an HMAC digest and the final four characters. Admin verification requires a matching full number obtained from an independent brokerage record. A verified account may request renewal for manual payment review or redeem one account-bound, single-use monthly code. No online checkout or automatic payment verification is configured. The scan and local AI API check server-side membership. Basic chart and market quotes remain public. This SQLite setup needs a persistent Node server; do not deploy it to an ephemeral filesystem without moving member state to a durable database.

## AI assistant and US / Forex quotes

Set `BIGDATA_API_KEY` and `FMP_API_KEY` in the private `.env.local` file, along with the LINE member-center settings above. The assistant uses the provider's `lite` research mode and displays source references with the answer. Answers without a source are not delivered or charged. The last 30 answered questions in the most recent conversation are saved to the member's SQLite record so the chat survives a page reload. It does not use Codex plugins as a production backend. AI credits are granted from the admin member center; there is no credit checkout. The US category contains the supplied instruments plus two Nasdaq-100 names needed to complete its scanner universe. US stock/ETF/Forex quotes remain selected-symbol FMP snapshots. US stock charts use FMP daily OHLCV; signals use a separate daily-close rule and are not intraday.

For public production display, verify the provider agreement and set `FMP_DISPLAY_RIGHTS_CONFIRMED=true` only after display/storage rights are confirmed. Until then, the production quote and daily-bar endpoints stay unavailable. To opt into the US EOD worker, set `AUTO_PICK_US_ENABLED=true`; keep it disabled until persistent storage, worker uptime, and data rights are ready. The Bigdata key remains server-side. The assistant remains locked until LINE authentication, portfolio submission, and active trial or subscription are configured.

## Development notes

- Do not publish sample candles or sample outcomes as live or historical performance.
- Decide the outcome source, candle resolution, fees/spread assumptions, expiry rules, and same-candle TP/SL ambiguity policy before computing performance claims.
- Keep credentials in environment variables or a secrets manager; never commit keys or account identifiers.
