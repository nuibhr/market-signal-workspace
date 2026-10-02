# Market workspaces and DR Tracker — 2026-10-02

## What changed

The existing Next.js application now has an entry page at `/` and five addressable workspaces. It uses the existing member database, LINE authentication, credits, holdings, saved scans, signal ledger and scan workers.

| Route | Market | Accent / presentation |
| --- | --- | --- |
| `/thai` | Thai equities | Green, daily market routine |
| `/dr` | Depositary receipts | Gold, dark strategy tracker |
| `/tfex` | TFEX | Orange, contract desk |
| `/us` | US equities | Blue, global market desk |
| `/forex` | Forex | Purple, currency and macro desk |

The DR presentation adapts the card hierarchy, status filters and SL–entry–TP price track from [the supplied repository](https://github.com/nuibhr/--dr-strategy-tracker-----ai-research), inspected at commit `5073bbccf0f209e461aa7727542ab1b9d682bd8d`. The reference repository was read, not executed. Its authentication, databases, provider code and order integrations were not imported.

DR cards use this app's actual signal records. A waiting plan has a planned entry; an entered plan uses its recorded entry. Return is calculated only when an entry and a reference price exist. The latest event price is labelled as an event reference, not a live quote. No synthetic picks or win-rate figures are seeded into the customer database.

Saved scans, favorites, holdings and results are displayed in their market's workspace. Signal and event lists remain limited to seven displayed records. The existing web alert polling still reads all markets so users can receive an event while viewing another market. Existing alert age, deduplication and voice activation rules remain in place.

## Connection adopted from the alternate version

Added the server-only `yahoo-finance2` Node adapter for historical charts. This is an unofficial Yahoo Finance client. The supplied Python version's Finnhub and Twelve Data keys were blank, and these connections could not be verified, so they were not imported.

Yahoo instrument mapping is explicit: Thai/DR symbols use `.BK`; US symbols use their catalog symbol; currency pairs use `=X`. Returned symbol, currency and (where applicable) exchange must match. The adapter rejects incomplete or malformed OHLC candles and ambiguous duplicates. It has a request timeout, two-request provider queue, five-minute bounded cache and in-flight deduplication. The API accepts only catalog instruments and has a shared provider request limit.

| Actual read-only probe | Closed bars returned |
| --- | ---: |
| PTT.BK, 1D | 736 |
| AAPL80.BK, 1D | 340 |
| NVDA, 1D | 755 |
| 17 catalog currency pairs, 15m | 4,066–4,087 per pair |

Yahoo is the chart fallback when the primary Thai/DR or US daily feed is unavailable. US intraday and supported Forex charts use Yahoo directly. Supported intervals are 15m, 1h and 1D. Request windows are 59, 700 and 1,100 days respectively; returned count depends on the provider and instrument. These are not guarantees of complete history or measured market latency.

The chart, scanner comparison and Multi-TF tools label the historical source. Intraday pivot context uses completed daily candles. Forex price displays retain five decimals (three for JPY quote pairs). Forex volume is unavailable in this feed; volume/VWAP overlays and Volume Pulse are not shown as real market volume.

Every Yahoo response has `chartOnly: true` and `signalEligible: false`. It cannot confirm AutoPick entries, feed server trading-plan/AI requests, update signal outcomes or inflate historical win rates. Yahoo data is not added to the scanner's archived history in this change.

## Readiness and limits

- XAU/USD and XAG/USD are not mapped to Yahoo futures as substitutes. The 17 currency pairs have verified charts; the two metals retain their existing quote/feed readiness.
- TFEX and Forex AutoPick remain subject to their existing readiness gates. Creating market pages does not enable their signals.
- Production Yahoo display requires `YAHOO_DISPLAY_RIGHTS_CONFIRMED=true` once the operator has confirmed their intended use with the provider. The example defaults to false.
- `.env.local` and customer data were not changed or committed.
- This is still the existing Node/SQLite application. It does not complete the Cloudflare Workers/Cron/D1 deployment migration.

## Review evidence

- Actual Yahoo provider calls succeeded for the examples and all 17 supported currency pairs above.
- Existing test suite: 27 passed, 0 failed (market data, customer signal flow, ledger, payload allowlists, LINE flow, request limits, encrypted backup).
- Production compilation completed with `NUGAOM_REVIEW_MODE=true npm run build`, using the isolated review build directory.
- Browser review: all five routes render the correct market, symbol and theme. At 390 × 844, each page had document width and scroll width of 390; mobile market navigation and the complete tools menu were checked.
- Forex Multi-TF returned actual 15m, 1h and 1D values, and chart/history source labels were inspected in the browser.
- Browser screenshots are kept outside the Git repository to avoid committing member profile information.
