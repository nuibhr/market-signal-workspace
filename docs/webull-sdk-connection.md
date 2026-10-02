# Webull SDK connection — 2 October 2026

## What worked

The installed official `webull-openapi-python-sdk==3.0.2` authenticates the local
credentials on **US Sandbox**. The previous local setting was `prod / th`.
Only `WEBULL_REGION_ID=us` and `WEBULL_ENVIRONMENT=sandbox` were corrected;
the App Key and App Secret were preserved.

| Environment | Configuration request |
| --- | --- |
| Thailand production | 401 UNAUTHORIZED |
| US production | 401 UNAUTHORIZED |
| Thailand sandbox | 401 UNAUTHORIZED |
| US sandbox | 200; `token_check_enabled=false` |

Verified on AAPL:

- Snapshot: HTTP 200, about 447 ms; actual source timestamp recorded.
- One-minute history: HTTP 200, 1,200 returned and 1,200 valid closed candles,
  about 1,126 ms. Oldest 29 September 14:29 UTC, latest 2 October 14:58 UTC in that request.
- MQTT with TLS: connected, subscription accepted, actual QUOTE / SNAPSHOT / TICK
  messages received across the probes. The later probe received three tick prices
  and stopped deliberately. No stream is left running.

These are **sandbox responses**. Source timestamps were recent during this probe;
this does not establish production entitlements, exchange completeness, public
display rights, or a guaranteed transport latency. A fast HTTP response is not the
same measurement as price age or end-to-end exchange latency.

## Install and repeat

From the existing project directory, use Python 3.8–3.14:

```sh
python3 -m venv data/webull-sdk
data/webull-sdk/bin/python -m pip install -r scripts/requirements-webull.txt
npm run probe:webull
npm run probe:webull-stream -- --seconds 30
```

Test the known official region/environment combinations without changing `.env.local`:

```sh
npm run probe:webull -- matrix
npm run probe:webull -- --region us --environment prod
```

Keys stay server-side in `.env.local`, read by Node and passed to Python through the
child's environment. There is no shell interpolation and no keys in process arguments.
Python receives only Webull settings and a few runtime environment variables.
The SDK's raw log output is disabled and stderr is discarded, since SDK debug
logs can contain signed requests.

The adapter supports **market-data diagnostics only**. It imports no trading client
and sends no orders or account/position requests. Authentication configuration is
read before the data request. If mobile approval is required, it reports this and
stops; this command does not silently create an approval request.

## Application integration

- `/admin` → ระบบสแกน shows the last Webull SDK diagnostic: quote, valid bar count,
  and actual streaming price delivery. This is a historical diagnostic, not a live
  connection indicator. Existing admin authorization applies.
- Safe local reports are saved in ignored `data/webull/reports/` with mode 0600.
  Evidence is bound to the current credentials/region/environment using a private
  fingerprint. Changing the key does not keep a previous key's successful status.
- The Python runtime and local reports are excluded from Next release file traces.
  A production host must install its own SDK runtime and generate its own evidence.
- Sandbox data is **not** connected to customer charts, AutoPick, signal entries,
  exits, or performance reports. Existing market feeds continue to operate.
- Every probe is bounded; there is no automatically started Webull background worker.

For production integration, first verify production credentials with the probe.
Then use production historical bars and snapshots with identity/time validation.
A continuous MQTT adapter needs a persistent process with reconnect/resubscribe,
bounded buffers and heartbeat monitoring. Cron scans can consume persisted closed
bars; browser pages should consume an authenticated application endpoint rather
than the Webull App Secret. The MQTT Python process cannot run inside a Cloudflare
Worker runtime; use REST on each scheduled scan or host streaming separately.

## Differences from the pasted example

- The official SDK constructor takes `region_id` (or a positional region), not `region`.
- Use `on_connect_success`, `on_subscribe_success`, and `on_quotes_message` callbacks.
- Subscribe **inside** the successful connection callback, with enum `.name` values
  and `sub_types`. The SDK does not provide the example's `register_callback` method.
- Use `connect_and_loop_forever()` to keep the MQTT loop running.
- HTTP subscribe host and MQTT streaming host are different.
- QUOTE is book depth; SNAPSHOT/TICK deliver last-traded prices. Receiving a
  connection acknowledgement or book-only message does not prove price delivery.
- The batch `/market-data/stocks/bars/list` API replaces the retired single-symbol
  `/bars/get` endpoint; the current SDK specifies a maximum count of 1,200 bars.

Sources: [official SDK](https://github.com/webull-inc/webull-openapi-python-sdk),
[market-data example](https://developer.webull.com/apis/docs/market-data-api/getting-started/),
[US hosts](https://developer.webull.com/apis/docs/sdk/),
[Thailand hosts](https://developer.webull.co.th/apis/docs/sdk/),
[market-data permissions](https://developer.webull.com/apis/docs/market-data-api/overview/).
