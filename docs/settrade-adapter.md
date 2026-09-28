# Settrade read-only adapter

The first reusable market-data module is `src/market-data/settrade.mjs`. It supports read-only Settrade quotes and 15m/1H/4H/1D OHLCV for Thai shares and DR, plus read-only TFEX quotes. DR uses the same basic Settrade path as Thai shares; it does not depend on the old scanner's DR Tracker service. The module has no account, balance, order, portfolio, or trading operation. Keep it on the server; its credentials must never enter browser code or a public API response.

## Check capabilities without printing secrets

```sh
npm run probe:settrade -- --credentials-file /absolute/path/to/private-credentials.txt PTT AAPL80
npm run probe:settrade -- --market TFEX --credentials-file /absolute/path/to/tfex.txt S50U26 GOU26 SVFU26
```

For SET/DR the command reads the Settrade broker/app and app ID/secret fields. For TFEX it reads `TFEX_APP_ID` and `TFEX_APP_SECRET` (also accepting the confirmed local typo `TFEX_API_SECRET`); `TFEX_BROKER_ID` and `TFEX_APP_CODE` fall back to `SETTRADE_BROKER_ID` and `SETTRADE_APP_CODE`. If a file repeats `SETTRADE_APP_CODE`, the probe uses the first entry for SET/DR and the last entry for TFEX; this order was verified against the owner's file. It prints configuration names, authentication status, whether a quote has a price and source timestamp, and (for SET/DR) daily-bar counts/freshness. It never prints keys, tokens, quote prices, or raw API payloads. The same command can use environment variables if `--credentials-file` is omitted. Do not put credential files in this repo; `.gitignore` blocks common names but is not a substitute for checking before commit.

**Read-only verification on 25 September 2026:** one local `tfex.txt` contains general Settrade and TFEX app key pairs, and has two distinct values under repeated `SETTRADE_APP_CODE`. The first app code + general key pair returned PTT and DR AAPL80 quotes and 100 valid daily bars each, latest date 25 September 2026. The last app code + TFEX pair returned quotes for S50U26, GOU26 and SVFU26. Their provider timestamps were absent, so latency is unknown; historical TFEX candles were not verified. The probe suppressed prices and credentials. The earlier HTTP 404/403 came from pairing the market with the wrong app code/key pair. The old Production UI's status is historical context only; this new workspace is being built around direct provider data, not its screens or internal services.

**Intraday verification on 25 September 2026:** direct read-only requests for PTT and DR AAPL80 returned 100 timestamped OHLCV bars each with `interval=15m`, `interval=60m` and `interval=240m` (HTTP 200). Sending `1h` and `4h` as provider interval values returned HTTP 400. The workspace maps its 1H and 4H buttons to `60m` and `240m`, keeps Unix timestamps in seconds for Lightweight Charts, and formats chart labels in Bangkok time. The chart requests a new snapshot on symbol/timeframe selection or manual refresh; it is not a streaming feed. These two instruments establish the path but not coverage for every catalogue symbol or redistribution rights.

## Data semantics

- A quote is `available` only when the provider sends a finite `last`. `receivedAt` is our fetch time. `observedAt` is populated only from a parseable provider timestamp. If absent, latency remains `unknown`; the app must not call it real-time.
- Daily bars require a valid Bangkok trading day, complete finite OHLCV, a consistent high/low range and nonnegative volume. Invalid or duplicate days are rejected rather than given the current timestamp.
- Intraday bars require a unique Unix timestamp in seconds and complete, valid OHLCV. Future timestamps are filtered before the API responds. The current 72-hour freshness gate is provisional until a market-session calendar is integrated; the latest bar can be incomplete.
- `assessDailySeries` marks a latest bar older than seven calendar days `stale` and ineligible for a **new** signal. Historical display may still show the bar with its date. Seven days is a conservative temporary gate; replace it with the SET session calendar before production signal generation.
- A successful quote does not imply candle access for every symbol or interval. PTT and AAPL80 were checked separately; other instruments may still return unavailable.
- The module does not combine Yahoo or any other source into a Settrade series. TFEX quote support is verified, but TFEX historical candles remain unverified; show quote-only until a true contract candle endpoint is proven.

## Before serving charts to other users

Confirm the broker/SET agreement covers display, storage and redistribution. The local workspace has allowlisted read-only HTTP routes and a production display-rights gate. Add user authentication and stronger response limits before broad external access.
