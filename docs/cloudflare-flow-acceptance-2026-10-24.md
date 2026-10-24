# Cloudflare flow checks — 24 October 2026

Application: https://nugaom-ai-pick.nuibhr1.workers.dev/account

## Membership demo

`DEMO_LOGIN_ENABLED=true` exposes onboarding, trial, Starter, Pro, Ultimate and expired previews on `/account`. Each browser receives a random, temporary member and a separate HttpOnly demo cookie. Demo access expires after two hours. Switching plans retains the member ID and today's AI usage; exiting restores an existing LINE session. Demo identities cannot become administrators, change portfolio/renewal records or open live Stripe payments. Legacy shared demo identities remain rejected.

Migration `0013_demo_access.sql` is additive. Both D1 and local SQLite install the same table. Turning the flag off invalidates demo access immediately. Demo rows are marked with `demo-` / `Udemo_` identities and remain distinct from LINE members. Expired sessions are pruned by the existing session cleanup; this release does not delete historical demo member/AI rows automatically.

Demo assistant requests use real Bigdata research and the selected plan’s server-side daily quota, as explicitly authorized by the owner. Chart-analysis previews in Demo remain labeled examples; real LINE members use Workers AI for chart narration.

## Stripe and LINE

Headless Chrome clicked the actual plan buttons and reached the Stripe-hosted payment forms for Starter (THB 99/month), Pro (THB 299/month) and Ultimate (THB 599/month). The deployed catalog and credentials use Stripe test/sandbox mode. No subscription payment was submitted. A final public Demo call also reached Bigdata successfully with four real sources and one question charged against the selected 150-question daily limit. Signed webhook entitlement, idempotency and daily quota behavior are covered by fixture tests; a completed payment and real LINE consent are separate acceptance steps.

The first real LINE check returned **400 Invalid redirect_uri** for channel `2011817257`. A later browser check reached the normal LINE login form without that error. The application sends the canonical callback correctly. If registration needs to be repeated, add this exact URL under LINE Login → Callback URL in LINE Developers:

```text
https://nugaom-ai-pick.nuibhr1.workers.dev/api/auth/line/callback
```

Human LINE login/consent and the final session return to `/account` still require acceptance. A visible login form alone does not certify that final step. The automated LINE tests cover PKCE, ID token issuer/audience/nonce verification, OAuth state and one-time flow consumption. They cannot certify the external channel's callback registration or consent screen.

## Two AI services

The research assistant uses Bigdata. A temporary private acceptance identity called the production `/api/assistant` endpoint and received HTTP 200, a real answer and six sources in approximately 40 seconds. The test identity, session, conversation, question and quota records were removed afterward. Streaming answers now require a COMPLETE event; an interrupted response is rejected and its quota reservation released.

Chart **AI Analysis** previously called `127.0.0.1:11434` and always returned `LOCAL_MODEL_ONLY` in production. `/api/ai-analysis` now uses the request's Workers AI binding, with `@cf/meta/llama-3.3-70b-instruct-fp8-fast` and a validated JSON schema for summary/risk. Local development retains Ollama. Missing bindings, invalid output and provider deadlines fail explicitly. Completed real and demo responses use separate cache keys; in-flight model I/O is not shared across Worker requests.

A temporary private member and a synthetic PTT technical snapshot exercised `/api/ai-analysis` on the deployed Worker: HTTP 200, provider `Cloudflare Workers AI`, valid summary/risk, about 1.6 seconds. This verifies transport and the application response contract, not the accuracy of a trading forecast. The fixture was removed afterward.

## Scanner

`nugaom-autoscan` is enabled, with the existing D1 database, `*/5 * * * *` Cron, `nugaom-scan-jobs`, a single consumer and the existing failed-message queue. Logs distinguish scheduled dispatch, job start, completion/retry and unexpected failures.

The deployed Cron dispatched 45 jobs on an observed run. Initial acceptance found a backlog and market leases held while provider I/O stalled; a heartbeat alone is insufficient to certify completed scanning. The scanner changes bound provider/context waits and keep pending Yahoo SDK queues, cookie discovery and promises within their Worker invocation. Completed cache values can still be reused. Regression coverage verifies that an unresolved source releases its market lease and a subsequent scan recovers.

Production tail then identified `exceededCpu` invocations. Deploying the explicit 30-second CPU limit was rejected with Cloudflare error **100328**: "CPU limits are not supported for the Free plan." The account is therefore confirmed Workers Free. The source configuration now sets `limits.cpu_ms=30000` for the required Paid deployment. The currently deployed scanner remains enabled with the previous supported settings, but completed scanning is **not operationally accepted** until the owner enables Workers Paid and the scanner is deployed and observed again. No account plan or billing subscription was changed automatically.

Account action: https://dash.cloudflare.com/84140dea513079cc7dc4166a4c71b2ee/workers/plans. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Queues limits](https://developers.cloudflare.com/queues/platform/limits/). After enabling Paid, run `npm run cloud:deploy:scanner` and check completed queue jobs, observation coverage, failures and CPU time. The consumer was restarted once without purging messages; queue contents and existing market records were retained.

No trading events, existing market signals or customer membership dates are rewritten by this release. Provider gaps remain explicit unavailable observations; successful full-market coverage must be checked from completed jobs and observation timestamps after deployment.

## Verification

441 tests pass. Run `npm test`, `npm run cloud:build` and `npm run cloud:check`. Native D1 tests require a runtime allowed to start local workerd processes. Browser checks covered all six demo roles, per-role quotas, admin denial, demo exit, mobile overflow, real LINE redirects and all three Stripe-hosted forms. Production AI acceptance used private temporary fixtures, separately from public Demo behavior.
