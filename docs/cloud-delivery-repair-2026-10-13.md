# Cloud delivery repairs — 13 October 2026

The Cloud review identified six reproducible gaps on `83b7535`. These repairs continue that existing application; cloud production remains in maintenance and its scanner remains disabled.

| Finding | Repair / evidence |
| --- | --- |
| Reconciliation closes waiting plans before the final queued monitor | Reconciliation allows 20 minutes after the entry deadline for a final monitor attempt. A Cloud fixture schedules at 11:30 and confirms entry from the qualifying 11:00–11:15 candle. Past-session open plans also get a final-data grace period. This is not permission to signal an old entry: the strategy's existing freshness gate still applies. |
| An old cursor falls outside the latest 50 events | New membership-protected `/api/auto-pick/events` pages forward using immutable event IDs, timestamp and database insertion order. Verified catch-up of 120 records on SQLite and native local D1. Only customer-safe event fields are returned. The initial baseline starts at the server's current event head, without replaying old history as fresh signals. |
| Cursor advances before popup delivery and reload loses the queue | Browser inbox commits the cursor and pending events together. Display commit, voice attempt/completion/error and dismissal are separate states. Member-scoped keys, Web Locks and leases coordinate visible tabs; hidden tabs release their presentation lease. A crashed tab's lease expires after two minutes. Pending events survive reload when browser storage is allowed; storage denial is visible and uses an in-memory fallback. |
| Heartbeat alone shows running | Cloud health separates scheduler, successful consumer and pending/retry/running/failed jobs. No enabled market is disabled; Cron without a successful consumer is idle/awaiting-consumer. Failures and stalled work produce degraded status. The admin system view exposes these components separately. |
| Thai health looks for timestamp-prefixed slots | Candidate run detection uses `started_at`, which applies to both local slots and `cloud:` job slots. Regression verifies complete coverage is recognized. |
| Queue attempts can exceed the configured retry count | Database enforces five attempts per job and a 30-minute job age across deliveries and expired leases. Terminal jobs are quarantined as failed with `RETRY_EXHAUSTED` or `JOB_EXPIRED`, not re-enqueued under that ID. Normal future scheduled scans remain separate jobs; this is not a provider-wide lifetime call limit. |

## Delivery behaviour

- Customer pages still poll every 30 seconds; the hosted schedule remains every five minutes. Neither promises that Queue processing or data availability finishes within five minutes.
- Catch-up is bounded to four pages per poll; capacity applies backpressure without advancing past a page that could not be retained.
- Entry/exit/review events take presentation priority over watch-only announcements, preserving entry/exit order within that priority.
- Old pending events are labelled historical and do not automatically speak as new opportunities. Replay remains an explicit button.
- A native speech completion callback is recorded as ended; device audibility is not proven by a callback. Errors remain distinguishable from received/displayed status.
- The durable inbox is per account **on the browser device**, not a cross-device server notification archive. Signal history stays in SQLite/D1. Multiple-tab serialization requires Web Locks; the fallback is intended for a single visible tab.

## Verification

- Existing and regression suite: **45 tests passed**, using isolated fixture databases.
- Native D1 rerun additionally exercises 120-event pagination, distinct IDs and safe payload filtering.
- `npm run cloud:build` passed, including the new event API. The build dependency-isolation check passed.
- Local `/thai`, `/account`, `/api/health` returned 200. Anonymous `/api/auto-pick/events` returned 403 and `/api/admin/system` returned 403.
- `.env.local` checksum matches the previous recorded checksum. No credential/config flags were changed and no synthetic trades were inserted into customer storage.
- Browser rendering, reload interaction and audible speech on actual devices remain unverified by browser automation. Tests cover the delivery modules and speech adapter; they are not screenshots or live financial results.

### Continuation checks on `2719a25`

- Local health reports available storage and a running local scanner.
- Anonymous GET requests to all six admin API entry points (system, memberships, member detail, signals, audit and Webull status) return 403 with `private, no-store`. The signal-event API also returns 403 without membership.
- Anonymous same-origin admin writes return `FORBIDDEN`; a write from another origin returns `INVALID_ORIGIN`. These probes do not modify customer records.
- `npm run cloud:check` passes its existing HTTP checks through the private review gate. The public site still returns maintenance status 503. The deployed health endpoint reports an offline scanner; HTTP availability is not evidence of active cloud scanning.
- These checks exercise the existing deployment, which does not yet contain the repair commit or the separate community branch. No deployment, configuration flag or credential change was made.

## Separate feature branch still pending import

`feat/community-sylva-landing` contains the exact Sylva landing, member rooms and private marketing/research inboxes. Its latest known commit is `d53d916`, preceded by `5d9e586`, based on `83b7535`. It exists in the earlier cloud workspace and was not pushed when that task's automatic approval review rejected the GitHub export. It is not present in this local Git object database or `origin`.

The user explicitly authorized messaging the earlier task to push only that feature branch to `nuibhr/market-signal-workspace`; the message was accepted. Subsequent status checks cannot reach the earlier `durable` cloud host, and a fresh Git fetch/list still finds only `main`. Source retrieval now requires that workspace to become available or a ZIP/patch/Git bundle from it. No further push authorization is needed for that request.

Do not claim the feature was merged, rebuild it from incomplete execution logs, or replace its exact registered assets with approximations. Once available: inspect the diff, preserve these scanner repairs and migration 0007, apply the feature's additive migration 0008, and rerun the combined source/rights/storage/build checks.

## Production gates unchanged

Data-provider display rights, Cloudflare plan/limits, fresh customer cutover snapshot, offsite recovery evidence, hosted LINE consent and device speech are still launch prerequisites. No cloud deployment or scanner enablement occurred in this repair pass.
