# AutoPick coverage repair — 14 October 2026

## Problem and resulting behaviour

The local supervisor was still running a process started on 13 October, before the latest code changes. Stored US done records had hundreds of attempts, and WBD kept returning BARS_UNAVAILABLE (389 total attempts by the end of this repair). Thai/DR morning windows ended with many never-attempted symbols still represented as pending. A COMPLETE zero-candidate monitoring run could coexist with incomplete candidate coverage.

This repair closes the status of the configured roster without inventing successful evaluations or historical signals. A missed symbol stays missed; an unavailable feed stays unavailable. It does not enlarge the current roster or change trading formulas.

## Changes

- Fresh symbols are considered before eligible retries. Retries have increasing delays and five consecutive source failures per symbol/session terminate as unavailable. Expected delayed-candle states are separate and remain eligible until the candidate deadline. A successful source observation resets the source-failure streak.
- Confirmed no-bars, unsupported instrument, missing configuration/display rights, HTTP 400/404 and plan restriction are terminal for the current session. They are eligible for a fresh check in the next session rather than repeatedly consuming quota in the same session.
- Cutoff settles unattempted symbols as **missed**, with zero source attempts; source retries become unavailable and known missing opening/session candles become ineligible. Closure does not increment source attempts. done/ineligible/unavailable/missed remain distinguishable from remaining/neverChecked/retry.
- Bounded candidate batches return SCAN_IN_PROGRESS while work remains instead of falsely reporting COMPLETE. Health remains degraded when candidate coverage was missed or unavailable, even if a subsequent monitoring-only run succeeded.
- Each local market has at most one in-flight run. A slow US job does not block another Thai/DR wake. Existing provider pacing remains in place.
- US plans that already consumed the current daily close, or are waiting for a future bar after their reference day, do not reload the same close repeatedly. They resume on a new daily close. A settled full scan is not fetched again in that session.
- Candidate publication rechecks the actual time after provider fetches. Crossing the deadline cannot publish a late new plan. Monitoring still uses the existing freshness/lifecycle logic and immutable event delivery; no broker order execution is introduced.
- Cloud recovery of a US batch now uses the same three-minute stale-run lease as its queue consumer. A terminal missing-data batch can acknowledge its handled unavailable status without treating it as endless transient retry. Monitoring errors still retry under existing queue limits.
- Worker heartbeat records runtime version. A live heartbeat from an old worker is reported as stale until the existing service reloads it.
- Customer/admin coverage labels show evaluated, ineligible, unavailable, missed, never attempted and retry separately. A 100% status-accounting bar is not labelled as 100% successful analysis. Unavailable symbols are explicit.

## Storage and runtime

Migration `0009_scan_source_failures.sql` adds source_failures and a nullable heartbeat runtime_version. SQLite/D1 share the same versioned SQL. Local SQLite is now version 9. Existing members, prices, signal outcomes, community data and credentials are not replaced.

The existing `com.nugaom.autopick` supervisor was restarted in its existing repository. It reports running with runtime `2026-10-14-coverage-v1`. No second scanner service, replacement app, new credential or launch flag was created.

Cloud schema 0009 must be applied with the normal controlled migration procedure before deploying the new web/scanner bundle. No remote migration, cloud deploy, scanner enablement or paid-service purchase occurred in this repair.

## Actual local result, 15:35 Bangkok

| Market/session | Roster | Evaluated | Ineligible | Unavailable | Missed | Remaining/retry |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Thai, 14 Oct morning | 150 | 46 | 0 | 1 | 103 | 0 |
| DR, 14 Oct day | 141 | 30 | 2 | 1 | 108 | 0 |
| US, 13 Oct daily close | 500 | 499 | 0 | 1 | 0 | 0 |

Thai IRPC and DR DISCO80 had source failures during the closed window. Their current availability outside that window does not retroactively make the morning evaluation successful. WBD returned no usable bars in the direct adapter probe and is unavailable for this session. Its attempt count remained at 389 after reload and subsequent worker wakes, rather than continuing to rise.

The missed morning evaluations were not backfilled as trading opportunities. Full real-market evaluation of the next Thai/DR window still needs observing; the zero remaining count above proves explicit closure, not success on those missed symbols. The current registry remains Thai 150, DR 141 and US scanner 500 (ETFs retain their separate chart/review features).

## Validation

- Combined suite: **100 tests/subtests passed**, including membership, community, coach paper accounting, native local D1, backups/cutover and existing lifecycle/delivery regressions.
- Additional current coverage regressions: fair retry ordering, backoff/exhaustion, explicit cutoff counts, DST and Friday-to-Monday US catch-up, full bounded roster fixtures, US no-bars without repeated fetching, daily-monitor resumption, lost US consumer recovery, no late candidates, market-independent scheduling and stale worker detection.
- Fixture tests evaluate the current Thai 150/DR 141 rosters and account for 499 usable + 1 no-bars US symbols. Fixture prices/trades are never inserted into customer storage.
- Next isolated build and Cloud packaging pass. Source/diff checks pass. HTTP coverage confirms zero remaining/retry and current worker version in the local app.
- No browser/mobile/real-device voice verification is claimed. Production rights, plan/limits, customer cutover, offsite recovery and hosted LINE/device checks remain the launch prerequisites.
