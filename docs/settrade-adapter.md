# Settrade read-only adapter

The first reusable market-data module is `src/market-data/settrade.mjs`. It ports only broker-app login, Thai quote, and daily OHLCV requests from the old app. It has no account, balance, order, portfolio, or trading operation. Keep it on the server; its credentials must never enter browser code or a public API response.

## Check capabilities without printing secrets

```sh
npm run probe:settrade -- --credentials-file /absolute/path/to/private-credentials.txt PTT AAPL80
```

The command reads only `SETTRADE_BROKER_ID`, `SETTRADE_APP_CODE`, `BROKER_APP_ID`/`SETTRADE_APP_ID`, and `BROKER_API_SECRET`/`SETTRADE_APP_SECRET` from the file. It prints configuration names, authentication status, whether a quote has a price and source timestamp, and daily-bar counts/freshness. It never prints keys, tokens, quote prices, or raw API payloads. The same command can use environment variables if `--credentials-file` is omitted. Do not put credential files in this repo; `.gitignore` blocks common names but is not a substitute for checking before commit.

`AUTH_FAILED` with HTTP 404 is the result from the owner's local `tfex.txt` on 25 September 2026. This did not test Vercel Production keys. The old app's Production UI does show SET and mai scanner results labeled “Settrade Market API”; its DR Tracker reports a missing credential and the TFEX page shows unavailable quotes. The UI observation is evidence of displayed data, not an authenticated server-side capability report.

## Data semantics

- A quote is `available` only when the provider sends a finite `last`. `receivedAt` is our fetch time. `observedAt` is populated only from a parseable provider timestamp. If absent, latency remains `unknown`; the app must not call it real-time.
- Daily bars require a valid Bangkok trading day, complete finite OHLCV, a consistent high/low range and nonnegative volume. Invalid or duplicate days are rejected rather than given the current timestamp.
- `assessDailySeries` marks a latest bar older than seven calendar days `stale` and ineligible for a **new** signal. Historical display may still show the bar with its date. Seven days is a conservative temporary gate; replace it with the SET session calendar before production signal generation.
- A successful quote does not imply daily-bar access, and daily-bar access does not imply intraday data rights. The probe reports them separately.
- The module does not combine Yahoo or any other source into a Settrade series. TFEX contracts use their own adapter and need verified contract candles.

## Before serving charts to other users

Confirm the broker/SET agreement covers display, storage and redistribution. Add authentication and response limits to any HTTP endpoint exposing normalized data. The current module and CLI are server-side foundations only; no HTTP endpoint or UI has been published from this repo.
