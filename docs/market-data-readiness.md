# Market data readiness review

**Reviewed:** 24 September 2026  
**Source project:** `nuibhr/noom-nakaom-scanner` (`main`)  
**Purpose:** identify existing adapters and known gaps before reusing any provider in `market-signal-workspace`.

## Executive finding

The old codebase contains real server-side Settrade/Trinity and TFEX Open API adapters. The code has market-specific access checks and deliberately refuses to invent TFEX futures candles when a verified time-series endpoint is unavailable. It also contains Yahoo Finance request code. On 25 September 2026 the owner authorized evaluating Yahoo Finance as a complementary source, but the public chart endpoint still needs a separate rights review before it is used in a published product or a signal-outcome ledger. No Google Finance integration was found in the scanned application code.

**Vercel environment-variable names are now visible in the authenticated dashboard.** The `BUNPOT` team contains the `noom-nakaom-scanner` project. Its Environment Variables page shows the main Settrade and TFEX key names in Production, plus FMP keys in Development, Preview and Production. Secret values were not revealed or copied. This confirms configuration entries exist, but not that they are valid, authenticated, currently used by production, or covered by display/data entitlements. The Vercel API connector still did not enumerate projects, so the dashboard session was used for this names-only check.

## Provider and market matrix

| Market | Existing code path | What code supports | What remains unverified |
|---|---|---|---|
| SET / mai | Settrade / Trinity server adapter | The app has a Settrade login/signature client and a scoped capability probe. Some Thai equity functions use Settrade quotes and daily candles. | A verified general SET/mai instrument-universe adapter and all market entitlements. The capability probe intentionally returns `ENDPOINT_NOT_CONFIRMED` for these markets even when it finds matching key names. Intraday bars are not proven by the inspected sample path. |
| DR | Settrade quote/daily-candle path; DR Tracker service | DR scanner code only accepts results whose source is `settrade`; it does not use a Yahoo fallback for the DR picks view. Daily candles and quote calls exist for selected symbols. | Full DR coverage, underlying-equity pricing and FX conversion rights. A `DR_TRACKER_SERVICE_TOKEN` points to a separate service; the service's own upstream/data rights need confirmation. |
| TFEX | TFEX Open API adapter | Server-side signed auth, a read-only quote endpoint, quarterly-contract helpers and TFEX dashboards exist. | Historical/intraday bars are explicitly unavailable in `getTfexTimeSeries`; therefore this adapter alone cannot yet drive a true Lightweight Charts candle series for TFEX. Bid/offer, stream/MQTT and full symbol-universe support are also not confirmed. |
| International equities | Yahoo Finance code in the old app | The old code constructs Yahoo chart requests for international/US symbols. | The owner now permits evaluating Yahoo, but no redistribution or automated-product right has been confirmed. Webull credentials exist locally but its adapter and display entitlement remain to be verified. |
| Forex pairs | No verified source found in the inspected server market-data paths | No ready provider/entitlement was established by this source review. | Provider, symbols, latency, bar history, licensing and API access. |
| Google Finance | No implementation found | None. | The owner has not authorized this source. |
| Gold / Silver / SET50 TFEX contracts | TFEX quote path and contract utilities | Product screens and quote/data structures exist. The TFEX capability probe uses a read-only quote. | Confirm which exact contract families have active permissions; historical/intraday candles are still unavailable in the adapter. Do not use spot gold or a cash index as a futures substitute. |

## Mapping into the new workspace

The new workspace is currently a static visual prototype with no provider adapter or server runtime. Treat the old project as an adapter reference, not as a drop-in package.

