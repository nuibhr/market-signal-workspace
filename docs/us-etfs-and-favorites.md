# US ETFs and favorites — 2026-10-03

## Actual coverage

- US customer AutoPick remains 500 stocks on closed daily candles.
- ETF catalog: 100 verified USD funds; previous catalog had 50.
- 49 previous funds retained; 51 additional verified funds fill the total to 100. The old SPLG name was mapped to SPYM for verification, but Yahoo returned mismatched instrument identity. It was excluded rather than accepting stale or aliased prices. Existing signal and holding records are preserved.
- Selected from the Nasdaq Trader ETF directory and Yahoo quotes, with additions ranked by mean daily close × volume for 2026-07-02 through 2026-10-02, among the top 150 liquid ordinary-fund candidates. This is a liquidity proxy, not a measure of social popularity or an exhaustive global ETF ranking. New leveraged/inverse funds and ETNs were excluded by directory name.
- 156 candidates passed closed OHLCV validation; all 100 published funds have at least 60 daily bars, 50 bars in the trailing three-month window, and latest day 2026-10-02.
- ETF chart requests pass an explicit ETF identity to the Yahoo adapter. Stocks still require EQUITY; mutual funds are rejected. Stock cache keys remain compatible.
- ETF charts, technical review, favorites and manual holdings work. ETFs do not enter the stock AutoPick ledger, historical win rate, or entry audio automatically. A separately evaluated ETF strategy is needed before enabling that.

## Webull read-only evidence

- Production region us: HTTP 401 UNAUTHORIZED using the current local credentials.
- Sandbox region us: authenticated; AAPL snapshot and 1,200 valid closed M1 bars returned.
- Saturday market is closed. Neither a Sandbox success nor a historical bar response confirms customer realtime market data. Official OpenAPI subscriptions are separate from mobile/QT advanced quote subscriptions. No credentials changed; no orders sent.

## Favorite flow

- Gold star buttons with save/remove labels, pressed state, 44+ px targets and an accessible confirmation.
- Quick strip shows up to eight names and a button opening the full favorites board.
- US catalog, search and board have separate stock/ETF tabs. Favorites supports both together or filtered separately.
- Board reads only six names per page. US summaries display closed D1 price, daily change, date, trend, technical score and a brief watch condition. Score is not a probability of winning. Failed data stays unavailable.
- US summaries use shared validated histories, deduplicate requests, cache successful reviews for ten minutes and failures for thirty seconds, cap simultaneous provider reads at twelve, and rate limit uncached batches. The open browser checks every five minutes; this does not change the AutoPick worker schedule.
- Favorites persist in this browser via localStorage and update across tabs. They are not yet stored against the LINE account across devices. The next useful addition is LINE-account synchronization, followed by optional per-favorite price alerts once a confirmed live feed is available.
- A favorite means interested, not purchased. The separate existing Holdings desk accepts manual cost and quantity, including ETF symbols, and gives a cost-based review.
- On phones the favorite list appears before the selected asset detail card. No extra menu for the same task is needed.

## Refresh

Run npm run universe:etfs manually. It publishes only after 100 funds pass; private history and exclusion reports stay under ignored data/us-etfs.

## Published symbols

SPY, QQQ, IWM, SMH, VOO, IVV, SOXX, GLD, LQD, EWY, HYG, DRAM, TLT, SGOV, GDX, IBIT, XLF, XLE, DIA, RSP, XLV, XLK, BITO, XBI, EEM, XLI, EFA, VTI, IGV, KRE, XLU, BIL, IEMG, SLV, AGG, XLP, IEFA, QQQM, EWZ, MUB, USO, VCIT, XLY, SCHD, IEF, VEA, VTEB, FXI, EMB, BND, ETHA, XLC, VTV, XLB, XOP, VUG, IYR, GDXJ, EWT, MTUM, IJH, VGT, IWF, KWEB, USHY, VXUS, IJR, IAU, VWO, IWD, MDY, ARKK, EWJ, VT, GLDM, VCSH, BOXX, ACWI, JEPQ, MBB, VCLT, SHV, XRT, SHY, VNQ, ITOT, SCHG, JEPI, VIG, SCHB, BNDX, TIP, VYM, IXUS, SCHH, HDV, PDBC, DGRO, DVY, DGRW
