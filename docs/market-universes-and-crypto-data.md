# Market universes and price-source plan

**Updated:** 25 September 2026

## Agreed instrument groups

| Group | Universe rule | Data and update notes |
|---|---|---|
| SET100 | Use the official SET100 constituents for the active index period. Do not replace this with the 100 largest names at each quote refresh. | Save the constituent period/effective date alongside the registry so historical signals keep their original universe. |
| mai | Use the 50 mai securities with the highest market capitalization. | A quote alone does not provide a trustworthy market-cap rank. The ranking feed/reference source and refresh schedule must be verified before automating this universe. Save the ranking date and source. |
| DR80 | Include instruments whose SET symbol ends exactly in `80`. Load the current exchange list so new listings are included; do not hardcode a permanent count. | The remembered count of 113 appears to predate recent listings: SET announced 28 new KTB-issued DRs to begin trading 9 September 2026, and the reported DR80 total after that issue is 141. SET's all-issuer DR total is a different count and includes other issuer codes. [SET listing announcement](https://www.set.or.th/en/market/news-and-alert/newsdetails?id=106730500&symbol=SET&t=SET+News+%3A28+new+DRs+referencing+securities+in+Asia%2C+U.S.%2C+and+Europe+issued+by+KTB+to+start+trading+on+September+9), [total reported by KTB](https://radiokhonkaen985.prd.go.th/pdf/web/viewer.html?file=%2Fth%2Ffile%2Fget%2Ffile%2F202609093fef14fad3534d099ba585f448e175fb160939.pdf). |
| TFEX | SET50, gold and silver futures. Each listed contract/expiry is a separate instrument. | Quotes for S50U26, GOU26 and SVFU26 were verified. Provider timestamp and historical candles remain unknown. |
| International equities | Use Webull as the candidate source; decide the popular-symbol universe together later. | Do not invent a permanent stock list yet. |
| Forex | Keep the category; select and verify a pair/quote provider before connecting it. | Distinguish spot FX from CFDs/futures and record provider, quote currency and timestamp. |
| Crypto pairs | The pair list can be supplied to an exchange adapter; start with spot pairs unless the user specifies perpetual futures. | Recommended candidate: Binance Spot public market-data API. Use the same exchange's quote, ticker and candles for a pair; do not silently aggregate or stitch prices across exchanges. |

## Crypto price fields and source

For each configured spot pair (for example, `BTCUSDT`), the adapter should fetch:

- exchange metadata and trading status, to confirm the pair is currently listed;
- latest quote/24-hour ticker for last price, change, high/low and volume;
- OHLCV klines at the selected chart interval;
- WebSocket kline/ticker updates for live refresh, if needed.

Binance documents a market-data-only REST host and WebSocket host that do not require an API key for public market data. Its public endpoints include exchange information, ticker data and klines. [Market-data-only access](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md), [REST API](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md), [WebSocket streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md).

Connectivity was checked from this workspace on 25 September 2026: the public `exchangeInfo`, `ticker/24hr` and daily `klines` endpoints for `BTCUSDT` all returned HTTP 200. The check did not print or store price values. This confirms endpoint reachability and response shape from this environment, not display/redistribution rights or reachability from every deployment region.

**Important separation:** spot `BTCUSDT` and perpetual `BTCUSDT` are different instruments and must have different IDs, candles, signal outcomes and labels. If perpetuals are selected later, use their derivatives market-data API, not the spot series.

## Thailand universe source work

- Settrade quote/daily-bar access is verified for PTT and DR AAPL80. It does not yet establish full-universe access or provide the mai market-cap ranking source.
- SET's SMART Marketplace describes API products for current snapshots, historical intraday trading data, end-of-day data, reference data and corporate actions. Product access and redistribution terms must match the app's use. [SMART Marketplace](https://www.set.or.th/en/services/connectivity-and-data/data/smart-marketplace), [SET Market Data API specification](https://media.set.or.th/set/Documents/2023/May/Market_Data_API_Service_Specification.pdf).
- Until the correct mai market-cap reference is connected, show the ranking source and as-of date as unavailable rather than calling an arbitrary 50-name list “top by market cap.”

## Registry fields

Every universe entry should carry:

`instrumentId`, `symbol`, `market`, `venue`, `productType`, `baseAsset`, `quoteAsset`, `currency`, `expiry`, `universeRule`, `rank`, `rankAsOf`, `source`, `status`.

Store membership/rank snapshots with effective dates. This keeps past signals associated with the universe and instrument definition that existed when they were created.

The new code now provides these snapshot helpers in `src/markets/universe.mjs`. Actual SET100/mai/DR80 symbol membership is supplied as a dated source snapshot rather than guessed or copied as a permanent list. The crypto adapter in `src/market-data/binance-spot.mjs` checks exchange metadata, returns spot quote fields, and normalizes OHLCV klines; run `npm run probe:binance-spot -- <PAIR>` for a sanitized availability check. It does not contain a hardcoded crypto watchlist and is not connected to the visual prototype yet.