- **Thai equities / DR:** reuse the server-only Settrade auth and quote/daily-candle logic as the starting point for a new provider adapter. The old scanner has selected-symbol support; it does not establish a complete exchange-wide universe or chart-ready intraday history. Keep source, timestamp and freshness metadata attached to every price.
- **TFEX gold / silver / SET50:** the Vercel project contains all four TFEX credential names in Production and the old adapter supports an explicitly read-only quote. It returns unavailable for historical/time-series data, so it cannot yet populate Lightweight Charts candles. Do not draw signals or performance statistics from a synthetic proxy series.
- **International equities:** `FMP_API_KEY` exists in Vercel and in the local `WEBULL.txt`, but no FMP provider call or adapter was found in the scanned application source. The same text file contains Webull app credential fields; no Webull adapter was found either. A configured key is not a connected market feed; implement and verify a provider adapter only after confirming product rights and intended symbols.
- **Forex:** no price-feed adapter was found. `FRED_API_KEY` is present but the inspected code does not use it, and macroeconomic series are not a substitute for a live forex-pair quote/candle feed.
- **Signal ledger / stats:** the prototype demonstrates the desired win/loss presentation with illustrative rows only. Production win rate must be computed from immutable signal records and independently observed prices after the source, resolution, fees and close rules are defined.

Do not copy the old app's whole backend or credentials into the new app. Build small, server-side provider adapters behind one normalized candle contract; keep secrets in the new deployment's own secret store and only move a key after its provider terms and target environment are clear.

## Credential names referenced by the old server

The code reads credential values only on the server. The names below are referenced by source. The browser dashboard confirms the listed Settrade/TFEX keys exist in Production; **their values were not read**.

- General Settrade adapter: `SETTRADE_BROKER_ID`, `SETTRADE_APP_CODE`, `BROKER_APP_ID` (fallback `SETTRADE_APP_ID`), `BROKER_API_SECRET` (fallback `SETTRADE_APP_SECRET`).
- TFEX adapter: `TFEX_APP_ID`, `TFEX_APP_SECRET`, `TFEX_BROKER_ID`, `TFEX_APP_CODE`.
- Stock capability inventory scans configured key names beginning with `SETTRADE_`, `TRINITY_`, `STOCK_`, `EQUITY_`, or `DR_`.
- DR Tracker internal-service auth: `DR_TRACKER_SERVICE_TOKEN`.
- Application/deployment dependencies also include database, Clerk, cron, Google Sheets/Form and built-in service keys. These are not market-price feeds.

Dashboard-only inventory for `noom-nakaom-scanner` (names and environments, no values):

- Production: `SETTRADE_REQUIRE_REALTIME`, `SETTRADE_BROKER_ID`, `SETTRADE_APP_CODE`, `BROKER_APP_ID`, `BROKER_API_SECRET`, `TFEX_BROKER_ID`, `TFEX_APP_CODE`, `TFEX_APP_ID`, `TFEX_APP_SECRET`.
- `FMP_API_KEY` appears in Development, Preview and Production.
- `FRED_API_KEY` appears in Production and Development/Preview.
- `DR_TRACKER_SERVICE_TOKEN` was not visible in the inspected project-variable list. Treat DR Tracker readiness as unconfirmed until checked in the correct environment or service.

Local files inspected by key name only (values were not printed, copied or added to this repository):

- `Downloads/tfex.zip` contains `tfex.env`. It has general Settrade configuration plus broker-login and Telegram credential fields. It does **not** contain the four `TFEX_APP_ID`, `TFEX_APP_SECRET`, `TFEX_BROKER_ID` and `TFEX_APP_CODE` fields required by the old TFEX adapter. Keep this archive out of source control and do not load its account-login fields into the new app.
- The updated `Downloads/tfex.txt` includes `TFEX_APP_ID` and `TFEX_API_SECRET`. The owner confirms `TFEX_API_SECRET` is the same credential intended for the adapter's `TFEX_APP_SECRET` field, so treat it as a naming typo and map it to the canonical name server-side when integrating. The adapter also expects `TFEX_BROKER_ID` and `TFEX_APP_CODE`; generic Settrade fields do not automatically substitute for TFEX-specific keys. This file still contains broker-login and Telegram credential fields; keep it outside source control and do not load those account-login fields into the new app.
- `Downloads/WEBULL.txt` contains `WEBULL_APP_KEY`, `WEBULL_APP_SECRET`, `WEBULL_ENVIRONMENT`, `WEBULL_REGION_ID`, `FMP_API_KEY` and `FRED_API_KEY`. No Webull/FMP/FRED price-feed implementation was found in the scanned source.

The checked-in `.env.example` does not list the TFEX or primary Settrade key set that the implementation expects. This makes deployment setup difficult to audit and should be corrected with **names and descriptions only**, never example values copied from Vercel.

