# Release preparation — 28 October 2026

The owner confirms there is no official staging environment/domain, no approved
repository of display-license evidence, and no current Trial users. These remain
pending gates. No real data may be published before rights verification and
release approval. Nothing in this change deploys or changes production settings.

## Implemented

- Checkpointed the previously reviewed owner-preview/canonical repair as 4272af5.
- New explicit one-time 14-day Trial after LINE sign-in, no broker number/key.
  Atomic version check plus audit event prevents concurrent retries from granting
  twice. Existing trial dates remain immutable, expired trials cannot restart,
  paid entitlements take precedence, Guest/Demo are denied. Enrollment defaults
  off. Canonical display rights remain independent of membership.
- Account CTA, enrollment disclosure and status match this policy; legacy manual
  renewal controls are displayed only for eligible legacy verified accounts.
- Shared market screen consumes canonical records, preserves per-market caps,
  labels provider/data-as-of/received-at, and separates unavailable/stale/unknown
  freshness, license denial, redaction, loading and search-empty states. License
  denial does not upsell membership, including Guest redacted rows. No invented
  price/percent/timestamp; customer MT5 pairing link removed.
- Readiness configuration supports d1-http/daily and independent bridge/origin
  secrets; uses expiring canonical rights evidence instead of old flags or a
  mandatory Yahoo dependency. Runtime license checks still evaluate actual source.
- Added private staging templates and an evidence-index checker with exact clean
  Git revision, scope, artifact hashes, reviewers and validity dates. Signals and
  performance introduce extra gates. The checker does not authenticate contracts
  or deploy anything. See deploy/staging/README.md.

## Verification and limits

Run npm test, npm run build and npm run check:release. This preparation uses an
isolated source copy and clean npm ci installation. Runtime tests use temporary
SQLite/local D1 and synthetic accounts/data. They are not licenses or real LINE,
Stripe, provider, production D1, Docker, load or rollback evidence.

Browser tab creation initially worked, but page navigation returned “Local browser
use is disabled in Work settings”. Interactive/mobile/visual QA remains pending;
HTTP/SSR checks do not substitute for it. Docker CLI is unavailable in this host.

Continue only with an approved isolated staging identity/configuration and actual
license evidence. Keep TRIAL_ENROLLMENT_ENABLED=false, empty canonical rights and
closed publication gates until the relevant checks and approvals are complete.
