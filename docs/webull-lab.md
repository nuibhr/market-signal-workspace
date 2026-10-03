# Webull US Sandbox lab

## Where to use it

- `/admin` → ระบบสแกน → เปิดห้องทดลองกราฟและสแกนหุ้นสหรัฐฯ 500 ตัว.
- Direct route: `/admin/webull`, authorized through the existing LINE admin account.
- CLI: `npm run scan:webull-lab`. Requires the isolated Python runtime installed as described in [SDK connection](./webull-sdk-connection.md).
- Optional automatic rounds run every five minutes while the admin lab page remains open. This is not a deployed scheduler or a continuously running MQTT service.

## Data flow

1. An authenticated same-origin POST starts a detached, bounded Node scanner.
2. A private exclusive lock prevents parallel rounds. Rounds have a five-minute cooldown and an twelve-minute work budget.
3. One Python SDK client is reused throughout the round. Initializing one client per batch also repeats configuration requests and can exhaust their independent quota.
4. The SDK calls the current batch `/market-data/stocks/bars/list` endpoint. Each request has at most five symbols, requests up to 1,200 1-minute RTH bars per symbol, and is paced to at most 20 requests/minute. SDK internal retries are disabled; the Node owner controls retries.
5. An INVALID_SYMBOL batch is split into individual requests so a security unsupported by Sandbox doesn't discard its valid peers. Transient request failures get one retry. HTTP 401/403/429 stops the round, and unprocessed symbols are recorded as unavailable.
6. Unfinished minutes are excluded. The adapter validates identity, timestamps, finite positive OHLC, valid ranges, nonnegative volume and conflicting duplicates. It exports sanitized OHLCV only.
7. Private cache files under `data/webull/lab` are bound to the current credentials and region/environment. They are excluded from Git and release tracing. No credentials, fingerprint, raw HTTP bodies or SDK logs are returned to the browser.
8. Authenticated GETs read cached bars and scan coverage; they do not make a new provider request for each viewer.

The shared chart component renders native 1m bars or complete 5m/15m/1h aggregates from that same 1m dataset. Aggregates require every constituent minute; gaps are not filled. The displayed maximum is **1,200 1m bars**, not 1,200 independently fetched bars for each larger timeframe. The chart clock uses America/New_York with daylight saving handled by Intl; metadata uses Asia/Bangkok. HTTP response duration is labeled separately from market-data delay.

## Experimental entry rule

Rule version: `us-orb15-5m-sandbox-v1`. All calculations run on the server/CLI; the client imports only candle aggregation utilities.

- Long only, price at least $50, at least 55 completed 5m candles.
- The day's first three 5m RTH bars must be present and the loaded current session must have no 5m gap.
- EMA20/EMA50 trend, fresh closed-bar crossing above the 15-minute opening-range high with an ATR/tick buffer, price above that day's VWAP, volume at least 1.2 times the preceding 20 completed bars, RSI14 between 50 and 75.
- Entry window 09:45–15:25 New York, one entry per symbol/day in replay.
- Entry reference is the confirming candle's close. Stop is below the recent 10-bar low with an ATR buffer and at least 1.2 ATR away. Risk must be positive, no more than 2.5 ATR and 2% of the reference entry.
- The target is a **2R projection**, not a claimed resistance. If a known prior high leaves less than 2R, reject the entry rather than move the resistance.
- The score is a weighted condition score. It is not a probability or an empirical win rate.
- MATCH means the latest loaded Sandbox candle meets the rule and is recent within the current RTH session. HISTORICAL_MATCH identifies an older confirming candle. Neither is a customer trading alert.

## Replay integrity

The replay evaluates each closed candle using only its historical prefix. It never evaluates TP/SL on the same candle that first confirms entry at its close. Exit evaluation begins on the following candle, handles open-price gaps, and closes at the 15:50 New York candle close if still open. A missed early-close session or data gap remains unresolved; it does not invent an exit.

If the next bar opens through an exit threshold, its open is used. Otherwise, a candle touching both TP and SL without a known order is AMBIGUOUS. Missing bars/session discontinuities become DATA_GAP. Neither contributes to positive/negative resolved outcomes. Open positions are also unresolved. Counts can be zero when no bars meet every rule.

Replay is limited to the dataset returned for this round, usually roughly three RTH days for 1,200 minutes. It is not three months of history, does not include fees or slippage, and never writes to the customer AutoPick signal ledger or its latest-100 performance results. The voice preview is enabled only for a confirmed experimental entry in the loaded data, including a labeled historical entry, and explicitly says Sandbox.

The 2026-10-02 integration round processed all 101 catalog symbols in about 78 seconds. 100 returned 1,200 usable closed minute bars each (120,000 total); EA returned INVALID_SYMBOL in Sandbox. The round replay found one TXN entry, still OPEN with no resolved outcome, so it establishes no win rate. One unsupported symbol must remain visible in coverage rather than count as a successful scan. These are dated observations, not guaranteed provider coverage.

The 2026-10-03 round used the new 500-stock catalog. It processed all 500; 499 returned 1,200 closed minute bars each (598,800 total). BRK-B returned INVALID_SYMBOL. Replay found two entries: one stopped, one unresolved; none of the latest loaded candles matched. This is a Sandbox sample and establishes no customer win rate.

## Production boundary

This integration intentionally accepts only US Sandbox credentials. The Production credential trial returned 401; a recent Sandbox timestamp or `delay_minutes=0` does not verify Production authentication, data licensing or redistribution rights. Customer US AutoPick now uses the verified 500-stock FMP / Yahoo closed-daily workflow described in [US universe](./us-liquid-universe.md). Thai/DR/TFEX/Forex sources are unchanged.

The Python SDK plus detached Node process requires a Node/Python host. This lab cannot run unchanged inside a Cloudflare Worker. For a future Worker frontend, the private SDK collector must run separately and publish approved data to the backend; activating a Production source requires separate verification and market-data permissions.

Sources checked 2026-10-02:

- [Official Market Data overview and Sandbox delay/permissions](https://developer.webull.com/apis/docs/market-data-api/overview/)
- [Official Python SDK getting started](https://developer.webull.com/apis/docs/market-data-api/getting-started/)
- [App-key and per-endpoint rate limits](https://developer.webull.com/apis/docs/rate-limits/)
- Installed official `webull-openapi-python-sdk==3.0.2`, `MarketData.get_batch_history_bar`: documented max count 1,200; deprecated single-symbol endpoint delegates to the batch endpoint.
