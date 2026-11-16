# VPS scanner deployment and migration acceptance

The Swing scanner now runs on the existing Hostinger KVM at `76.13.20.122`.
The web app, LINE/Stripe integration, AI and authoritative D1 database stay on
Cloudflare. Existing Forex services on this VPS remain running independently.

## Deployed configuration

- Release: `/opt/nugaom-scanner/releases/20261024-vps2`; `current` points to it.
- Docker project: `nugaom-scanner`; container: `nugaom-scanner-scanner-1`.
- Image: `nugaom-scanner:20261024-vps2`, Node 24, unprivileged user, read-only
  filesystem, no published ports, 512 MB memory and half a CPU, bounded logs.
- Private configuration: `/etc/nugaom-scanner/scanner.env`, root-owned mode 600.
  Contains a separate bridge secret and market feed credentials only.
- Bridge: `nugaom-scanner-bridge`, version
  `ab7e4e27-c0e0-44c8-851e-d7f50eabcaa6`.
- Web: `nugaom-ai-pick`, version `9f7f4675-afc1-47bf-bd40-5fcc9ef4695b`,
  `SCANNER_RUNTIME=vps`; manual scan requests return 202 and queue in D1.
- Former Cloudflare scanner: disabled, Cron removed, queue consumer removed,
  version `6abdb7db-62c6-4e26-86c5-0423d78ec91f`. Queues/data retained.
- D1 migration 0014 adds global ownership and an atomic transaction fence.
  Cloudflare billing was not upgraded.

## Verified behavior

- All 443 source tests pass, including native D1 single-owner takeover,
  stale-writer rejection, graceful release, request coalescing and resuming a
  six-symbol selection across bounded batches.
- OpenNext production build succeeds. HTTP web/account/feed checks pass;
  guest access to admin remains forbidden.
- The actual release container passes authentication and D1 preflight on VPS.
- First VPS scans complete without source errors: US 11, DR 6, Thai 5.
- Upgrading v1 to v2 drains work and logs `scanner.stopped` before v2 starts.
- Real Demo browser sessions read fresh observations through `/api/signals`
  for all three markets. The entire 891-symbol roster is scanned progressively;
  the initial acceptance check does not certify complete roster coverage.
- A six-symbol Thai request using an actual Demo browser session returns 202;
  the VPS scans all six and D1 records `done`, attempts 1, no error, remaining 0.
  This is API acceptance: the six-symbol button is in a legacy component that
  the current workspace does not render.
- Observed runtime memory after several batches: about 179 MB of the 512 MB cap.
  Existing Forex scanner, daytrade, web and HTTPS containers remain running;
  the existing web container remains healthy.

Some instruments return unavailable source data (for example WBD in one batch).
These remain explicit unavailable observations; completed batches do not imply
every instrument has a valid feed or a tradable setup. No synthetic price or
signal was inserted for acceptance. Published signal count can correctly be zero.

## Moving the scanner later

Use [the deployment guide](../deploy/vps/README.md). Copy the same release and
the private environment securely to the new host, change the instance ID,
preflight, stop/disable the old host, and start the new host. Graceful handoff
releases ownership after draining; a failed host loses ownership within 120
seconds of its last heartbeat. D1, LINE and Stripe configuration stay in place.

This migration guide covers this new Swing scanner. Moving the existing Forex
application as well requires migrating its own configuration and persistent
Docker volume separately. Cloudflare Free request/D1 quotas and AI provider
charges continue to apply.
