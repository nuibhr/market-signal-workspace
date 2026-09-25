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

## Mac and J.P. Morgan options

MetaQuotes does offer an MT5 installer for macOS. It installs the Windows terminal inside a Wine environment rather than as a fully native macOS terminal, and MetaQuotes says it supports Apple processors. This is a practical way to run the broker's MT5 desktop on the user's Mac, but does not establish that the Windows-only Python package/IPC bridge will work from macOS Python. [MetaTrader 5 on macOS](https://www.mql5.com/en/articles/619)

For a Mac-hosted MT5 terminal, a possible live-feed bridge is a small read-only MQL5 Expert Advisor that posts approved tick/bar fields to a secured HTTPS endpoint using `WebRequest`. MetaQuotes documents that `WebRequest` is allowed from scripts and Expert Advisors, requires explicitly allowing the destination host in terminal settings, and blocks calls from indicators. This is a separate native MQL5 route, not the Python integration used by the Colab notebook. [MQL5 WebRequest](https://www.mql5.com/en/docs/network/webrequest)

J.P. Morgan DataQuery includes FX content: its public product page describes spot and forward rates for 60+ pairs and API access, but does not state that this is a free, publicly redistributable live OHLC feed. J.P. Morgan separately says DataQuery users receive free access to JPMaQS indicators while excluding the most recent six months of history, specifically for research/testing. Those delayed research indicators are not a substitute for live Forex chart prices. Treat JPM DataQuery as an optional research/macro source unless J.P. Morgan confirms the exact FX dataset, real-time entitlement, API access, and display rights for this app. [DataQuery FX coverage](https://www.jpmorgan.com/markets/dataquery), [JPMaQS access](https://www.jpmorgan.com/markets/jpmaqs)

## Recommended architecture

- Treat the user's own MT5 broker feed as the preferred Forex source. Its price/spread series matches the broker where they may act on a signal, unlike a blended reference-rate source.
- Keep the account session on the machine that runs the broker's MT5 terminal. A read-only collector should request only symbol metadata, bid/ask ticks and OHLC bars. It must not call account, balance, position, order or execution functions.
- For historical-bar import, run a local collector beside a supported MT5 terminal and export normalized UTC OHLC bars. Do not upload a notebook containing credentials; keep any secret outside the notebook and source control.
- For live web updates, place a small authenticated read-only bridge next to an always-on MT5 terminal (typically a secured Windows host/VPS). It can push only approved symbols, bid/ask, source time and bars to the workspace ingest endpoint. The web app must reject stale timestamps, validate the symbol allowlist and never accept or forward order commands.
- Keep Twelve Data only as a development/secondary provider option. Its composite reference rate has no bid/ask and is not interchangeable with the MT5 broker feed; check external-display and redistribution rights for the intended deployment before using it.

## What is not yet confirmed

The notebook does not show the broker, symbol catalogue, account type or any successful output. The screenshot displays blank credentials, so no values were read or tested. We still need to know whether the user has an MT5 terminal running on a Windows PC/VPS or only has access to this Colab notebook. A Mac browser does not reveal where the actual MT5 terminal is installed.

Once the terminal host is known, the next implementation can be specific: a local historical exporter if only backfill is needed, or a minimal read-only live bridge for continuous charts. Start with one broker symbol (for example, its exact `EURUSD`/`XAUUSD` spelling) and one timeframe, verify source timestamps and bid/ask, then expand the Forex pair universe. Broker symbols often have suffixes, so use the terminal's symbol list rather than assume the plain ISO pair spelling.
