# Unified app integration · 2026-10-14

The main app now serves the Command Center and receiver at **port 3000**, with the existing LINE login and a separate Forex database. The original pilot connection and its 1,268-symbol snapshot stay in the older checkout. Re-pair on `/forex` under your LINE member; load the newly generated preset/channel in the EA. See [the integration report](../../docs/forex-command-center-integration-2026-10-14.md) for validation and remaining limits.

Main's anonymous pilot mode is disabled. Development loopback HTTP permits member pairing; the optional `FOREX_MT5_MEMBER_LOCAL_FILES=true` plus the configured absolute Files path permits member-owned Mac file pairing. Both local file modes remain disabled in production. On Cloudflare/D1 the receiver explicitly reports unavailable until its Node SQLite runtime is adapted. The historical port 3100/local-session instructions below describe the earlier separate pilot.

# Customer self-service pilot · 2026-10-08

Version **2.20** adds Mac/Windows onboarding, client-generated MT5 presets, a compiled EA download, an optional customer file relay, current broker-clock observations, and safe retry receipts. These changes stay inside the dedicated Forex components/API/bridge. No shared workspace, market, membership, LINE auth, admin, Auto Pick, deployment configuration, or D1 migration changes.

## Current operational status

- The local receiver is running on `http://localhost:3100`, with the **19 exact server labels** shown in the operator's screenshot. The operator confirmed using only those entries; the `Live 21` suffix is a server label, not the total count. No missing numbers are invented. The catalog is `vantage-servers.mjs`; production must explicitly configure its allowlist.
- Actual MT5 ingestion of **1,268 symbols** was verified before this update. Both v2.20 EA variants compile in the installed Mac Wine MetaEditor with **0 errors and 0 warnings**. Reload is needed for current-clock observations and actual price verification. This does not imply real Windows terminal verification or deployment of the customer service.
- The release has **no public HTTPS address, production host/persistent volume, or configured LINE login in this checkout**. Customers on other computers cannot connect to this localhost receiver. Customer controls/presets/relay are implemented, but public customer operation is not active yet.

## Customer setup

On the Forex MT5 panel, choose **Mac** or **Windows** and the exact Vantage server. Sign in with the existing LINE flow on the deployed site. Select direct EA/WebRequest or the customer file relay, create a key, and download the ready `.set` preset. The preset is UTF-16 LE with BOM and CRLF for MT5 Inputs → Load. It binds to the server selected at key creation; changing the dropdown later cannot change that preset. No broker password or login number is requested.

The key permits market ingestion for seven days. It is displayed once, kept only in the mounted panel's memory, and stored hashed at the receiver. The downloaded HTTP preset or relay JSON contains the customer's upload key and should be kept private. Keys never enter URLs, logs, download endpoints, or shared release artifacts. Creating a new key replaces the owner's prior key; revocation stops receiving and deletes their bridge data immediately.

Download the compiled `NugaomReadOnlyBridge.ex5` from the panel, put it in **MT5 → File → Open Data Folder → MQL5 → Experts**, Refresh Navigator, attach to one chart, and load `NugaomMT5.set`. A `.mq5` source download is retained for MetaEditor compilation on terminals incompatible with the supplied X64 build. Use full MT5 Desktop with Expert Advisors; an iPhone/iPad app on Mac cannot run this EA.

### Direct EA

Allow WebRequest to the site origin under **Tools → Options → Expert Advisors**, then load the preset. This avoids typing the endpoint/key in Inputs, but MT5 still requires the allowed URL. Double-click the new URL row before typing; if the Wine URL field remains unusable, choose the file relay.

### Customer file relay (Mac and Windows)

The panel's **ส่งผ่านไฟล์ · ไม่ใช้ช่อง URL** option uses the same EA with `LocalFiles=true`. It provides a channel preset (no plaintext upload token in the EA), a private `NugaomRelay.json` containing the key and HTTPS destination, and a downloadable ZIP with the EA, a standalone Node relay, Mac/Windows launchers and instructions. **Node.js 22+ must be installed separately**. The launcher is a pilot utility, not a signed/notarized desktop installer.

Start the relay on the same customer computer as MT5 and select the downloaded JSON and the exact `MQL5/Files/NugaomBridge` directory. It reads only that channel's packet and sends it to the configured HTTPS receiver; it never listens on a public port or reads account/password data. Redirects are forbidden, files and configs are bounded, symlink input is rejected, and replies are replaced atomically without the key. Network failures retry without advancing the EA. Identical last-packet retry receipts prevent a lost HTTP response from corrupting sync/clock observations; different or older replays still fail. Open MT5 and the relay while using the service.