## Read-only boundaries in the old code

- The capability probe is documented as blocking account, portfolio, balance, order, execution and streaming-worker operations.
- The TFEX adapter allowlists login and one market-data quote path; it exposes no order, portfolio, balance or trade operations.
- The sample `system.settradeStatus` endpoint is public but may make a live Settrade quote request and a daily-candle request when a sample symbol is configured. It does not return secret values.
- The authenticated admin capability query returns configured key names and market status; the probe can call the TFEX quote endpoint. It should only be invoked as an intentional read-only entitlement check.
- No live production capability probe was run. Dashboard visibility confirms variable names only; it does not validate credentials or data entitlements.
- A separate read-only login attempt on 25 September 2026 using the general Settrade fields from the local `tfex.txt` returned HTTP 404 at the broker-app login path. No quote or candle request followed. This does not establish the health of the different Vercel Production values.
- No Yahoo Finance or Google Finance network request was made.

## Important implementation details

1. TFEX candles are not ready yet. `getTfexTimeSeries` returns an explicit unavailable state, with a code comment requiring a verified endpoint before showing a series. Keep that behavior; do not fabricate bars or substitute a cash/spot series.
2. The existing Settrade daily candle path requests `interval=1d`. That is useful for daily analysis, but does not establish intraday history or streaming for a live chart.
3. `server/stockOpportunities.ts` and `server/marketData.ts` contain Yahoo chart requests. The SET100/mai opportunity feed currently chooses Settrade and does not fall back to Yahoo. The market overview still requests Yahoo for selected proxy/index items. In the new app, any Yahoo branch must be explicit, marked with its own provenance, and held from public production use until rights are clear.
4. The old source has research notes mentioning Twelve Data and Stooq. Those notes describe possible public/demo data sources and warn about latency; they are not evidence that production credentials, exchange permissions or a licensed feed are active.
5. A provider API key alone does not prove the app may redistribute quotes, candles, or derived data to all users. Confirm each provider's current contract covers the planned display, storage/history, user count, derived products and production/commercial use. Settrade's published terms state that third-party data may be subject to the relevant provider's own terms: [Settrade third-party data terms](https://www.settrade.com/th/thirdparty-terms).

## Vercel access result

- Authenticated Vercel dashboard team: `BUNPOT`.
- The dashboard shows the `noom-nakaom-scanner` project connected to `nuibhr/noom-nakaom-scanner`.
- The Vercel API connector returned zero projects for that team, despite the browser dashboard showing the project; use the dashboard as the source for this names-only inventory until API access is corrected.
- Old app hostname found in the repository's production smoke workflow: `noom-nakaom-scanner-bunpot.vercel.app`.
- Direct HTTP request reached a Vercel Authentication page rather than the application's health endpoint. The Vercel connector also reported that the deployment was not found or this connection lacks access.
- Vercel CLI is not installed here.

To verify credentials without exposing their values, run the old app's existing sanitized capability check and report only configured/authenticated/quote-supported status by market. Do not reveal keys in the dashboard, paste them into chat, or commit them. The probe may perform a read-only TFEX quote request; treat that as a separate, deliberate entitlement check. Never call account, portfolio, balance, order, execution, or streaming-worker operations.

## Recommended integration order

1. Confirm Vercel project access and inspect only whether expected key names exist for Preview/Production. Never print the secret values.
2. Ask the provider/broker to confirm display/storage rights per product and market.
3. Run the existing read-only capability probe for SET, mai, DR and TFEX. Record status and permitted operations only.
4. For each market, verify quote and bar support independently. A working latest quote is not a chart-history entitlement.
5. In the new app, create an adapter per source and map its data into a common candle schema with `instrumentId`, `venue`, `source`, `observedAt`, `receivedAt`, `timeframe` and a `live | delayed | stale | unavailable` state.
6. The owner has explicitly approved evaluating Yahoo Finance as a complement. Keep it as a separately labeled candidate source while checking permissions for automated requests, display and retention. Google Finance remains outside the plan. See [Thai coverage and Investing.com widget decision](thai-market-coverage-and-widgets.md).
