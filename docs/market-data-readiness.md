# Market data readiness review

**Reviewed:** 24 September 2026  
**Source project:** `nuibhr/noom-nakaom-scanner` (`main`)  
**Purpose:** identify existing adapters and known gaps before reusing any provider in `market-signal-workspace`.

## Executive finding

The old codebase contains real server-side Settrade/Trinity and TFEX Open API adapters. The code has market-specific access checks and deliberately refuses to invent TFEX futures candles when a verified time-series endpoint is unavailable. It also contains Yahoo Finance request code; that provider was not called during this review and must remain disabled in the new project until the owner explicitly chooses it. No Google Finance integration was found in the scanned application code.

**Current Vercel credential state is unverified.** The connected Vercel integration lists the `BUNPOT` team but returns no projects. Fetching the old production hostname is blocked by Vercel Authentication, and the Vercel CLI is not installed in this environment. Therefore this review confirms code paths and required key names, not the presence, validity, or data entitlements of secrets in the Vercel project.

## Provider and market matrix

| Market | Existing code path | What code supports | What remains unverified |
|---|---|---|---|
| SET / mai | Settrade / Trinity server adapter | The app has a Settrade login/signature client and a scoped capability probe. Some Thai equity functions use Settrade quotes and daily candles. | A verified general SET/mai instrument-universe adapter and all market entitlements. The capability probe intentionally returns `ENDPOINT_NOT_CONFIRMED` for these markets even when it finds matching key names. Intraday bars are not proven by the inspected sample path. |
| DR | Settrade quote/daily-candle path; DR Tracker service | DR scanner code only accepts results whose source is `settrade`; it does not use a Yahoo fallback for the DR picks view. Daily candles and quote calls exist for selected symbols. | Full DR coverage, underlying-equity pricing and FX conversion rights. A `DR_TRACKER_SERVICE_TOKEN` points to a separate service; the service's own upstream/data rights need confirmation. |
| TFEX | TFEX Open API adapter | Server-side signed auth, a read-only quote endpoint, quarterly-contract helpers and TFEX dashboards exist. | Historical/intraday bars are explicitly unavailable in `getTfexTimeSeries`; therefore this adapter alone cannot yet drive a true Lightweight Charts candle series for TFEX. Bid/offer, stream/MQTT and full symbol-universe support are also not confirmed. |
| International equities | Yahoo Finance code in the old app | The old code constructs Yahoo chart requests for international/US symbols. | User has asked us not to connect Yahoo Finance yet. No alternative authorized foreign-equity provider was identified in the inspected implementation. |
| Forex pairs | No verified source found in the inspected server market-data paths | No ready provider/entitlement was established by this source review. | Provider, symbols, latency, bar history, licensing and API access. |
| Google Finance | No implementation found | None. | User has asked us not to connect it yet. |
| Gold / Silver / SET50 TFEX contracts | TFEX quote path and contract utilities | Product screens and quote/data structures exist. The TFEX capability probe uses a read-only quote. | Confirm which exact contract families have active permissions; historical/intraday candles are still unavailable in the adapter. Do not use spot gold or a cash index as a futures substitute. |

## Credential names referenced by the old server

The code reads credential values only on the server. The names below were discovered in source; **their Vercel values were not read**.

- General Settrade adapter: `SETTRADE_BROKER_ID`, `SETTRADE_APP_CODE`, `BROKER_APP_ID` (fallback `SETTRADE_APP_ID`), `BROKER_API_SECRET` (fallback `SETTRADE_APP_SECRET`).
- TFEX adapter: `TFEX_APP_ID`, `TFEX_APP_SECRET`, `TFEX_BROKER_ID`, `TFEX_APP_CODE`.
- Stock capability inventory scans configured key names beginning with `SETTRADE_`, `TRINITY_`, `STOCK_`, `EQUITY_`, or `DR_`.
- DR Tracker internal-service auth: `DR_TRACKER_SERVICE_TOKEN`.
- Application/deployment dependencies also include database, Clerk, cron, Google Sheets/Form and built-in service keys. These are not market-price feeds.

The checked-in `.env.example` does not list the TFEX or primary Settrade key set that the implementation expects. This makes deployment setup difficult to audit and should be corrected with **names and descriptions only**, never example values copied from Vercel.

## Read-only boundaries in the old code

- The capability probe is documented as blocking account, portfolio, balance, order, execution and streaming-worker operations.
- The TFEX adapter allowlists login and one market-data quote path; it exposes no order, portfolio, balance or trade operations.
- The sample `system.settradeStatus` endpoint is public but may make a live Settrade quote request and a daily-candle request when a sample symbol is configured. It does not return secret values.
- The authenticated admin capability query returns configured key names and market status; the probe can call the TFEX quote endpoint. It should only be invoked as an intentional read-only entitlement check.
- No production probe was run from this environment because the Vercel project is inaccessible through the connected Vercel integration.
- No Yahoo Finance or Google Finance network request was made.

## Important implementation details

1. TFEX candles are not ready yet. `getTfexTimeSeries` returns an explicit unavailable state, with a code comment requiring a verified endpoint before showing a series. Keep that behavior; do not fabricate bars or substitute a cash/spot series.
2. The existing Settrade daily candle path requests `interval=1d`. That is useful for daily analysis, but does not establish intraday history or streaming for a live chart.
3. `server/stockOpportunities.ts` and `server/marketData.ts` contain Yahoo chart requests. Do not reuse their provider branch in the new app by accident.
4. The old source has research notes mentioning Twelve Data and Stooq. Those notes describe possible public/demo data sources and warn about latency; they are not evidence that production credentials, exchange permissions or a licensed feed are active.
5. A provider API key alone does not prove the app may redistribute quotes, candles, or derived data to all users. Confirm each provider's current contract covers the planned display, storage/history, user count, derived products and production/commercial use. Settrade's published terms state that third-party data may be subject to the relevant provider's own terms: [Settrade third-party data terms](https://www.settrade.com/th/thirdparty-terms).

## Vercel access result

- Connected Vercel team visible to this session: `BUNPOT`.
- Projects returned for that team: zero.
- Old app hostname found in the repository's production smoke workflow: `noom-nakaom-scanner-bunpot.vercel.app`.
- Direct HTTP request reached a Vercel Authentication page rather than the application's health endpoint. The Vercel connector also reported that the deployment was not found or this connection lacks access.
- Vercel CLI is not installed here.

To verify the real credentials without exposing their values, connect the Vercel account/team that owns `noom-nakaom-scanner` to the available Vercel integration (or grant this session project access). Then run the old app's existing sanitized capability check and report only configured/authenticated/quote-supported status by market. Do not paste keys into chat or commit them.

## Recommended integration order

1. Confirm Vercel project access and inspect only whether expected key names exist for Preview/Production. Never print the secret values.
2. Ask the provider/broker to confirm display/storage rights per product and market.
3. Run the existing read-only capability probe for SET, mai, DR and TFEX. Record status and permitted operations only.
4. For each market, verify quote and bar support independently. A working latest quote is not a chart-history entitlement.
5. In the new app, create an adapter per source and map its data into a common candle schema with `instrumentId`, `venue`, `source`, `observedAt`, `receivedAt`, `timeframe` and a `live | delayed | stale | unavailable` state.
6. Add Yahoo Finance or Google Finance only after a separate explicit decision, licensing review and provider test. They are not part of the current integration plan.
