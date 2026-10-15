# Unified main + Hostinger release

The integration includes **all application source from `main` at `07990da`** and the Hostinger runtime from `808b646`. Forex uses main's member sessions, handlers and recovery fixes. Shared workspace, Thai/DR/TFEX/US, membership, admin, Cloudflare migrations and Swing logic are byte-for-byte main's source. Host-specific filesystem checks live in `hosting/start.mjs`, keeping the shared preflight portable.

The existing Compose project name and volume names are retained. Never use `down -v` during upgrades. Set `RELEASE_TAG` to the deployed commit for an immutable local image tag. The web and optional scanner use that same image. Web, proxy and scanner logs rotate at 10 MB × 3 files per service, and services restart after process or host restart unless explicitly stopped.

## Continuous Swing scanner

The `scanner` Compose profile is opt-in. It runs main's `scripts/signal-worker.mjs`, shares only the membership/signal database with the web, and publishes no port. It handles Thai, DR and US; TFEX currently provides charts only. The default preview deployment does not start this service.

Before starting, privately configure the existing provider credentials, display-rights flags, `AUTO_PICK_RUN_SECRET` and selected `AUTO_PICK_*_ENABLED` flags in the server env file. Do not turn on rights flags merely to make preflight pass. US Swing requires `YAHOO_DISPLAY_RIGHTS_CONFIRMED`; FMP EOD alone cannot provide its intraday frames. The hosting scanner guard requires both main readiness and the actual Swing provider policy.

From the deployed release (include the preview override while MT5 remains disabled):

```sh
docker compose --env-file /etc/nugaom-forex/pilot.env -f src/forex-mt5/hosting/compose.yml -f src/forex-mt5/hosting/compose.preview.yml --profile scanner run --rm --no-deps scanner node src/forex-mt5/hosting/scanner.mjs --check
# Only after the preceding check passes:
docker compose --env-file /etc/nugaom-forex/pilot.env -f src/forex-mt5/hosting/compose.yml -f src/forex-mt5/hosting/compose.preview.yml --profile scanner up -d scanner
```

The persistence flag on the scanner reflects its actual named volume; provider permissions and enable flags remain operator controlled. A running process is not evidence of complete coverage or successful live signals. Verify scan progress and source errors after enabling it.

## Validation of integration

All 227 pre-existing Node tests passed, plus the new scanner readiness regression (228 total); the private LINE configuration Python test passed. The Next production build passed locally. `npm ci` reported zero known vulnerabilities. Runtime/source state on the VPS is recorded separately after deployment. No production LINE login or data-feed credentials were supplied during integration, and no display rights were inferred.

## Historical preparation notes

The notes below describe the original Forex-only pilot and its validation at that time. Current deployment status and restrictions above take precedence.

# Verified Hostinger VPS preview · 2026-10-15

The test site is deployed at **https://76.13.20.122.sslip.io/forex** on the operator-authorized VPS `76.13.20.122`. SSH access with the dedicated key, Ubuntu 24.04, Docker/Compose, a Linux Node 24.22.0 image and Next.js 16.3.8 are verified. The externally checked HTTPS certificate is valid. All five market routes returned HTTP 200, the public EA download matches release bytes, and anonymous API state contains no owner data. The deployment runs as UID 1000 and exposes only the HTTPS proxy, not the Node port. A marker in the dedicated data volume survived a web restart and was removed after verification.

**Customer MT5 pairing is still disabled.** This is the explicit preview profile, serving the 19-symbol Guest universe. LINE Channel ID/Secret have not been entered on this server and LINE sign-in has not been verified. The operator confirmed having an existing LINE Login channel. Add the test callback to that channel, enter credentials privately with `/opt/nugaom-forex/configure-line.py`, reload the preview and verify real sign-in before enabling customer mode. No local member/MT5 database, broker credentials or pairing presets were transferred. Live customer ingestion, native Windows terminal testing and backup/restore remain outstanding.

Local tests: 40 Node tests plus one Python secret-helper test. VPS tests: 32 Node tests plus the Python secret-helper test. Both Mac and VPS production builds passed. Installed dependency audit found zero known vulnerabilities after the security patch. Source-scope checks preserve the protected market/workspace/auth/D1/Auto Pick sources. Only the Next package/lock version was patched outside the dedicated Forex scope to address reviewed security advisories.

