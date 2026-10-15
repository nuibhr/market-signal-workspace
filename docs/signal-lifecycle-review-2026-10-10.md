# Signal lifecycle review — 10 October 2026

## Completed

- Restored the local macOS `com.nugaom.autopick` LaunchAgent using the current Node executable. `/api/auto-pick` reports a running heartbeat and a one-minute local scan interval. Customer pages poll for events every 30 seconds. Cloud scanning remains disabled; its configured Cron interval is five minutes.
- Fixed Thai and DR waiting-plan verification: a fresh final candle alone cannot prove complete monitoring. Missing intervening candles now preserve `monitoringIncomplete`, producing REVIEW / DATA_GAP at expiry rather than a verified no-entry claim.
- Intraday entries left OPEN after a missed session close now move to REVIEW after the final-data grace period. Their recorded entry is preserved, exit stays unknown, and they do not add a win/loss. No orders are sent.
- Ordered event feeds by timestamp and insertion order, so ENTRY precedes TARGET/STOP in delivery even if a catch-up job records both in one millisecond.
- Removed the UI's silent twelve-alert queue truncation. Existing freshness, visible-tab ownership, shared cursor and Web Locks still apply.
- Entry popups show reference entry, TP1 and SL even when voice is off. Added a replay button, visible native speech permission/device errors, and a direct user-gesture retry. Preview speech does not immediately interrupt a live alert already being presented.

## Evidence

`node --test src/auto-pick/*.test.mjs src/membership/cloud-storage.test.mjs src/security/security.test.mjs`: **34 passed**.

New lifecycle fixtures use a temporary SQLite database and mocked clock, independently of the customer database. They cover Thai, DR morning, DR night and US daily-bar entry, target and stop paths; gap-open stop pricing; stale competing updates; duplicate event prevention; private customer payloads; exact entry/exit links to the results ledger; same-millisecond event ordering; and unresolved session closes. Synthetic win/loss counts in those tests are not market results.

Speech tests use a fake browser adapter and verify native callback handling and permission retry. They do not establish that audio was audible on a customer's device.

Real read-only provider requests on 10 October:

| Symbol | Intraday | Daily history | Latest closed daily bar |
| --- | --- | --- | --- |
| PTT | 120 × 15m | 250 bars | 2026-10-09 |
| NVDA80 | 120 × 15m | 249 eligible closed bars out of 250 returned | 2026-10-09 |
| NVDA | Daily EOD only | 300 bars, FMP | 2026-10-09 |

NVDA80 returned a daily bar labelled 2026-10-12. The existing `completedCandles` filter excludes it from planning; no inference is made about why the provider labels that bar in advance. SET quotes reported Close and had no source timestamp, so these checks do not prove live feed latency.

Read-only customer ledger audit: 30 resolved reference trades, no closed records lacking valid positive entry/exit prices or timestamps, and no duplicate event keys. After reconciliation, no past-session Thai/DR entries remained OPEN. Existing records were retained; no test trades were inserted and no customer wins/losses were manufactured.

`npm run cloud:build`: successful, including all application routes and OpenNext bundle. The dependency isolation checksum passed. Local `/thai`, `/dr`, `/us`, `/account`, `/coaches`, `/api/health` and `/api/auto-pick` responded 200. Anonymous signal API requests require membership, as intended.

## Remaining live validation

1. Audible entry/target/stop speech and actual popup interaction on the customer's browser/device, with voice enabled by a click. A manual sample-voice confirmation has been requested.
2. A real provider-driven qualifying signal in an open market. Saturday checks and fixture tests cannot establish that future market conditions will qualify or that the strategy is profitable. US scanning currently uses closed daily bars, not intraday execution prices.
3. Cloud launch: hosted scanner enablement, provider display rights, service limits/billing decision, fresh data migration, offsite recovery proof and public LINE login still require their previously identified launch steps. This review built a bundle; it did not deploy or enable the cloud scanner.
