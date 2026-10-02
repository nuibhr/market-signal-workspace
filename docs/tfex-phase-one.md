# TFEX Phase 1: quote board

Updated 30 September 2026. Webull is outside this integration.

## What is now available

- The server-side Settrade adapter reads TFEX quotes using the TFEX app credentials. A read-only probe found quotes and 15m candles for S50Z26, GOZ26, and SVFZ26 on 30 September. It did not call account, portfolio, balance, order, or execution APIs.
- Historical OHLCV is now available through the server-side TFEX adapter for 15m, 1h, 4h and 1d charts. A sanitized read-only check returned timestamped bars for S50V26 on all four intervals; the candle times are Unix seconds and incomplete bars are removed before they reach the chart. No account or order API is involved.
- The workspace builds candidate contract months from the Bangkok calendar and the published month rules. The verified September contracts S50U26, GOU26, and SVFU26 expired on 29 September and are removed on 30 September. S50Z26, GOZ26, and SVFZ26 appear first. Other unexpired candidates remain searchable. These are *candidates by contract month*, not a claim about which contract is most liquid or the correct one to trade.
- TFEX candidates appear in Market Watch. The first six candidates are read from `/api/tfex/quotes`; the selected contract appears in the main price panel and its OHLC chart. The server keeps credentials private and caches quote reads briefly.
- Price, high/low, volume and open interest are shown when the provider returns them. The UI labels the source and receive time, and explicitly says when the provider did not supply an observation timestamp.
- Production quote display remains closed unless `TFEX_DISPLAY_RIGHTS_CONFIRMED=true` is set after the applicable display rights have been confirmed.

## What remains unavailable

- The quote endpoint still may not provide its own observation timestamp. The chart uses timestamped OHLC bars and shows the quote's timestamp limitation separately.
- AutoPick, entry/TP/SL plans and outcome settlement stay off for TFEX until active-contract selection, product trading sessions, tick rounding, costs and margin rules have been verified together. The chart and quote board do not imply a live trade signal.
- Current month rank is not a volume/liquidity ranking. Confirm rollover using official contract schedules and market data before any active-contract label is introduced.

## Contract metadata sources

- [SET50 futures specification](https://www.tfex.co.th/en/products/equity/set50-index-futures/contract-specification): multiplier 200 THB per point; tick size 0.1 index point.
- [SET50 trading calendar](https://www.tfex.co.th/en/products/equity/set50-index-futures/trading-calendar): U26 last trading day 29 September, Z26 last trading day 29 December 2026.
- [Settrade historical candlestick reference](https://developer.settrade.com/open-api/api-reference/reference/sdkv2/python/market-historical-data/2_getCandlestick): historical candle method used as the provider reference.
- [Gold Online Futures specification](https://www.tfex.co.th/en/products/precious-metal/gold-online-futures/contract-specification): multiplier 300; tick size USD 0.1 per troy ounce.
- [Silver Online Futures specification](https://www.tfex.co.th/en/products/precious-metal/silver-online-futures/contract-specification): multiplier 3,000; tick size USD 0.01 per troy ounce.
- [GO trading calendar](https://www.tfex.co.th/th/products/precious-metal/gold-online-futures/trading-calendar) and [SVF trading calendar](https://www.tfex.co.th/en/products/precious-metal/silver-online-futures/trading-calendar): expiry is contract-specific; do not infer the active contract from the month code alone.

The app calculates tick value in baht as a convenience from the published multiplier/tick size. It does not include fees, FX conversion changes, margin, or slippage and must not present that calculation as a full risk estimate.
