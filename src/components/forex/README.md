# Forex / CFD Command Center — Phase 1

Baseline: `cf74b0d7e4b5e255ba7646e4b3b6ec48dd79a82e`.

Only `/forex` now renders `ForexWorkspace`. The shared workspace, market navigation,
market catalog, global styles, other markets, membership, LINE authentication,
admin, D1 migrations, and Auto Pick remain unchanged. New styles use CSS Modules;
the existing `MarketNavigation` is reused with local, Forex-only styling.

## Current behavior

- Overview, market universe, and MT5 connection views share a dedicated Forex shell.
- The exact existing `FOREX_SYMBOLS` list supplies 19 guest instruments: 17 FX and
  two metals. All nine requested categories are visible. Empty categories explain
  that broker synchronization is pending; they do not invent instruments.
- Search matches display/canonical/broker symbols and descriptions; category and
  session-only favorites filters compose. Favorites deliberately reset on reload
  and do not call or change the existing member favorites service.
- `?symbol=XAU%2FUSD` and canonical `?symbol=XAUUSD` select the corresponding
  fallback instrument. Unknown symbols safely select EUR/USD.
- No live quotes, spreads, charts, signals, account connection, credential inputs,
  storage, ingest endpoint, or execution methods are added. The connection button
  is explicitly disabled and the UI always presents guest/disconnected mode.

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
It checks deep links, selection, search, favorites, empty categories, filter reset,
disabled connection, guest reset, desktop/mobile layout, and all four protected
market routes. The Node tests enforce the exact fallback universe, model semantics,
filters, supported broker policy, and source equality with the requested baseline
for all protected tracked `src` and `deploy` files.

Validation on 7 October 2026: production build passed; six Forex tests and browser
checks passed. Existing market-data/security/Auto Pick suite: 28 of 29 passed.
`whole-market replay summary reports missing work without inventing wins` expects
392 instruments but receives 791. The same failure was reproduced on an untouched
archive of the baseline commit; Auto Pick was not changed.
