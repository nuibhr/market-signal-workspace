# Forex Command Center integration — 14 October 2026

## Result and source

The main app now renders the dedicated Forex / CFD Command Center at `http://localhost:3000/forex`. It includes Overview, Scanner, Advanced Chart, Vantage MT5 connection, Positions, Risk Management, AI Analysis, Trade Journal, News & Calendar and AI Alerts. Existing market navigation links to this same route.

Imported from the local chat **Build Forex Command Center Phase 1**, checkout `2026-10-07/referenced-chatgpt-conversation-this-is-an/work/market-signal-workspace`, branch `forex-phase-1`, HEAD `ad82a91`, including the uncommitted v2.20 customer setup/relay/clock work. The original checkout, dirty files, MT5 installation and pilot database remain intact. This is a scoped integration of the final Forex files into current main, rather than replacing main with the older checkout.

Imported paths: `src/components/forex/`, `src/forex-mt5/`, `src/app/api/forex/mt5/` and `src/app/forex/page.jsx`. The compiled EA and customer relay ZIP contain no customer configuration file, pairing preset or database. Both were copied unchanged from the existing release artifacts.

## Integration behaviour

- Forex uses the existing LINE session. The page shows the signed-in viewer and links to Account and Community. Only display name and profile image are passed to its client component; no LINE ID, portfolio hash, session token or broker account information is serialized.
- The shared API handlers check current member sessions for pairing and private views. A normal member session takes precedence over a leftover pilot cookie from the old localhost app. Logout removes browser access; stored connector data stays scoped to the member. Explicit revocation invalidates the upload key and clears that owner's bridge data.
- Local Node development accepts loopback HTTP as a transport while still requiring LINE login. Anonymous pilot sessions remain off in the main app. The optional Mac file transport uses the previously configured MT5 Files directory, requires LINE, and is disabled in production.
- The ignored local environment received only Forex configuration: enabled receiver, the existing 19 exact Vantage server labels, a separate Forex SQLite path and the member-only local file option. Existing LINE/provider credentials, membership database paths, launch/scanner flags and public callbacks were not replaced.
- The Forex receiver refuses the membership database path. It also refuses Cloudflare/D1 storage even if `FOREX_MT5_ENABLED` is accidentally set. The Cloud bundle can render the dashboard, but live MT5 reception still requires persistent Node storage or a future storage/runtime adaptation.
- Download tracing includes the existing `.mq5`, `.ex5` and relay ZIP. Their HTTP responses match the imported bytes.
- New presets use the current app endpoint, `http://localhost:3000/api/forex/mt5` locally. The older EA's built-in default endpoint is superseded by the downloaded preset. Keys are generated per member and never copied from the pilot database.

## Existing MT5 connection

The earlier 1,268-symbol Vantage sync belongs to the separate pilot connection/database. It was not copied to an arbitrary LINE member or presented as a fresh sync in main. To connect on the unified app:

1. Sign in on `/account`, then open `/forex` → **MT5 connection**.
2. Choose the exact Vantage server and generate a new pairing on this page. On this Mac, the **เชื่อมผ่านไฟล์บน Mac** option is available to signed-in members.
3. Download the new preset and load it in the EA. For local file transport, update its LocalChannel using the new pairing. For direct EA transport, the preset supplies the main app's endpoint and key.
4. Verify actual instrument sync and current prices/bars after re-pairing. No live terminal operation, account switch or order execution was performed during this integration.

The old pilot checkout/server is available for continuity; the main app no longer needs its UI to display the new dashboard. Existing pilot keys/channels are not automatically migrated.

## Validation

- **153 tests/subtests passed, 0 failed**: the existing 111-test suite plus 42 Forex/bridge tests. Coverage includes native local D1 membership/community/coach/cutover, AutoPick lifecycle and coverage, member-bound Forex pairing, real fixture session revocation, member isolation, Mac file ownership, protocol/retry/clock validation, HTTPS enforcement and refusal to open a store on D1 or the membership database.
- Next isolated production build and Cloudflare packaging passed. Diff checks passed. All 220 pre-existing tracked files under `src/` and `deploy/`, excluding the intentionally replaced Forex page, match main `cd5bbd5` byte-for-byte.
- Live local HTTP: `/forex`, `/thai`, `/dr`, `/tfex`, `/us`, `/account` return 200; anonymous `/community` returns 307 to `/account`. The Forex page returns the Command Center title, LINE/Community links and Demo label.
- `/api/forex/mt5` returns 200 with private/no-store, enabled receiver, 19 configured servers, main endpoint, disabled anonymous pilot and no anonymous snapshot. Anonymous pair/file requests return 401; local-session returns 403.
- Connector source, compiled EA and relay ZIP return 200 with matching source bytes and are included in the production trace.
- Test members, packets and sample trades exist only in isolated fixtures. No real pairing, customer trade record or synthetic price was inserted into customer storage.

No localhost browser automation was retried after the previous policy block, and no current visual/mobile/real-device acceptance is claimed. No cloud deploy or D1 migration was performed.

## Remaining limits

Demo Preview retains the existing prominent Demo labels and example prices/account values/AI/calendar panels. Guest/no-feed removes those values. A connected MT5 universe uses received broker quotes and closed bars; it does not make the account/AI/calendar/alerts panels live. Forex AutoPick and trading execution remain unavailable.

Public MT5 operation still needs an approved HTTPS Node deployment with persistent dedicated storage, backups, and real Mac/Windows/LINE verification, or an authorized receiver adaptation for the main Cloudflare deployment. Passing Cloud packaging does not certify remote MT5 reception. Native Vantage current price and candle validation remains pending after pairing on the main app.
