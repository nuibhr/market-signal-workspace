# MT5 Forex bridge assessment

**Reviewed:** 25 September 2026

## What the shared Colab notebook contains

The visible notebook has three code cells:

1. Imports `MetaTrader5`, `pandas`, `datetime` and `time`.
2. Declares an `XAUUSD` ticker and blank login, password and server variables.
3. Calls `mt5.initialize()`, `mt5.login(...)`, then reads `account_info()` and prints balance/equity.

It is a connection/account-info skeleton, not yet a Forex price-history API. No bar or tick retrieval call is present in the visible cells. Do not put broker credentials into a shared Colab notebook, and do not run the account-info cell for the workspace: balances/equity are not needed to chart FX prices.

## What the MT5 Python integration can supply

MetaQuotes describes its Python package as obtaining data by inter-process communication with the MetaTrader 5 terminal. The package documentation lists `symbol_info_tick`, `copy_ticks_from` and `copy_rates_from_pos`; the latter returns bar time, OHLC, tick volume, spread and real volume where available. MT5 bar times are UTC. The history is bounded by the terminal's chart-history settings. [Python Integration](https://www.mql5.com/en/docs/python_metatrader5), [`copy_rates_from_pos`](https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrompos_py), [`symbol_info_tick`](https://www.mql5.com/en/docs/python_metatrader5/mt5symbolinfotick_py)

The official integration setup describes Windows Python and connection to an installed MT5 terminal. That means a hosted Colab runtime, which does not share a local broker terminal's IPC, is not the right place to run this connector. This conclusion follows from the documented local-terminal architecture. [MetaQuotes Python integration setup](https://www.mql5.com/en/docs/python_metatrader5)

## Recommended architecture

- Treat the user's own MT5 broker feed as the preferred Forex source. Its price/spread series matches the broker where they may act on a signal, unlike a blended reference-rate source.
- Keep the account session on the machine that runs the broker's MT5 terminal. A read-only collector should request only symbol metadata, bid/ask ticks and OHLC bars. It must not call account, balance, position, order or execution functions.
- For historical-bar import, run a local collector beside a supported MT5 terminal and export normalized UTC OHLC bars. Do not upload a notebook containing credentials; keep any secret outside the notebook and source control.
- For live web updates, place a small authenticated read-only bridge next to an always-on MT5 terminal (typically a secured Windows host/VPS). It can push only approved symbols, bid/ask, source time and bars to the workspace ingest endpoint. The web app must reject stale timestamps, validate the symbol allowlist and never accept or forward order commands.
- Keep Twelve Data only as a development/secondary provider option. Its composite reference rate has no bid/ask and is not interchangeable with the MT5 broker feed; check external-display and redistribution rights for the intended deployment before using it.

## What is not yet confirmed

The notebook does not show the broker, symbol catalogue, account type or any successful output. The screenshot displays blank credentials, so no values were read or tested. We still need to know whether the user has an MT5 terminal running on a Windows PC/VPS or only has access to this Colab notebook. A Mac browser does not reveal where the actual MT5 terminal is installed.

Once the terminal host is known, the next implementation can be specific: a local historical exporter if only backfill is needed, or a minimal read-only live bridge for continuous charts. Start with one broker symbol (for example, its exact `EURUSD`/`XAUUSD` spelling) and one timeframe, verify source timestamps and bid/ask, then expand the Forex pair universe. Broker symbols often have suffixes, so use the terminal's symbol list rather than assume the plain ISO pair spelling.
