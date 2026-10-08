# Phase 2: read-only Vantage MT5 market bridge

This adds market ingestion, authenticated pairing, and a Forex-only UI adapter. It does **not** read broker credentials, account login numbers, balances, positions, orders, or trade history. It does not place trades. Existing membership/LINE authentication and every shared market endpoint remain unchanged.

## Mac requirement and verification status

Use the full MT5 Desktop terminal with MetaEditor/Expert Advisors. The iPhone/iPad application running on an Apple Silicon Mac cannot host this EA. The development Mac now has the full Wine-based Desktop terminal installed.

On 2026-10-07, `connector.mq5` was compiled with the installed MetaEditor on that Mac: **0 errors, 0 warnings** (`X64 Regular`). The source and compiled EA were placed in the terminal's `MQL5/Experts/Nugaom` folder. This verifies compilation, not terminal ingestion. At the latest check, there was no active web pairing and no actual terminal packets; attachment, WebRequest configuration, symbol/spec comparison and broker clock offset still require verification in MT5.

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

Server names must exactly match MT5. Do not use wildcards. The current user's confirmed demo server is `VantageMarkets-Demo`; no account login is required by this bridge.

Local development: `npm run dev -- --hostname 127.0.0.1 --port 3100`. Open `http://localhost:3100/forex`, choose **MT5 connection**, click **สร้างกุญแจเชื่อม Vantage MT5** once. The UI starts the local session automatically before pairing. The development-only session is an expiring, random HttpOnly/SameSite=Strict cookie scoped to the Forex API. Keep the development server bound to loopback.

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

On 2026-10-08 the local-file variant compiled in the installed MetaEditor with **0 errors, 0 warnings** and was installed alongside the original EA. Browser integration verifies synthetic file → API → UI ingestion, acknowledgements, owner isolation, refresh, mobile and revocation. Actual MT5 export still requires attaching the EA and confirming the terminal universe.

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