Deployed application source commit: `d633592`. The deployment uses `/opt/nugaom-forex/current`, a private `/etc/nugaom-forex/pilot.env` (0600), and persistent Compose data/certificate volumes. New VPS release installation and the 16.3.8 update did not change existing services; the initial VPS only had SSH listening. No subscription upgrade, domain purchase or existing domain DNS modification was performed. The temporary hostname resolves the VPS IP through sslip.io; use a chosen permanent domain before treating the pilot as the production customer service.

The following describes earlier preparation and templates; current operation is the verified preview above.

---

# Hostinger test release · 2026-10-15

The current deployment target is **Hostinger**. Office Windows hosting was considered and then superseded by the operator. No Hostinger account, package, public URL or VPS connection has been verified yet. No hosting purchase or upgrade has been made.

## Choose the existing service before changing it

Hostinger documents Next.js/Node.js on Business and Cloud plans, including Node 24 and ZIP uploads. Each managed deployment creates a new build folder; `hbuilds` and `public_html` are deployment-managed and overwritten. The app currently uses a dedicated SQLite market database plus the existing membership storage. A Next.js preview and a durable customer receiver have different storage requirements.

- **Managed Business/Cloud:** upload the prepared source ZIP as a **new** Node.js app. Keep MT5 disabled initially. Verify the host provides a writable private location outside deployment folders, and prove retention through restart/redeploy, before enabling SQLite-backed connections. Do not put databases in `public_html`, `hbuilds`, `.next`, or a public download directory. The startup preflight rejects known managed release paths. Hostinger's managed database offering is MySQL; this release has not rewritten Forex or shared membership storage to MySQL.
- **VPS:** the optional Compose bundle below provides Node, durable storage and HTTPS. An existing VPS can be used after checking its OS and workloads. Do not reinstall the VPS OS, remove a website, change DNS or overwrite an existing database to make this test fit. No VPS subscription is purchased by these files.

Official references:

