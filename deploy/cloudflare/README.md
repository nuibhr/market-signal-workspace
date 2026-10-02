# Cloudflare migration — existing Nugaom application

Chosen target: Next.js web on Workers (OpenNext), a scheduled scanner every five minutes, D1 for members and immutable signal events. No Supabase or VPS.

## Prepared in this change

- `migrations/0001_existing_schema.sql`: existing 21-table schema only. Contains no customer records, session values, credentials or candle data.
- Customer signal APIs now use explicit allowlists; strategy gates, versions, provider diagnostics and raw event explanations stay on the server/admin.
- Whole-market historical replay summaries are stored persistently and updated one instrument at a time. Customer requests only read summaries.

## Required before deploying

The current app still uses synchronous `node:sqlite`, local disk backups and a Node process loop. The schema file is preparation, not a deployed D1 database or a finished Workers port.

1. Create Cloudflare resources under the owner's account and choose a public hostname.
2. Introduce asynchronous D1 repositories for membership, OAuth state, rate limits, signals, scan progress, candles and replay summaries. D1 uses async APIs; do not wrap current synchronous `DatabaseSync` as if it were compatible.
3. Replace local transaction code with D1 atomic batches/conditional updates. Credit debit, session consumption, portfolio uniqueness and signal event insertion must remain atomic.
4. Schedule `*/5 * * * *` in UTC. Fan out bounded market/instrument batches through Queues; use D1 leases and stable event keys to prevent overlaps and duplicate alerts. One five-minute trigger cannot promise every symbol completes in that invocation.
5. Use persistent progress/cursors for monitoring existing positions and historical replay. Separate provider errors from legitimate strategy rejections.
6. Adapt Next.js through OpenNext and resolve native Node dependencies and filesystem assumptions. Local Ollama is not available from Workers.
7. Store credentials as Cloudflare Secrets; use HTTPS LINE callback matching the deployed URL. Import customer data through a controlled migration, not through this schema file.
8. Confirm end-to-end behavior before changing production origin: login/session, 14-day trial, credit accounting, scheduled scan without an open browser, notifications, immutable entry/exit results and restored backup.

Do not deploy the old `/api/auto-pick/run` behind a Cloudflare proxy and label that a serverless migration: it still depends on the Mac/VPS and local SQLite.
