# Forex / CFD Command Center — Phase 1

Baseline: `cf74b0d7e4b5e255ba7646e4b3b6ec48dd79a82e`.

Only `/forex` now renders `ForexWorkspace`. The shared workspace, market navigation,
market catalog, global styles, other markets, membership, LINE authentication,
admin, D1 migrations, and Auto Pick remain unchanged. New styles use CSS Modules;
the existing `MarketNavigation` is reused with local, Forex-only styling.

## Current behavior

The UI follows the supplied trading-terminal reference: compact dark navy panels,
cyan/green accents, a market ticker, command-center banner, six account metrics,
opportunity cards, an interactive candlestick chart with overlays and RSI/MACD,
AI-analysis layout, heatmap, session overview, scanner, account panel, risk,
journal, calendar, and alert previews. These are dedicated Forex subviews inside
the existing market navigation, not new top-level product destinations.

- Ten views: Overview, Scanner, Advanced Chart, MT5 connection, Positions,
  Risk Management, AI Analysis, Trade Journal, News & Calendar, and AI Alerts.
- The exact existing `FOREX_SYMBOLS` list remains the 19-instrument guest universe:
  17 FX and two metals. All nine asset categories are visible. Empty categories
  explain that broker synchronization is pending rather than inventing instruments.
- **Demo preview** is enabled by default to show the requested visual design.
  A persistent notice and per-panel badges identify example financial data.
  `terminal-demo.mjs` contains explicitly labeled synthetic, deterministic data
  with an example timestamp of 28 October 2024. Prices, chart bars, account
  balances, positions, AI scores, trade-plan levels, and calendar events are all
  examples, not live broker data or actual AI output. No fixtures are mixed into
  the symbol contract, member data, real account state, or Auto Pick.
- Switching to **Guest / no feed** removes sample market/account values and
  synthetic bars while retaining all 19 fallback instruments and navigation.
- Scanner supports search, category, favorites, and demo-score sorting. Selection
  opens the chart. Chart instrument, timeframe, overlays, and candle/line controls
  work. The existing `CandlestickChart` and analysis primitives are reused without
  modifying their source. Demo indicators operate only on synthetic bars.
- `?symbol=XAU%2FUSD` and canonical `?symbol=XAUUSD` focus the matching fallback
  instrument. Unknown symbols safely fall back to EUR/USD.
- Manual risk planning uses only the balance, risk percentage, stop distance, and
  pip value supplied in the form. It does not infer broker contract specs, round
  volume, send orders, or include commission/spread. Invalid/non-finite results
  are rejected. Editing an input clears the prior result.
- Journal notes, favorites, and alert switches remain local React state, persist
  across Forex view changes, and reset on reload. No existing member services,
  LINE delivery, storage, notifications, account APIs, or Auto Pick are called.
- Vantage is the only supported broker. The connection remains disconnected and
  buttons are disabled. There are no credential fields, storage, ingest endpoints,
  actual account connections, or execution methods.

## Future adapter boundary

`brokers.mjs` provides a broker-ID registry, currently with **Vantage only** in
`SUPPORTED_BROKERS`. Adding a broker later will not require replacing the universe
model. `connectionAvailable` is false. `verifiedServers` is empty because no
verified server identities are available in Phase 1; do not infer trust from a
user-supplied broker/server label or a server name prefix.

`Mt5Connection` defines disconnected, connecting, connected, syncing, ready,
stale, error, and unsupported states. They are data contracts only, not a simulated
connection workflow. Connected means a connector has been verified; ready means a
metadata snapshot has completed. Neither status alone certifies live quote data.
Future backend/connector verification must enforce the supported broker policy.

`symbol-universe.mjs` defines `ForexInstrument` and `SymbolUniverseSnapshot`:

- Preserve the **exact** `broker_symbol`, including broker suffixes, separately
  from an explicitly mapped `canonical_symbol`. Unknown canonical/category values
  can be null instead of silently guessing a mapping.
- Use stable identities scoped to source, broker, server, and exact symbol, e.g.
  `mt5:vantage:<verified-server>:EURUSD.a`; use unambiguous encoding in the adapter.
- Metadata includes category, description, digits, point, contract size,
  minimum/maximum/step volume, base/profit/margin currencies, trade mode, and
  trading session intervals with a timezone. Snapshot timestamps use ISO UTC.
- Guest contract specifications and broker symbols stay null. Display currency
  labels and canonical symbols are derived from the starter catalog only and
  are not verified MT5 specifications. No broker prices are fabricated.
- Quotes and metadata are separate contracts. Future synchronization should
  produce a validated, source-scoped snapshot, preserving the fallback catalog
  separately and never mixing it into a claimed broker snapshot.

## Validation

```sh
npm ci
node --test src/components/forex/forex.test.mjs
npm run build
npm start -- --port 3100
```

In a second terminal, with Playwright and Chromium installed:

```sh
node src/components/forex/forex.browser.mjs
```

The browser check also supports `PLAYWRIGHT_MODULE` (absolute module entry path),
`PLAYWRIGHT_CHANNEL=chrome`, `FOREX_TEST_URL`, and `FOREX_SCREENSHOT_DIR`.
It checks all ten views, deep links, chart controls, scanner filters/sorting,
demo/guest isolation, manual risk planning, local notes/alert state, disabled MT5,
reload reset, desktop/mobile layout, zero Forex API calls, and all four protected
market routes (including client navigation from Forex to Thai). The Node tests enforce the exact fallback universe, model semantics,
filters, supported broker policy, and source equality with the requested baseline
for all protected tracked `src` and `deploy` files.

Validation on 7 October 2026: production build passed; eight Forex tests and browser
checks passed. Existing market-data/security/Auto Pick suite: 28 of 29 passed.
`whole-market replay summary reports missing work without inventing wins` expects
392 instruments but receives 791. The same failure was reproduced on an untouched
archive of the baseline commit; Auto Pick was not changed.
