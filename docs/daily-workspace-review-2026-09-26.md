# Nugaom AI Pick: daily-use product review (26 September 2026)

> This review preceded the member-center implementation. For the current order of work and updated membership status, use [build-order-2026-09-26.md](build-order-2026-09-26.md).

## What this iteration adds

The workspace now has a scrollable grouped sidebar and a mobile navigation drawer. Each menu item opens a real workspace section or a clearly labeled preview panel. The new daily desk calls a server-side Settrade 1D scanner for one of three small preset baskets or up to eight Settrade watchlist symbols. Results show source freshness, trend, RSI-related rule events, and a path to the same symbol's chart. If upstream access fails, the interface states why and shows no invented scan result.

Guest rights are defined in `src/membership/rights.mjs`, returned by `/api/membership`, and used by `/api/daily-scan` to cap batch size. The browser cannot request a Pro tier. A member-rights panel explains the current Guest scope. Financial Check performs a local risk-budget calculation; it does not place trades.

## Product gaps, in order

| Priority | Gap | Why it matters | Next implementation |
| --- | --- | --- | --- |
| P0 | Reliable, licensed market feeds | Current Settrade authentication can fail; other markets are demo or unconnected. Daily scanning depends on actual OHLCV. | Resolve Settrade login/coverage and public display rights. Add freshness, market calendar, provider health, and fallbacks per market. |
| P0 | Immutable signal and outcome ledger | Demo records and win rate cannot establish performance. | Store every generated signal with rule version, candle IDs, entry/exit logic, fees, expiry, and ambiguous-bar status; grade from independent market data. |
| P0 | Authentication and billing | “Member” and Pro are currently concepts; there is no account or payment provider. | Add trusted identity, database-backed subscription records, verified billing webhooks, server-side checks on each paid API, and an account portal. |
| P1 | Background scanning and delivery | The current scan requires a person to open the page. | Schedule bounded scans, deduplicate alerts, track delivery state, and add email/push only after opt-in and a valid signal ledger. |
| P1 | Daily home workflow | Returning users need a fast reason to open the app. | Add saved screeners and layouts, previous-close changes, “what changed since yesterday,” and an activity inbox linked to chart evidence. |
| P1 | News and economic calendar | The current news area is a source-status placeholder. | Add a provider with attribution and publish times; connect events to assets and chart windows before offering sentiment summaries. |
| P2 | Portfolio/risk context | The new Financial Check is a single-plan calculator. | Add account currency, contract size, fees, open-position exposure, correlation, and portfolio-level risk before suggesting sizes. |
| P2 | Community and education | A community without identity or moderation would be fragile. | Add profiles, content rules, reporting/moderation, and verified educational articles with progress tracking. |

## Current design and data boundaries

- Existing UI patterns adapted from NameThatUI include disclosures, badges, a mobile navigation drawer, skeleton loading, callouts, and focused dialogs. The visual treatment uses original Nugaom colors and assets.
- Depth responds to pointer movement and respects reduced-motion preference.
- No price or win-rate claim is produced when a provider is unavailable. DEMO plans and historical rows remain labeled.
- Guest access is real server-enforced access control for the new scan endpoint, but there is no authenticated account tier yet.
- The Settrade connection was observed returning `AUTH_FAILED` on this date. The new daily scan reports this as a single source error before fetching individual symbols.
