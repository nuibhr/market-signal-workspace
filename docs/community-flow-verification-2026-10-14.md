# Community flow verification — 14 October 2026

## User story and scope

A LINE member enters `/community`, reads rooms allowed by current membership, or opens a private support thread. An assigned team member uses `/team` to reply and transfer work. Every request must preserve current access rights, and a lost response must not cause a duplicate message.

This pass continues after AutoPick coverage repair `74cd308`. It checks and repairs the Community client/API/data boundary. Authentication uses the existing LINE/session implementation; no alternate login route, real staff assignment or new database migration was added.

## Findings and repairs

1. **P2 — Lost send confirmation followed by rate limiting could produce a duplicate.** The earlier client cleared its pending operation on every 4xx response. If the first request committed and its response was lost, a 429 from the retry discarded the original operation ID. Sending again then created a second message. The writer now retains the same payload/operation ID through transport failures, server failures and rate limits. It respects `Retry-After`, displays a retry countdown and blocks a new send until confirmation. A later rejection cannot prove an earlier unanswered attempt failed, so that case also retains the pending operation.
2. **P2 — A stalled request could hold the send button indefinitely.** Writes and read receipts now have a 20-second deadline covering both the request and response-body decoding. Timeout aborts the request and shows the confirmation/retry path. It does not claim that the server failed to commit. A failed receipt becomes eligible again on the next refresh.
3. **P2 — Rapid submissions could pass the same render's busy check.** The writer reserves its pending operation synchronously before awaiting the request, preventing a second click or retry from starting another operation. Confirmation requires a successful HTTP response with `ok: true`; rendering callbacks run after confirmation is recorded.

The Next route delegates to shared handlers so tests execute the same authentication boundary, request guards, rate limits and repository calls as the app. Unsupported `view` values return a private 400 response instead of silently selecting the overview.

## Evidence

| Boundary | Verified evidence | Limit |
| --- | --- | --- |
| Existing local page entry | Anonymous `/community` and `/team` return 307 to `/account` | No browser rendering or authenticated device interaction asserted |
| Existing local API guards | Anonymous GET/POST return 401; cross-origin POST returns 403; API responses are `private, no-store` | No real member data written by the HTTP probes |
| Session → handlers → SQLite | Fixture sessions use the actual session repository; revoked session, invalid JSON/content type, oversize body and invalid view are rejected | Uses isolated fixture identities, not a real LINE consent flow |
| Membership and team rights | Member expiry blocks rooms; support remains available; owner/team isolation, transfer, role revocation, closure and admin restrictions pass through the HTTP handlers | Does not appoint actual team users |
| Client → handlers → SQLite → client | Commit a message, lose its response, encounter the real rate limiter, then retry: one message and one audit operation remain with the original ID | Transport failure is deliberately simulated |
| Client transport | Stalled request/body, double submit, Retry-After seconds/date, unknown result followed by rejection, malformed success and callback failure regressions pass | No browser/mobile network simulation claimed |
| Existing D1 and recovery behaviour | Native local D1 permissions/idempotency and encrypted backup/cutover tests pass in the combined suite | No remote D1 migration or deployment |

Combined tests: **111 tests/subtests passed, 0 failed**:

```sh
node --test src/auto-pick/*.test.mjs src/membership/*.test.mjs src/community/*.test.mjs src/coaches/*.test.mjs src/security/*.test.mjs src/market-data/*.test.mjs src/admin/*.test.mjs
```

`NUGAOM_REVIEW_MODE=true npm run build`, `npm run cloud:build` and diff whitespace checks pass. The existing local app remains on port 3000. Fixture sessions/messages live only in temporary test databases.

## Remaining acceptance checks

- On the approved hosted HTTPS origin, complete real LINE login/consent, cancellation and logout. Verify the displayed account belongs to that LINE user.
- With an active member on a phone, open a room and a support thread, send/read messages and check seven-row paging. With an expired member, verify rooms are unavailable and private account support remains usable.
- Use actual users selected by the admin for marketing and analyst roles. Verify each inbox, transfer a topic, then revoke the old role and verify that reading/replying is denied.
- On real devices, simulate a lost confirmation and retry after the displayed cooldown. Verify one message, successful confirmation and normal sending afterwards. Check background/foreground unread updates.

Pending writes are in memory only. Reloading or closing the page discards the pending retry state; after that, check conversation history before sending the same content again. If a session or access right changes while confirmation is unknown, confirmation can remain blocked until access is restored. This pass does not claim durable drafts, offline delivery, push notifications after closing the page, real-device visual/audio acceptance or production readiness.

Browser automation remains unavailable under the earlier block; it was not retried through another browser, port, proxy or app copy. Cloud launch still requires the previously documented provider rights, hosting limits, customer cutover/restore, migration 0008/0009 and hosted LINE/device checks. No deploy or launch flag change occurred in this pass.
