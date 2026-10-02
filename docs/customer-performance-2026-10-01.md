# Customer outcomes and historical replay

Customer page: ผลงานสัญญาณ. System signal table has seven records per page with pagination; live picks and recent event cards show seven at a time.

- Actual outcomes use immutable observed entry/exit reference prices and show entered, settled, wins/losses/breakeven and the observed date range.
- Historical replay is a whole-market three-month aggregate (Thai/DR/Nasdaq universe), not a button on each stock. Each input symbol is processed server-side in a bounded background step; stored summaries are read by the UI.
- Replay fetches historical candles where configured and retains previously archived bars when the provider fails. Missing/unprocessed symbols are counted explicitly. Intraday/night-session completeness is not certified merely because the earliest candle is old enough.
- No win rate is fabricated from watch plans that never entered. Unresolved and ambiguous outcomes are excluded from settled win-rate denominator. Repeated trades in the same stock count as separate signals.
- Copy summary includes period, processed/expected instruments, data coverage, entries, wins/losses and whether data is incomplete, plus fees/slippage disclosure.
- Proprietary trade plan construction moved from the client bundle to an authenticated server endpoint. Customer feeds/results whitelist price levels and statuses; scanner gates/features/rule versions/reasons are not returned. Ordinary chart indicators remain available.
- Voice ENTRY for DR now announces entry, price reference, target, stop and chase ceiling without reciting ORB/VWAP gates.

Cloudflare: schema prepared, existing Node/SQLite runtime still local until async D1 repositories and scheduled queue consumers are ported. No deployment performed in this change. No automated tests or browser verification run.
