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
