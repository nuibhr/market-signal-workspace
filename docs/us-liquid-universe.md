# US liquid-stock universe · 3 October 2026

## Current customer scanner

The US catalog and AutoPick universe contain **500 unique stocks**, plus the previous 50 ETFs in the search catalog only. All 500 were verified against closed daily OHLCV ending **2026-10-02**, and a real worker run completed **500/500** at **2026-10-03 04:08:34 UTC**. Coverage: no unavailable or pending symbols. One new waiting plan was published; this is not a confirmed entry or a winning trade.

“Popular” means liquidity, not social mentions or a price-gain leaderboard. The observed window is **2026-07-02 to 2026-10-02**. This is a disclosed shortlist approach, not proof of the exact top 500 across every US security.

1. Read Nasdaq Trader's Nasdaq/other-listed directories: 5,977 stock candidates after excluding ETFs, test issues, funds, preferred shares, units, rights, warrants and notes.
2. Obtain Yahoo USD equity quotes: 5,752 candidates with usable price and three-month average volume.
3. Shortlist 1,500 by latest price × three-month average daily shares volume.
4. Load actual daily OHLCV for every shortlisted stock. Require at least 60 total closed bars, at least 50 bars in the observed window, positive trading volume, valid USD equity identity, ordered valid OHLCV and an exact latest closed day of 2026-10-02.
5. Rank the 1,495 passing stocks by mean daily close × volume within the window; keep 500. Most selected stocks have 65 observed sessions; newer stocks still need the minimum history above.

Excluded for incomplete or stale history: VYLR, ACCV, BRK-A, IOND and JMKE. No prices or candles were generated to replace missing data. Missing quote records and lower-ranked candidates are not treated as passing.

The first ten ranked names are MU, NVDA, SNDK, AAPL, TSLA, MSFT, SPCX, META, AMD and INTC. Rankings and observations are dated; availability and membership can change.

## Operation and integrity

- `src/markets/us-liquid-500.mjs` holds the generated metadata and catalog. `src/markets/us-universe.mjs` derives the common symbols and versioned scan slot used by the worker, admin/customer coverage and replay.
- The existing catalog, chart, holdings analysis, AutoPick and aggregate historical replay share the same 500-stock selection. Existing stored signals and outcomes remain intact, including instruments no longer selected for new plans.
- Customer US signals use validated **closed daily candles**, not Webull Sandbox, intraday quote snapshots or the general Yahoo chart-only fallback. `getUsDailyBars` tries FMP and falls back to a separate Yahoo EOD adapter. The current FMP quota/plan restrictions make that fallback necessary.
- Scan windows remain after 16:30 New York, with catch-up before 08:00 the next day, using timezone-aware rules. The worker wakes every 30 seconds, consumes a bounded/resumable candidate budget, and records all symbols as evaluated even when entry gates reject them. Scannable is separate from entry-confirmed.
- Cached market data is private, bounded, schema checked, atomically saved and excluded from Git/release tracing. A cache never turns an unfinished bar into a confirmed close. Requests are paced, and rate limits temporarily stop the exhausted source.
- General multi-market Yahoo historical chart fallback remains chart-only; it cannot trigger Thai, DR or Forex signals. The separate US EOD adapter is explicitly labeled after-close in the customer chart.
- Production uses the existing persistent-host and member-access checks. US EOD needs actual provider display/storage permission, controlled by `FMP_DISPLAY_RIGHTS_CONFIRMED` and/or `YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED`. No permission or key was silently enabled in `.env.local`.
- This change expands coverage, not strategy performance. The current US rule remains `us-eod-breakout-v0.2-unvalidated`; no win rate is inferred from the number of stocks or bars. Performance still comes from the same entered/exited signal ledger and latest 100 valid closed trades.

## Regenerate

Run `npm run universe:us` explicitly as a maintenance task. It determines the latest closed AAPL day; an optional `-- --as-of=YYYY-MM-DD` fixes a historical date. Resume files are stored in ignored `data/us-universe`; the generated source is replaced only after 500 verified stocks are available. This is not launched by customer page loads or an API read. Allow enough request quota and time for the disclosed 1,500-history validation pool. Regeneration changes the universe version and opens a new scan slot while preserving the signal ledger.

## Webull evidence and live-data boundary

A separate admin SDK round using this 500-stock catalog completed on 2026-10-03: **499 stocks × 1,200 closed 1-minute bars = 598,800 bars**. BRK-B returned INVALID_SYMBOL in Webull Sandbox; its verified Yahoo daily candles remain usable by the customer EOD scanner. The Sandbox replay found two entries, one stopped and one unresolved, and zero latest-candle matches. These experimental counts never enter customer performance.

The current key was checked again against US Production on 2026-10-03 and returned **401 UNAUTHORIZED**. The passing Sandbox snapshot/history/MQTT probe cannot establish Production access or customer redistribution rights. Explicit-environment probes save separate scoped reports, preserving the current Sandbox evidence. The admin system panel now displays this Production result.

To enable actual live customer data, obtain a Production-enabled key and the required OpenAPI market-data entitlement from Webull. Mobile/QT data subscriptions are separate. External subscriber display requires agreement on display/distribution access; the documented Non-Display entitlement alone should not be treated as permission to redistribute the feed. Then verify actual traded-price messages and provider timestamps during an open market session and implement the customer stream with reconnect/resubscribe and stale-feed behavior. Do not relabel cached Sandbox or daily data as live.

## Sources

- [Nasdaq Trader symbol directory definitions](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs)
- [Yahoo Finance 2 maintainer documentation — unofficial Yahoo endpoints](https://github.com/gadicc/yahoo-finance2)
- [FMP API quickstart](https://site.financialmodelingprep.com/developer/docs/quickstart)
- [Webull market-data permissions and Sandbox delay](https://developer.webull.com/apis/docs/market-data-api/overview/)
- [Webull OpenAPI Advanced Quotes subscription](https://developer.webull.com/apis/docs/market-data-api/subscribe-quotes/)
- [Webull Hosted Display Solution for external subscribers](https://developer.webull.com/apis/docs/market-data-api/hosted-display-solution/)