- [Hostinger Node.js deployment, versions and build folder lifecycle](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger managed MySQL database support](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Hostinger Connector setup](https://www.hostinger.com/support/how-to-set-up-web-hosting-mcp-on-local-ides/)

## Managed Node.js preview

1. In hPanel choose **Websites → Add Website → Node.js web app → Upload**. Use a new test website; preserve existing sites and DNS. A supported hosting plan is required. Stop for a concrete user decision if a purchase is needed.
2. Upload `forex-hostinger-source.zip`. Select **Next.js**, **Node 24**, build command `npm run build`, output `.next`; normal Next.js start remains unchanged. Do not use a static export.
3. Apply the values in `hostinger-preview.env.example` through hPanel. Set `APP_ORIGIN` to the assigned HTTPS preview origin. **Keep `FOREX_MT5_ENABLED=false`** until storage/login are configured. The preview uses the 19-symbol guest universe and deliberately cannot pair customer terminals.
4. Check HTTPS, `/forex`, source/compiled EA downloads, and `GET /api/forex/mt5`: `authorized=false`, `snapshot=null`, empty quotes/chart, no local shortcuts. Source/data checks should also confirm the other market routes still use the shared workspace.
5. Before customer testing configure a verified private durable database path, the exact 19-server allowlist, existing LINE application credentials and callback origin. Preserve existing auth/hash secrets when migrating real member data. This source archive contains no secrets or member/MT5 database.
6. Prove pair/ingest, member isolation, token revocation, database retention after restart/redeploy, and a real Mac and Windows terminal connection. Only then report the customer receiver active.

The repository's shared package scripts, Next config, D1 migrations and earlier deployment files are unchanged. The supplied startup guard is available for a VPS/custom entry; automatic managed Next.js launches still need the manual hPanel checks above.

## Optional Hostinger VPS / Docker

The machine used to prepare this release has **no Docker installation**. Compose and container operation therefore require validation on the chosen VPS; local Node tests/build do not prove container or VPS operation.

Use an existing Linux server with Docker Compose and a stable domain pointing at its IP. The included Caddy config provisions public HTTPS when DNS and ports 80/443 are correct. The Node port stays inside the Compose network. No domain or DNS record is created by the templates.

On the VPS, copy `customer.env.example` to `/etc/nugaom/customer.env`, keep the file private and fill the actual domain and existing LINE credentials. `SESSION_SECRET` and `PORTFOLIO_HASH_SECRET` must each be at least 32 characters. If this is a new pilot with no users, new secrets can be generated on the server; if migrating, retain the old secrets and plan data migration separately.

From the repository root, run:

```sh
FOREX_ENV_FILE=/etc/nugaom/customer.env docker compose --env-file /etc/nugaom/customer.env -f src/forex-mt5/hosting/compose.yml up --build -d
```

The web command runs `hosting/start.mjs`, which refuses incomplete HTTPS/LINE configuration, unsafe database paths, shared database reuse, or local development shortcuts. SQLite data resides in the named `customer_data` volume, with distinct membership and Forex paths. Caddy certificates persist in separate volumes. One web instance is used; no background scanners, shared data migration, or Auto Pick jobs are started. The image excludes local environment files and runtime data and runs as the unprivileged `node` user.

The pilot's membership database starts empty. Local sessions, existing member data, downloaded presets and broker credentials are not copied. Deleting the volumes would delete pilot data; deployment updates must retain them. Before inviting customers, verify a consistent encrypted/offsite backup and restore of both data stores using the actual server's storage. Backups and TLS have not been exercised on Hostinger yet.

Node 24 is the container target. References: [Node supported releases](https://nodejs.org/en/about/previous-releases), [Caddy automatic HTTPS prerequisites](https://caddyserver.com/docs/automatic-https), [Dockerfile-specific ignore rules](https://docs.docker.com/build/concepts/context/).

## Source archive

After committing reviewed source, run `python3 src/forex-mt5/hosting/package-source.py /absolute/output/forex-hostinger-source.zip` from this checkout. The helper requires a clean Git checkout and packages only tracked application/build source. It excludes local environment files, credentials files, SQLite databases, downloaded `.set` presets, Git metadata, dependencies, caches and local runtime state. The two explicit hosting environment *examples* contain empty/placeholder configuration only. Existing code and the compiled public EA/relay downloads are included; they contain no customer keys. Dependencies and the Linux build are created by Hostinger, rather than uploading this Mac's runtime binaries.

## VPS preview mode

The dedicated preview override is `compose.preview.yml`. With the same environment file and Compose base, add `-f src/forex-mt5/hosting/compose.preview.yml` to `up --build -d`. This sets `FOREX_MT5_PREVIEW=true` and `FOREX_MT5_ENABLED=false`. The startup guard permits absent LINE credentials only in this explicitly disabled receiver mode; it still requires production runtime, HTTPS origin, separate persistent paths and no developer shortcut. Anonymous health must show no owner data. Production mode remains the original stricter guard requiring LINE configuration and active receiver readiness.

When LINE is configured and its callback verified, launch the base Compose file without the preview override; do not leave the override active while inviting customers to pair terminals. Do not change shared authentication source or reuse a development local session.

## Private LINE configuration on the VPS

`configure-line.py` is an interactive console helper. On the dedicated test VPS, it is installed at `/opt/nugaom-forex/configure-line.py` and updates `/etc/nugaom-forex/pilot.env`. Run it in Hostinger's VPS Web Console as the existing root owner. It asks for the Login Channel ID and masks the Channel Secret/confirmation. The helper refuses non-interactive stdin, public-permission environment files, symlink targets, malformed fields or mismatched confirmation. It updates only the two LINE fields atomically and retains the session/portfolio secrets and deployment settings. Neither secret is printed or sent to the conversation.

Add the test HTTPS callback as another URL on the existing LINE Login channel, retaining its existing callback URLs. After saving credentials, keep the website in preview mode while testing LINE sign-in; enable the customer receiver only after successful login and server preflight. See [LINE callback settings](https://developers.line.biz/en/docs/line-login/web/integrate-line-login/).

The Hostinger release now pins Next.js **16.3.8**, after the deployment audit identified advisories affecting the baseline 16.3.6. Package scripts and protected application sources remain unchanged. Local production build, the Forex/hosting regression suite and source-scope checks were rerun. The installed dependency audit reports zero known vulnerabilities at the time of deployment. This dependency security patch is the only shared package version change. See [reviewed advisory and patched version](https://github.com/advisories/GHSA-mcj8-r9mp-w47p).