This customer transport differs from the existing developer-only same-computer bridge. The latter still requires the local Forex page to be open and remains disabled in production. The customer relay posts to HTTPS and works independently of browser polling once paired.

## Clock and price behavior

`AutoDetectServerTime=true` is the default. The EA reports UTC (`TimeGMT`), estimated broker current time (`TimeTradeServer`), fresh last broker tick (`TimeCurrent`), and the offset it used. The receiver requires three compatible observations spanning at least ten seconds, with fresh ticks, a quarter-hour offset within ±14 hours and a small clock residual. Its ACK supplies the offset. Closed markets/stale ticks pause price export; an offset change clears caches and starts observation again. Clock state is owner-scoped and stored only in dedicated Forex SQLite tables.

`TimeTradeServer` and `TimeGMT` depend on the computer clock. Packet UTC tolerance and the fresh broker tick corroborate the current estimate; this is **not independent broker attestation or historical timezone verification**. To avoid guessing past DST, auto-mode exports only closed candles whose opening time is after the start of the observed offset period, up to the existing 24-hour window. First candles appear after a newly formed bar closes, so long timeframes and RSI/MACD need time to accumulate enough bars. The manual offset input remains a compatibility option for explicitly verified operator clocks; customers should retain auto mode.

References: [TimeTradeServer](https://www.mql5.com/en/docs/dateandtime/timetradeserver), [TimeCurrent](https://www.mql5.com/en/docs/dateandtime/timecurrent), [TimeGMT](https://www.mql5.com/en/docs/dateandtime/timegmt).

## Public service release requirements

The current dedicated bridge uses Node and its own persistent SQLite database; the main project's Cloudflare/D1 deployment plan and migrations remain unchanged. Do not deploy this receiver as an ephemeral Worker or set its path to the membership database. A public release needs an agreed Node host with persistent storage and a stable HTTPS origin, or a separately authorized Forex storage/runtime adaptation for Cloudflare. No paid resource, public tunnel, DNS, or auth callback has been created or altered by this update.

Use the existing deployed app's LINE credentials and callback configuration, not a development bypass. Set `APP_ORIGIN` to its exact HTTPS origin; pairing refuses missing public origin and production never permits local sessions/file imports. Keep the same-origin CSRF and per-member connection isolation. Use an absolute dedicated `FOREX_MT5_DATABASE_PATH` on durable storage and set `FOREX_MT5_PERSISTENT_STORAGE=true` only after storage is provisioned. This flag is an operator preflight assertion, not a filesystem durability guarantee.

Generate the explicit server list from `VANTAGE_SERVER_CATALOG.join(',')`. Run `NODE_ENV=production node --env-file=<deployment-env> src/forex-mt5/customer-preflight.mjs` before release. Its read-only, secret-free report requires HTTPS, known exact server labels, existing LINE config, persistent Node storage and disabled development shortcuts. Passing it does not replace DNS/TLS/login/member-isolation tests, native Mac/Windows customer ingestion, restart persistence and backup restore verification.

Main's `npm run check:production` also checks these MT5 prerequisites when `FOREX_MT5_ENABLED=true`. The member backup command does not back up the separate Forex database. Set `FOREX_MT5_BACKUP_RECOVERY_CONFIRMED=true` only after an offsite encrypted backup and a restore of that database have actually been verified; the flag itself does not perform a backup.

## Validation for this update

```sh
node --test src/components/forex/forex.test.mjs src/components/forex/connection-setup.test.mjs src/forex-mt5/bridge.test.mjs src/forex-mt5/local-files.test.mjs src/forex-mt5/customer-relay.test.mjs src/forex-mt5/customer-preflight.test.mjs
NUGAOM_REVIEW_MODE=true npm run build
```

The source-scope assertion compares protected files with baseline `cf74b0d7e4b5e255ba7646e4b3b6ec48dd79a82e`. New tests cover preset binding/encoding/injection, the 19 screenshot labels, clock readiness/offset changes/historical limits/privacy, exact retry receipts, customer relay errors/retries/symlinks/expiry, and release checks. Read-only local API checks confirm anonymous owner data is absent and downloaded source/EA/ZIP match the release bytes. This is API/build verification; the prior localhost browser URL-policy rejection was not bypassed. Native current quotes/candles after reloading the updated EA and physical Windows testing must be reported separately.

---

The following records the completed Phase 2 baseline and its earlier manual-clock transport. The customer pilot behavior described above supersedes its installation/clock instructions.

# Phase 2: read-only Vantage MT5 market bridge

This adds market ingestion, authenticated pairing, and a Forex-only UI adapter. It does **not** read broker credentials, account login numbers, balances, positions, orders, or trade history. It does not place trades. Existing membership/LINE authentication and every shared market endpoint remain unchanged.

## Mac requirement and verification status

Use the full MT5 Desktop terminal with MetaEditor/Expert Advisors. The iPhone/iPad application running on an Apple Silicon Mac cannot host this EA. The development Mac now has the full Wine-based Desktop terminal installed.

On 2026-10-07, `connector.mq5` was compiled with the installed MetaEditor on that Mac: **0 errors, 0 warnings** (`X64 Regular`). The source and compiled EA were placed in the terminal's `MQL5/Experts/Nugaom` folder. This verifies compilation, not terminal ingestion. As of 2026-10-08 actual Vantage terminal ingestion is verified: company `Vantage Markets (Pty) Ltd`, server `VantageMarkets-Demo`, **1,268 distinct broker symbols** committed atomically after all thirteen chunks, at `2026-10-08T09:09:53.251Z`. Categories: FX 65, Metals 7, Indices 19, Energy 5, Commodities 12, Crypto CFDs 63, Share CFDs 953, ETFs 107, Bonds 7, Unclassified 30. Actual heartbeats continue after the commit. Quotes/candles remain intentionally disabled (`ServerUtcOffsetMinutes=10000`) until the broker clock offset is independently confirmed. Full specification comparison and quote/candle matching against the terminal remain outstanding. The operator independently confirmed that the actual Forex MT5 connection panel displays **1,268 synced instruments**. This completes native terminal → file → API/database → displayed count verification. The browser tool was blocked by its URL security policy, so the actual UI confirmation came from the operator rather than automated observation.

The local web server had stopped and was restarted. The operator re-paired and replaced the EA channel. Native v2.14 then changed its revision while awaiting part 0 acknowledgement; the backend correctly withheld that incomplete snapshot. Version 2.15 preserves the revision during first-chunk acknowledgement. Version 2.16 additionally resets export state on init and reports its version; it is compiled and installed, and the native journal confirms `connector version 2.16` followed by `READY`. The complete actual snapshot above verifies recovery after reload, separately from the synthetic thirteen-part regression.

The web build, protocol/store tests, and HTTP/browser integration with **synthetic packets** are verified. A broker-company string plus an exact server allowlist is a policy check on a trusted connector; it is not cryptographic broker attestation.

Official references:

- [MetaQuotes: MT5 Desktop installation on Mac](https://www.metatrader5.com/en/terminal/help/start_advanced/install_mac)
- [WebRequest: EA/script restriction and allowed URLs](https://www.mql5.com/en/docs/network/webrequest)
- [SymbolInfoSessionTrade](https://www.mql5.com/en/docs/marketinformation/symbolinfosessiontrade)
- [TimeCurrent: broker server clock](https://www.mql5.com/en/docs/dateandtime/timecurrent)
- [CopyRates](https://www.mql5.com/en/docs/series/copyrates)

## Configuration

Defaults are disabled and no server is trusted implicitly. Set only these Forex-specific variables in an ignored `.env.local`, or your Node deployment's environment:

```dotenv
FOREX_MT5_ENABLED=true
FOREX_MT5_VANTAGE_SERVERS=VantageMarkets-Demo
FOREX_MT5_DATABASE_PATH=data/forex-mt5.sqlite
# Local development only; ignored when NODE_ENV is production:
FOREX_MT5_LOCAL_MODE=true
```

Server labels must exactly match the backend allowlist. The EA compares the terminal name with that approved label after trimming leading/trailing whitespace and ignoring letter case, then emits the approved label. No wildcard, substring or suffix match is allowed; Demo and Live remain distinct. The current user's confirmed demo server is `VantageMarkets-Demo`; no account login is required by this bridge.

Local development: `npm run dev -- --hostname 127.0.0.1 --port 3100`. Open `http://localhost:3100/forex`, choose **MT5 connection**, click **สร้างกุญแจผ่าน WebRequest** once. The UI starts the local session automatically before pairing. The development-only session is an expiring, random HttpOnly/SameSite=Strict cookie scoped to the Forex API. Keep the development server bound to loopback.

Production: an existing signed-in LINE member is required to pair/read their connection; pairing requires HTTPS and a same-origin POST. There are no changes to membership rights or auth implementation. Local-session requests are forbidden in production. Only one active connection is retained per owner; generating a new key revokes the previous key. Tokens expire after seven days and can be revoked immediately. Only their SHA-256 hashes are stored. Never share a pairing key; it is permission to upload market data to your workspace, not a broker password. Do not include the key in a URL or terminal logs.

This is a **Node runtime with persistent SQLite storage**, separate from the shared membership database and D1. A stateless/edge deployment is not supported by this store. Production must supply a persistent volume, backups and a single shared database file for its Node processes. No D1 schema/migration or deployment configuration is modified. Do not set this database path to the existing application database.

## Mac alternative: same-computer file transport

If the Wine-based MT5 URL field is unusable, use the **เชื่อมผ่านไฟล์บน Mac** button in MT5 connection. This does not use WebRequest, DLLs, or trading permission. The official [MQL5 file sandbox](https://www.mql5.com/en/docs/files/fileopen) permits the EA to export files under `MQL5/Files`.

Set `FOREX_MT5_LOCAL_FILES_PATH` in the ignored development environment to the **absolute** host path of the terminal's `MQL5/Files/NugaomBridge` directory. This capability is disabled in production and when local mode is off; callers cannot supply a filesystem path. The development server must remain on loopback.

1. Click **เชื่อมผ่านไฟล์บน Mac** once. This replaces the owner's previous pairing and displays a `LocalChannel` identifier.
2. Add the new EA to a chart of `VantageMarkets-Demo`, with `LocalFiles=true` and `LocalChannel` matching the web UI. `BridgeToken` may be empty. The installed `NugaomLocalFileBridge` variant defaults `LocalFiles` to true.
3. Keep the Forex page open. Its normal polling imports the closed packet file and writes an acknowledgement before the EA advances to the next universe chunk. An atomic whole universe appears after every chunk has arrived. Quotes/candles still require a verified server UTC offset; leave `ServerUtcOffsetMinutes=10000` for metadata-only verification.
4. Restarting the web server loses the in-memory file session. Click the file button again and replace the EA's channel. Revocation stops importing and clears the owner's connection. Pausing browser polling eventually shows STALE; this transport is deliberately tied to the open local workspace.

The ingestion credential is retained only in server memory; packets, acknowledgements, UI and database never contain its plaintext. Channel filenames contain no account identifier. LocalChannel is an opaque routing identifier within the operator's trusted local Files directory, not cryptographic EA attestation. File writers on that computer are trusted. The same strict Vantage/server/schema, clock, sequence, privacy, atomic-chunk and rate checks as the HTTP bridge apply. Input is limited to 512 KB, regular files, and non-symlink final paths; no broker/account credentials are read.

Actual MT5 diagnostics showed the native server name as `  Vantagemarkets-Demo`; version 2.12 normalizes only padding/case for matching the approved `VantageMarkets-Demo` label. The EA emits setup reason codes (server/company mismatch, channel length/format, transport, polling, Strategy Tester, timer) without logging a token or account identifier. Version 2.13 additionally logs only the public terminal company label when company validation fails; the company rule has not been relaxed. On 2026-10-08 diagnostic version 2.16 and the local-file variant compiled in the installed MetaEditor with **0 errors, 0 warnings** and was installed alongside the original EA. Browser integration verifies synthetic file → API → UI ingestion, acknowledgements, owner isolation, refresh, mobile and revocation. Actual thirteen-part ingestion and the 1,268-symbol atomic universe commit are verified. Live prices/candles and full terminal spec comparison remain pending.

## Install and verify the EA

1. Download `/api/forex/mt5/connector` or use `connector.mq5` in this directory. Open it in MT5 Desktop's MetaEditor and compile it.
2. Add the EA to a chart of the Vantage account. No trading permission is needed by its code; it has no order API calls.
3. In Tools → Options → Expert Advisors, allow WebRequest to the web application's origin. WebRequest cannot run in the Strategy Tester.
4. Set `Endpoint` to the application's `/api/forex/mt5` URL, `BridgeToken` to the one-time pairing key, and `ExpectedServer` to the approved exact server name. HTTP is accepted only for localhost/127.0.0.1; use HTTPS remotely.
5. Initially leave `ServerUtcOffsetMinutes=10000`. This deliberately sends **universe metadata only**, plus heartbeats. Confirm that exact symbol names/counts and specifications match the terminal before enabling quotes.
6. Confirm the broker-server clock's UTC offset and set it in minutes. This enables Bid/Ask and the selected chart's closed OHLC bars. The frontend shows normalized UTC chart time and the supplied offset. Do not infer a historical offset from the current server clock across daylight-saving changes.
7. Compare Bid/Ask, spread in points, symbol digits, and closed bars against MT5. Test stopping the EA (>30 seconds produces STALE), account/server switching, revocation, and restarting/re-pairing. Do not mark live verification complete until these checks pass.

The EA normalizes candles with the **explicit operator-supplied UTC offset**, limits history to the last 24 hours, and emits closed bars only. Around a DST change, pause quote/candle export and re-confirm the offset; older bars spanning a different offset must not be used. Weekend/closed markets may have no bars in this window. Daily/4H history is intentionally short; RSI/MACD are absent until enough bars arrive. The Forex-only chart respects broker `digits`/`point`; the existing shared chart is untouched.

Quotes are for the requested chart symbol and up to 99 other Market Watch symbols. It does not subscribe every one of thousands of symbols. The full symbol universe is refreshed at start, on count change, and about every 15 minutes. Folder-based category classification is best effort; unknown assets remain **Unclassified**. Canonical mapping is supplied only for an exact three-letter base/profit pair matching the terminal symbol. Suffixes and unfamiliar names are preserved rather than guessed. Sessions retain broker-server wall-clock intervals and never claim a UTC timezone.

## API and isolation

- `GET /api/forex/mt5?symbol=<exact broker symbol>&frame=15m|1h|4h|1d`: owner-scoped state, universe, cached quotes and matching selected bars. Guests receive no connection data. Selecting a known symbol/frame updates the connector's next read request.
- Same-origin browser `POST`: `action=local-session` (development only), `pair` with an allowlisted `server`, or `revoke`. A token is returned once on pairing, never by a GET.
- Connector `POST` with `Authorization: Bearer <pairing key>`: strict schema/version, exact server/company checks, UTC packet timestamp tolerance, increasing sequence, 512 KB body cap, 100-symbol chunks, and bounded per-connection rate. Unknown fields (including password/login/account/position fields) are rejected. No CORS is opened.
- Atomic multipart symbol snapshots: the old snapshot remains visible until every chunk of the next revision arrives. Duplicate symbols and inconsistent revisions are rejected. Accepted completed chunks can be retried safely if the response was lost. Quotes/charts are cleared on each complete universe replacement.
- A 30-second connector gap and aged individual market quotes are marked stale. A browser fetch failure also marks cached data stale. No synthetic price/AI/account data is substituted in MT5 mode. Without a snapshot, the unchanged 19-symbol Guest/Demo universe remains available.
- Scanner search, nine categories plus Unclassified, favorites, and 100-row pagination support large universes. Demo account/AI/calendar/alerts remain separate presentation tools; Phase 2 does not deliver live AI or account/alert feeds.

## Validation

```sh
node --test src/components/forex/forex.test.mjs src/forex-mt5/bridge.test.mjs src/forex-mt5/local-files.test.mjs
npm run build
# With a local development server, Playwright and Chrome:
PLAYWRIGHT_CHANNEL=chrome node src/components/forex/forex.browser.mjs
PLAYWRIGHT_CHANNEL=chrome node src/forex-mt5/bridge.browser.mjs
```

`PLAYWRIGHT_MODULE` can point to an installed Playwright ESM entry. The integration test creates isolated test owners and posts explicitly synthetic 305-symbol/quote/candle fixtures, then revokes them. It does not log pairing keys or broker credentials. It checks pairing/CSRF, server policy, owner isolation, atomic sync, pagination, quotes, frame requests, single-bar charts, mobile layout, revocation, and 19-symbol fallback. The existing Forex browser test also exercises all ten views and verifies `/thai`, `/dr`, `/tfex`, and `/us` still render the shared workspace.

The source-scope assertion compares protected source/deployment files against baseline `cf74b0d7e4b5e255ba7646e4b3b6ec48dd79a82e`; allowed additions are only the Forex component directory, `/forex` page, `/api/forex/mt5` routes, and this dedicated bridge directory.
