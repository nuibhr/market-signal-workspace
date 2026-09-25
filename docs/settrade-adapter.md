# Settrade read-only adapter

The first reusable market-data module is `src/market-data/settrade.mjs`. It supports read-only Settrade quotes and daily OHLCV for Thai shares and DR, plus read-only TFEX quotes. DR uses the same basic Settrade path as Thai shares; it does not depend on the old scanner's DR Tracker service. The module has no account, balance, order, portfolio, or trading operation. Keep it on the server; its credentials must never enter browser code or a public API response.

## Check capabilities without printing secrets

```sh
npm run probe:settrade -- --credentials-file /absolute/path/to/private-credentials.txt PTT AAPL80
npm run probe:settrade -- --market TFEX --credentials-file /absolute/path/to/tfex.txt S50U26 GOU26 SVFU26
```

For SET/DR the command reads the Settrade broker/app and app ID/secret fields. For TFEX it reads `TFEX_APP_ID` and `TFEX_APP_SECRET` (also accepting the confirmed local typo `TFEX_API_SECRET`); `TFEX_BROKER_ID` and `TFEX_APP_CODE` fall back to `SETTRADE_BROKER_ID` and `SETTRADE_APP_CODE`. If a file repeats `SETTRADE_APP_CODE`, the probe uses the first entry for SET/DR and the last entry for TFEX; this order was verified against the owner's file. It prints configuration names, authentication status, whether a quote has a price and source timestamp, and (for SET/DR) daily-bar counts/freshness. It never prints keys, tokens, quote prices, or raw API payloads. The same command can use environment variables if `--credentials-file` is omitted. Do not put credential files in this repo; `.gitignore` blocks common names but is not a substitute for checking before commit.

**Read-only verification on 25 September 2026:** one local `tfex.txt` contains general Settrade and TFEX app key pairs, and has two distinct values under repeated `SETTRADE_APP_CODE`. The first app code + general key pair returned PTT and DR AAPL80 quotes and 100 valid daily bars each, latest date 25 September 2026. The last app code + TFEX pair returned quotes for S50U26, GOU26 and SVFU26. Their provider timestamps were absent, so latency is unknown; historical TFEX candles were not verified. The probe suppressed prices and credentials. The earlier HTTP 404/403 came from pairing the market with the wrong app code/key pair. The old Production UI's status is historical context only; this new workspace is being built around direct provider data, not its screens or internal services.

## Data semantics

- A quote is `available` only when the provider sends a finite `last`. `receivedAt` is our fetch time. `observedAt` is populated only from a parseable provider timestamp. If absent, latency remains `unknown`; the app must not call it real-time.
- Daily bars require a valid Bangkok trading day, complete finite OHLCV, a consistent high/low range and nonnegative volume. Invalid or duplicate days are rejected rather than given the current timestamp.
- `assessDailySeries` marks a latest bar older than seven calendar days `stale` and ineligible for a **new** signal. Historical display may still show the bar with its date. Seven days is a conservative temporary gate; replace it with the SET session calendar before production signal generation.
- A successful quote does not imply daily-bar access, and daily-bar access does not imply intraday data rights. The probe reports them separately.
- The module does not combine Yahoo or any other source into a Settrade series. TFEX quote support is verified, but TFEX historical candles remain unverified; show quote-only until a true contract candle endpoint is proven.

## Before serving charts to other users

Confirm the broker/SET agreement covers display, storage and redistribution. Add authentication and response limits to any HTTP endpoint exposing normalized data. The current module and CLI are server-side foundations only; no HTTP endpoint or UI has been published from this repo.
