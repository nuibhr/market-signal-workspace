# Portable scanner: VPS compute, Cloudflare web + D1

The web app, LINE callback, Stripe webhook, AI and authoritative signal ledger
stay on Cloudflare. Only the Swing scanner moves to the VPS. No SQLite copy,
new public VPS port, customer session key or Cloudflare account token is needed.
This setup works on Hostinger KVM and other Linux VPS providers.

Set the web Worker's `SCANNER_RUNTIME=vps`: the manual six-symbol scan returns
HTTP 202 and queues its selection in D1. The VPS prioritizes these requests,
retains unscanned selections between bounded runs and then resumes discovery.
The browser refreshes results automatically. Existing session/origin checks and
rate limits still protect this action. No market calculation runs in that HTTP
request. Local development keeps the existing direct scan path.

## Prepare Cloudflare once

1. Run all source tests, including the native D1 bridge tests.
2. Apply D1 migration `0014_scanner_bridge.sql` with the existing migration command.
3. Generate a separate random 32-byte `SCANNER_BRIDGE_SECRET`. Upload it using
   `wrangler secret put SCANNER_BRIDGE_SECRET --config deploy/cloudflare/wrangler.scanner-bridge.jsonc`
   through stdin; store the matching value in the VPS environment file.
4. Deploy `deploy/cloudflare/wrangler.scanner-bridge.jsonc`. This Worker performs
   small D1 operations; analysis and data fetching run on the VPS.

The bridge accepts a fixed catalogue of scanner queries with bound parameters.
It rejects arbitrary SQL and membership/billing access. Every query is fenced
in the same D1 transaction as the global scanner lease. Heartbeats run every
30 seconds; ownership expires after 120 seconds. Queries cannot reacquire an
expired or released lease. A second process waits while the current owner works.
The separate per-market lease still protects scanner batches and web refreshes.

The bridge secret can modify scanner observations and signal events. Keep it out
of browser code, Git, logs and shared archives. Rotate it if a VPS is compromised.
Cloudflare Free request/D1 quotas still apply; moving compute does not remove
storage limits or AI provider charges. The D1 REST administration API is not
used in the scanner's hot path.

## Build a release

Use Node 24+ with the repository lockfile:

```sh
npm ci
npm run scanner:build
```

`dist/scanner.mjs` is a bundled executable. The VPS needs Node 24+ only; it does
not need the repository, npm credentials, Wrangler, a Next build or OAuth login.
Copy it with `install.sh`, `nugaom-scanner.service` and `scanner.env.example`
from this directory into a versioned release archive. Do not include secrets.

## Install with systemd (recommended when Node 24 is already installed)

Create `/etc/nugaom-scanner/scanner.env`, root-owned mode `600`, from the example.
Set a unique `SCANNER_INSTANCE_ID` such as `hostinger-01`. Only the bridge secret
and optional market feed credentials belong here. The scanner works with the
project's already approved Yahoo fallback if no native feed is configured.
Install the release from its extracted directory:

```sh
chmod +x install.sh
./install.sh RELEASE_ID
journalctl -u nugaom-scanner -n 40 --no-pager
```

The installer checks bridge authentication and D1 availability before switching
the release symlink. It touches only its own user, service and directories.
Old releases remain under `/opt/nugaom-scanner/releases` for rollback.
Check for actual `scanner.scan` events with `scanned > 0`, and inspect source
errors/coverage; `active`, a heartbeat, or `scanner.started` alone is insufficient.

## Docker option (when another app needs an older Node version)

With Docker Engine + Compose installed, use `deploy/vps/compose.yaml` from a
checkout. It builds a Node 24 image and publishes no ports. No state volume is
needed; the only persistent scanner data stays in D1.

```sh
docker compose -p nugaom-scanner -f deploy/vps/compose.yaml build
docker compose -p nugaom-scanner -f deploy/vps/compose.yaml run --rm scanner node scanner.mjs --check
docker compose -p nugaom-scanner -f deploy/vps/compose.yaml up -d
docker compose -p nugaom-scanner -f deploy/vps/compose.yaml logs --tail 40 scanner
```

Use exactly one supervisor (systemd or Compose) on each server. The image uses
an unprivileged user, a read-only filesystem, resource limits and bounded logs.

For a prebuilt release archive, use the included `Dockerfile.release` and
`compose.release.yaml` with `scanner.mjs` in the same directory. No repository
or npm installation is needed on the VPS:

```sh
export SCANNER_RELEASE=RELEASE_ID
docker compose -p nugaom-scanner -f compose.release.yaml build
docker compose -p nugaom-scanner -f compose.release.yaml run --rm scanner node scanner.mjs --check
docker compose -p nugaom-scanner -f compose.release.yaml up -d
```

Keep the release ID in the release directory's `.env` so future Compose commands
use the same image. Keep credentials only in `/etc/nugaom-scanner/scanner.env`.

## First cutover from the CPU-limited Cloudflare scanner

Preflight the VPS first. Before starting real scans, disable the old Cloudflare
scanner (`SCANNER_ENABLED=false`), remove its Cron trigger and queue consumer,
and remove its Paid-only `limits.cpu_ms` configuration before deploying it on
Free. Leave queued jobs/data intact. Wait until existing invocations and market
leases have drained (a queue scan can hold a lease for 150 seconds). Then start
the VPS and verify completed scans plus fresh D1 observations from the web.
The global bridge lease does not fence the old Cloudflare queue consumer; this
cutover step is required. Do not run both scanner architectures concurrently.

## Move to another VPS later

1. Prepare the same release on the new host. Securely copy only
   `/etc/nugaom-scanner/scanner.env`; change `SCANNER_INSTANCE_ID`.
2. Run `node --env-file=/etc/nugaom-scanner/scanner.env scanner.mjs --check` as
   root. It checks the bridge and D1 without claiming the scanner lease.
3. Stop and disable the service on the old host (`systemctl disable --now
   nugaom-scanner`), or stop its Compose project. Wait for `scanner.stopped`.
   A graceful stop drains in-flight work before releasing ownership. If the
   host has failed, wait up to 120 seconds after its last successful heartbeat.
   Shutdown timeout is 90 seconds; unexpected termination leaves
   the lease to expire safely.
4. Start the new host, verify `scanner.scan` with actual observations and no
   persistent source errors, then retire the old host and its deploy SSH key.

No domain, LINE, Stripe callback or D1 data migration is needed. Do not leave
the old host enabled as an automatic standby: after the new host stops it could
take ownership again. For rollback, stop the new host before restarting the old
release. Keep the environment file encrypted in your existing secret backup.
