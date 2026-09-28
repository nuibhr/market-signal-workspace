# Symbol search and analysis panel

**Workspace snapshot:** 25 September 2026

The top bar searches the complete local catalogue across six market categories. Choosing a symbol updates the selected instrument, chart request, support/resistance monitor, indicator values and right analysis panel together. Only the selected Thai/DR symbol makes a Settrade candle request at the selected 15m/1H/4H/1D interval. Unavailable instruments remain searchable and show a clear no-feed state.

| Category | Search entries | Provenance and limit |
|---|---:|---|
| Thai SET100 | 100 | 2026 H2 official constituent snapshot documented by the earlier scanner. Membership is dated and is not automatically refreshed. [SET constituents page](https://www.set.or.th/en/market/information/securities-list/constituents-list-set50-set100) |
| Thai mai | 50 | Initial user-approved list carried from the earlier scanner. **It has not been validated as the top 50 by market cap.** The UI labels this clearly. The correct ranking needs a dated market-cap feed. |
| DR80 | 141 | KTB 113-name snapshot of 14 August 2026 plus the [28 DRs announced for 9 September 2026](https://www.set.or.th/en/market/news-and-alert/newsdetails?id=106730500&symbol=SET). All entries end in `80`. This is a dated search list, not an automatically refreshed exchange register. |
| TFEX | 3 | S50U26, GOU26 and SVFU26 contracts whose quote path was previously checked. Historical candles are still unavailable. |
| International | 3 | NVDA, AAPL and SPY are starter symbols only; the user will decide the wider popular list later. |
| Forex / spot metals | 19 | Major currency pairs and selected crosses, plus XAU/USD and XAG/USD. The MT5 bridge is still pending. |
| Crypto spot | 2 | BTCUSDT and ETHUSDT starter pairs. |

The local Settrade API is now allowlisted by this catalogue for Thai SET100, the provisional mai list and DR80. A name in the search catalogue does **not** establish quote access. Each request may still return unavailable. Daily candles dated after the current Bangkok date and intraday candles timed in the future are excluded before charting or analysis. A recently listed instrument with fewer than 50 valid bars at the selected interval can show its chart, while its technical plan stays unavailable. The production display-rights gate remains active.

The right panel uses a **deterministic rule engine** for all numeric values and conditional plans. It calculates EMA20, EMA50, RSI14, MACD(12,26,9), Bollinger(20,2), and nearby pivot support/resistance from actual OHLCV bars at the chosen interval. It monitors EMA20 crossings, 20-bar high breaks, RSI extreme zones, and proximity to support. The displayed plan is not a generated order, execution instruction, or measured win probability. If the latest bar is stale, it suppresses the current plan and scan events. If there are no real candles, it shows no technical plan. The latest intraday bar may still be forming, and charts are snapshot requests rather than streaming or automatic polling.

When a current Thai/DR symbol has at least 50 actual bars, the local development server sends a compact numeric snapshot, interval and latest bar time to an Ollama model installed on this Mac (`qwen3:4b` by default). The model writes a Thai-language explanation in the purple AI Analyst card. It cannot change the calculated price levels or plan. The card identifies its model, shows loading/unavailable states, and does not appear for demo prices, stale data, or insufficient history. This local route is disabled in production until a production provider and deployment policy are chosen. No API key is needed for the local model, and the snapshot stays on this computer.

## Chart Toolbox and Live Market Watch

The workspace now adapts two useful patterns observed in the [Alpha AI Signals workspace](https://alphasigs.net/): an expandable Toolbox directly below the chart, and a dedicated Live Market Watch beside it. The Toolbox opens on **Indicators**, grouped into **Trend** and **Oscillator**, with individual sections for Pivot Points & Levels, Trend Indicators, Volatility, Volume, Momentum Oscillators and MACD. Core Signals and Alerts are separate tabs. The EMA20, EMA50, Bollinger and support/resistance controls toggle overlays on the selected symbol's Lightweight Chart. The numeric values come from the selected symbol's actual bars at the selected interval, and the indicator panel shows a no-feed or historical badge when appropriate. Alerts still open the clearly marked demo panel; they are not persistent notifications.

The watch panel has **Market**, **Levels** and **Favorites** tabs. Selecting a row changes the chart and analysis together. The selected symbol is pinned to the top of its market list. The quote route asks Settrade for at most six allowed Thai/DR symbols per request and the client requests a new snapshot every 60 seconds. The row for the selected symbol displays price, change, high, low, volume and the provider quote time when present; the footer separately identifies the API receipt time. A recent API receipt does not prove the market quote itself is current. Other markets and unsupported Thai/DR instruments retain a visible no-feed state. Quote snapshots are not a streaming tick feed, and the production display-rights gate remains in force.
