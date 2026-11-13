# Staging and release evidence

Status on 2026-10-28: PENDING. The owner confirms there is no approved staging
name/domain and no approved display-license evidence repository. Do not deploy
or publish real market data. All local fixture checks remain separate evidence.

The first candidate is read-only prices/charts. The example lists all five
candidate markets; none is approved for publication. Narrow the scope to the
markets whose provider rights and real-data acceptance pass before launch.
Adding a fallback provider requires a separate rights evidence entry. Signals
and performance require their own gates; execution is outside this release.

## Prepare (no external mutation)

1. Review and commit the candidate, then record its full Git revision.
2. Run `npm ci`, `npm test`, and `npm run build` in a clean checkout.
3. Build `deploy/web-vps/Dockerfile` with a revision-specific image tag. Record
   the image digest and runtime version. A host Node build is not Docker proof.
4. Copy `web.env.example` outside Git to a private location. Replace only with
   approved staging settings. Maintain false review/owner-preview/demo flags,
   empty canonical rights, closed Trial enrollment and maintenance mode until
   the appropriate gates are ready. Never use a production D1 binding/secret.

## Requires owner/environment evidence

- Reserve an approved HTTPS staging hostname, a separate D1 database and bridge,
  separate session/origin/bridge keys, a staging LINE channel/callback, Stripe
  test configuration, and isolated owner-ingestion storage. Do not repoint the
  production callback or reuse the production database to create staging.
- Apply the existing migrations only to that approved isolated D1 database.
  Verify the VPS → authenticated web bridge → D1 path with the shared daily mode.
- Store approved provider contracts/permission records in controlled storage.
  Record provider, market, display/history/storage/derived-data scope, reviewer,
  evidence ID, effective time and expiry. Only then create matching entries in
  CANONICAL_DISPLAY_RIGHTS_JSON. API access or a boolean flag is not a license.
- Exercise each enabled market's positive, stale, missing, revoked/expired-rights,
  fallback and outage cases. Verify actual source timestamps separately from
  received timestamps. Never substitute fake timestamps or proxy instruments.
- Validate LINE login/cancellation/session expiry and Stripe test checkout,
  webhook retries, renewals, failed payment, cancellation and access revocation.
  No live payment or purchased provider upgrade is part of this preparation.
- Run desktop/mobile browser acceptance: Guest (one redacted/zero full), Trial
  (8), Starter (3), Pro (5), Ultimate (8); market switching/search; chart access;
  empty/loading/unavailable/stale/rights-denied states; keyboard/focus; account
  start-trial and expiration. Browser fixture sessions do not prove LINE OAuth.
- Define expected pilot traffic, then run bounded load tests and record latency,
  errors and limits. Test backup restoration and rollback with session continuity.
  Do not infer capacity from local HTTP assertions or server specifications.

## Trial policy

Explicit start after authenticated LINE login; 14 days once per member identity;
8 full cards per selected-market scan; existing AI quota; no broker credentials,
no payment method and no automatic charge. The operation uses the persisted
trial dates and optimistic concurrency with one audit event, including on D1.
Expiry does not reset on login, retries or renewal. Paid memberships take priority.
`TRIAL_ENROLLMENT_ENABLED=false` is the default; enable only after launch readiness
and owner approval. It does not enable provider rights, signal or execution access.
Legacy admin code/renewal operations remain for already verified legacy accounts.

## Evidence review command

Copy `release-evidence.example.json` into the private evidence directory. Keep
licenses and runtime artifacts there, outside Git, with no secrets in reports.
For each gate record PASS only after actual review; specify the reviewer, full
candidate revision, verifiedAt, validUntil, relative artifact file and SHA-256.
The example remains PENDING and must never be filled using test fixtures.

Run from the clean candidate checkout:

    npm run check:release -- /absolute/private/evidence/release-evidence.json

Exit 0 = the index matches the clean Git revision, scoped gates, unexpired review
records and artifact hashes. Exit 1 = NO-GO. The checker validates the evidence
index; it cannot authenticate contracts or independently prove a reviewer acted.
Review the referenced files before approval. A changed revision invalidates old
entries until they are reviewed against the new candidate. Approved evidence must
be provided before using the existing install/deploy commands; this command does
not itself deploy, change configuration, or approve a release.

## Pending gates confirmed by the owner

- STAGING_ENVIRONMENT: no official environment/domain assigned.
- DISPLAY_LICENSE_EVIDENCE: no approved evidence repository or records supplied.
- RELEASE_APPROVAL: publish only after rights verification and all approvals.

Other gates remain pending until separately demonstrated: Docker image, real
provider/shared D1 flow, real LINE/Stripe lifecycle, complete responsive browser
matrix, load/capacity, restore/rollback and session continuity.
