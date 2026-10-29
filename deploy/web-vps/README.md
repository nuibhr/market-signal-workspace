# VPS web with one shared daily scan

The original workers.dev URL is a small streaming HTTPS proxy. Next.js rendering,
screening and JSON processing run in the `nugaom-workspace` Docker project on the
VPS, removing the Free Worker's 10 ms compute constraint. LINE callback URLs,
session signing keys, member IDs and Stripe mode remain unchanged.

## Private service boundaries

- `nugaom-web-data` keeps authoritative membership, billing, quotas and signal
  records in the existing D1 database. It exposes authenticated server operations
  and the existing Workers AI model. It does not migrate D1 to local SQLite.
- Its independent `WEB_BRIDGE_SECRET` is a privileged backend credential, capable
  of reading/writing application records. Keep it root-owned, out of browsers,
  archives, logs and Git. The endpoint rejects unauthenticated requests, DDL,
  multiple SQL statements, oversized bodies and oversized batches. Do not
  reuse the narrower scanner secret.
- The VPS origin requires `VPS_ORIGIN_SECRET` on every request. The edge overwrites
  client-supplied forwarding/security headers; the origin fixes its public host
  to APP_ORIGIN. Keep TLS certificate verification enabled. The origin should
  return 404 when accessed without the secret.
- MT5 ingestion is owner-only and uses a separate durable Node SQLite volume.
  Customer screens do not collect broker credentials or provide pairing controls.
  Owner preview is loopback-only and never grants customer display rights.

## Economical shared data mode

Set `SHARED_MARKET_DATA_MODE=daily` on the web, and
`SCANNER_SCHEDULE_MODE=daily`, `SCANNER_DAILY_HOUR_BANGKOK=7` on the scanner.
The scanner reserves bounded symbol batches and persists daily progress in D1.
Restarting resumes the same day, and completed days cannot start another full
scan. If a process dies after reserving a batch, that batch is counted as
interrupted rather than silently fetched again. An interrupted symbol can lack
fresh data until the next daily round. The process releases its scanner lease
and makes no bridge/provider calls while waiting for the next daily boundary.

Scanning every configured instrument is a multi-request batch, not one upstream
API request. Charts, quotes, Radar and screeners read saved results. Refreshing
the shared screen does not call the providers. Public results have a bounded
five-minute process cache; member profiles and permissions are not shared.
The web marks the results as a daily snapshot and retains real source times.
`/shared` provides one read-only table for all five markets, subject to each market's rights and availability. Forex requires the verified owner-ingest path.
The canonical API enforces per-market caps and each actual provider's evidence.
No automatic live entry, stop or target guarantee is implied by daily data.

The initial catalogue contains Thai equities, DR, US stocks/ETFs, Forex and TFEX.
Coverage depends on actual licensed/configured sources. Missing contracts,
unsupported timeframes, metals CFDs without their actual venue, P/E, dividend
and news data stay unavailable; do not fill them with fixtures or proxies.
Crypto and additional broker adapters require separate verified integrations.
Delaying data alone does not grant redistribution rights.

Customers sign in through LINE. Optional one-time Trial enrollment uses the
LINE member identity without broker details. It is disabled by default with
TRIAL_ENROLLMENT_ENABLED=false. AI retains the existing membership quota.
Bigdata costs and project-wide spending controls remain a separate launch item.

## Deploy and migrate

Build with `docker build -t nugaom-workspace-web:RELEASE -f
deploy/web-vps/Dockerfile .`. Its Docker ignore file excludes credentials, local
databases, dependencies, build staging and Git. Keep private runtime values in
`/etc/nugaom-workspace/web.env` (root 0600), outside versioned releases.
Set `WEB_RELEASE=RELEASE` and run Compose. On this VPS the existing Caddy reverse
proxy network is reused; no application port is published. Add a separate Caddy
hostname pointing to `nugaom-workspace-web:3000` by the explicit network alias,
then validate and reload Caddy. The Compose service is named `app` so it does not
register the legacy Forex service's `web` alias. Preserve the existing Forex host
block. When the old Caddy bind mount was created through a release symlink,
verify its actual mounted inode before editing: changing a newer symlink target
does not update an already-mounted file.

With the image built and the private env file in place, run
`sh deploy/web-vps/install.sh RELEASE` from the release checkout. It exports the
tag for preflight and startup, and stores the non-secret tag next to the Compose
file so subsequent maintenance commands resolve the same image.
The KVM 1 defaults are 768 MiB and 0.65 CPU for the app. After a measured upgrade
to 2 vCPU/8 GiB, raise `WEB_MEMORY_LIMIT`/`WEB_CPU_LIMIT` deliberately (for example
1536m/1.0), accounting for other services. A larger VPS alone does not change
container limits or certify concurrent-user capacity.

Use `npm run cloud:deploy:web` for the small VPS proxy and
`npm run cloud:deploy:web-data` for the D1/AI gateway. The former Next.js Worker
is an explicit legacy rollback target (`cloud:deploy:web:legacy`); do not deploy
it over the proxy as part of the normal VPS release process.

For another VPS: copy/build the same release, securely transfer the runtime env
file and encrypted private MT5 volume backup, restore volume ownership, provide
an HTTPS reverse proxy and verify origin access with the service secret. Change
only `VPS_ORIGIN` in `wrangler.vps-proxy.jsonc` and deploy that small Worker after
readiness passes. No D1 export/import or LINE callback change is required.
Migrate the separate scanner following `deploy/vps/README.md`, stopping the old
scanner before activating the replacement. Never start two private MT5 writers
against independently diverging volume copies.

Before cutover, verify cookie continuity, LINE start, Test Checkout, D1-backed
membership, charts, daily read-only behaviour, isolation between two members,
origin access rejection and all old containers. Save the previous Cloudflare
deployment ID for rollback. A successful build alone does not certify these.
