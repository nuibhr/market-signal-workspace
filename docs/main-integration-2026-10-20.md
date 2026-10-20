# Main integration acceptance — 2026-10-20

This release brings the Thai/DR Radar, shared monitor and native/CFD Daytrade work onto the existing main history. It includes the local workflow commit 125b2e1 and the subsequent review fixes. No customer ledger is moved, reset or populated with demonstration trades.

## Correctness and access

- Demo login is disabled for every environment. Existing shared demo sessions are rejected; ordinary LINE sessions retain their existing membership rules. Sessions require a configured secret of at least 32 characters.
- Cash position sizing includes estimated Thai fees inside the risk budget and buying power. Other instrument margin assumptions remain estimates, not broker execution guarantees.
- Official DR metadata checked on 2026-10-20: AAPL80 1,000, NVDA80 200, MSFT80 2,000, TSLA80 5,000, BABA80 100 (9988.HK / HKD), TENCENT80 100 (0700.HK / HKD), in DR units per underlying share. Source: each symbol's SETTRADE overview, including https://www.settrade.com/th/equities/dr/quote/NVDA80/overview . Recheck metadata when the issuer changes conversion terms.
- Radar requires the immediately preceding verified trading session, valid ordered OHLC and at least 75 closed daily bars. Invalid native history falls back to labelled closed historical data. History never authorizes entry into a real forward trade.
- Automatic Fair Price is withheld unless DR, underlying and FX timestamps are within 15 minutes. The manual calculator uses the user's supplied values.
- Dividend figures and macro events are withheld until a verified source is connected. The allocation model remains educational. There are no invented dividend safety scores, forecasts or event dates in the displayed feed.
- The structure API rejects malformed candles, duplicate/reversed timestamps, invalid OHLC and oversized requests. Polling waits for the prior request to complete.

## Ledger and runtime

`/api/trade-results` reads the original Swing, Daytrade and legacy ledgers, with seven-row pagination. The original ID and ledger form a unique display identity. Swing/Daytrade outcomes use their recorded net R, including partial fills. Legacy outcomes are explicitly before costs. The rolling 100-trade summary uses the same authorized strategy/market/status filters. Unresolved, expired and review records do not produce wins.

US Swing cost profiles and CFD broker scopes are bound to the signed-in member. The endpoint never exposes another member's profile or broker history. Source tables and events remain immutable where originally specified.

Native Thai/DR/TFEX collection requires Node and a separate durable Forex SQLite store; it does not require enabling CFD pairing. CFD still requires its existing enabled receiver and authenticated MT5 connection. Cloudflare uses the existing D1 ledgers and keeps the US equity/chart page when the Node receiver is unavailable. A flag does not emulate SQLite on D1.

## Validation

At source revision 26f36d1:

- Fresh `npm ci --no-audit --no-fund` in an isolated worktree.
- `node --test`: 345 passed, 0 failed, 0 skipped; includes native D1 fixtures for the combined results and membership isolation.
- `NUGAOM_REVIEW_MODE=true npm run build`: passed.
- `npm run cloud:build`: passed using a staged dependency copy; local environment secrets were excluded.
- Browser: DR feed 6/6 and Thai feed 8/8; selecting NVDA80 opens its existing main chart with 624 labelled historical bars. Live reference outcomes are never fabricated for acceptance.
- A protected local backup of both SQLite stores passed `PRAGMA quick_check`; no backup or environment files are committed.

The 2026 exchange calendar is a verified snapshot; future years fail closed until their calendar is updated. MT5 freshness/expiry and display-rights settings remain enforced.

## Rollout and rollback

1. Keep the web, Swing worker and native Daytrade collector at the same release revision and point them to the intended persistent stores.
2. Local acceptance is on localhost:3000. Remote deployment requires choosing the actual target and its existing private environment; do not overwrite a VPS or D1 database with local files.
3. Check health, member access, scan coverage, active IDs, event deduplication and closed-trade correlation before exposing any remote release.
4. Roll back application/worker code together to the prior deployment artifact. Preserve the additive Daytrade tables and immutable events; do not drop tables or overwrite current customer databases to undo a UI release.
