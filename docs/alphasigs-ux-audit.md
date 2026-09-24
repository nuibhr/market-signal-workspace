# AlphaSigs: UX/UI field study and adaptation blueprint

**Reviewed:** 24 September 2026  
**Reference:** [alphasigs.net](https://alphasigs.net/)  
**Purpose:** learn the product's workspace, panels, public help/product pages, strengths and friction points, then define a product direction for our own multi-market signal and chart platform.

> This is a read-only interface review. Forms, account connections, billing, signal delivery, AI-credit actions, importing trades, and other write or send actions were not submitted. Some values and loading states are live and can change between visits.

## 1. Product shape and navigation

AlphaSigs is best understood as a **chart workspace plus a set of detachable analysis panels**, supported by a collection of public product, education, and developer pages. The main workspace largely stays on `/`; navigation opens drawers, popovers, or overlays. The dedicated Crowd Simulator and several guides have separate routes. Public pages use more than one visual shell, so this feels like a suite of related tools rather than one uniform application.

### Routes/pages reviewed

| Page | Route | What it contains |
|---|---|---|
| Main trading workspace | `/` | Market watch, charting tools, AI analysis, performance statistics, feed, news, alerts, calendar, social and assistive tools |
| Crowd Positioning Simulator | `/crowd-sim` | Agent simulation, crowd positioning, liquidity landscape, track record and calibration tables |
| Platform Guide | `/platform-guide` | 13-section practical guide, signal lifecycle, risk, confidence, statistics and tool explanations |
| SMC Guide | `/smc-guide` | 9-section Smart Money Concepts guide with measured caveats |
| Academy | `/academy` | Courses by level with lesson counts and saved progress indicators |
| Market | `/market` | Product/indicator/EA catalogue with filters, prices and access tiers |
| Products | `/products` | Ten product summaries and calls to action |
| Analysis | `/analysis` | Ten analysis-tool descriptions, including SMC, order flow, MTF, news and crowd simulation |
| Traders | `/traders` | Trader journey, supported platforms and product positioning |
| Start | `/start` | Plain-language onboarding, market categories, service boundaries and pricing entry point |
| Widgets | `/widgets` | Embed preview, options and copyable iframe/link snippets |
| Developers | `/developers` | Structure API reference, request playground and authentication/credit model |
| Gate Lab | `/gate-lab` | Pre-registered, locked evaluation criteria and pass/fail/open audit reports |
| News | `/news` | Editorial landing page with categories, search, discovery, trending/toxic filters and email signup |

The workspace footer also linked to `/blog`, `/about-us`, `/about`, `/contact`, `/privacy-policy`, and `/terms-of-service`. I checked the editorial index, about-us, contact, privacy and terms pages as well. `/about` resolved back to the main workspace during the review, while `/about-us` opened a separate marketing page. `Script` changed the URL to `/#pricing` but did not open a script editor in the observed session, so that path needs a fresh check. There are also asset-level Crowd Simulator links, an Alpha Lotto entry point, broadcasts/social links, and product detail pages in Market that were not opened one by one. The route inventory covers the discovered workflow and public information surfaces; individual article details, account, billing, commerce, Alpha Lotto and every product detail state were not exhaustively opened.

## 2. Main workspace: information architecture

### Header and global shell

- Brand and product status: Alpha AI, server/latency and online-user indicators.
- Theme and language controls.
- Top shortcuts for Journal, Script and a Panels menu.
- Panels menu includes AI analysis, AI trading setup, news, price alerts, market scanner, economic calendar and Analysis Feed.
- Broadcasts/team sharing and account tier occupy the same high-visibility band.
- Persistent Jarvis voice/search affordances and social reaction controls add further global actions.

**What works:** broad functionality is discoverable from a consistent workspace; the panels menu is a sensible home for detachable tools.

**Friction:** the header competes with the chart and signal itself. Status, AI, sharing, account, help and market controls all vie for attention. Some affordances are credit-, microphone-, subscription- or external-service-dependent; the surface does not always make that cost or data boundary apparent until opened.

### Markets and watchlist

- Left-side Live Market Watch has search and category tabs, with counts shown for Crypto, Forex, Metals, Commodities, ETFs, Indices, US Stocks, Thai, Taiwan and Korea.
- Additional tabs include MARKET, FUND FLOW and SMT; the watchlist can be hidden or switched to a table-oriented presentation.
- Instrument rows show symbol, price/change and other market fields, with favorite controls.
- A “Top Tradeable Now” style grouping explains that activity/volume indicates market bustle, not direction.
- The Start page describes 326 instruments across 10 categories; its category list separates Thai stocks, Taiwan/Korea/US stocks, currency pairs, indices, ETF/funds, precious metals and commodities. AI signals exist only on a stated subset, while other instruments still get charts/tools.

**What works:** scale is immediately legible, search and category counts help orient the user, and the distinction between activity and direction is a useful microcopy detail.

**Friction/opportunity:** AlphaSigs categories mix instrument class, geography and venue. Spot/cash markets, CFDs/index references and exchange-traded derivatives can appear adjacent. For our product, market taxonomy must make venue and contract type explicit so `XAUUSD` is not confused with a TFEX gold contract, nor `SET50` with its index future.

### Center chart workspace

The center view offers instrument/timeframe controls, chart styles, chart zoom/crosshair/drawing actions, indicators and many SMC/market-structure overlays. Observed controls include EMA, Bollinger Bands, liquidity/volume profile, news, sessions and structure labels such as OB, BOS, FVG, premium/discount and higher-timeframe views. A volume profile has hoverable price rows; tools include drawing persistence, magnet, hand-pan and shape tools. Chart attribution indicates TradingView Lightweight Charts.

**What works:** the chart is the natural common reference point. Signal plans and structural zones can be displayed in the same price coordinate system, so the user can compare analysis with actual candles rather than switch mental contexts.

**Friction/opportunity:** visible control density is high. Many abbreviations are available at once, including items whose meaning is only revealed in tooltips. Our first release should expose a compact default toolbar and place advanced overlays into a searchable indicator drawer with saved presets. Keep the candlestick canvas dominant.

### Right-side AI analysis

The AI panel combines a directional label and confidence, active-factor count, trend/SMC interpretation, indicator readings, zones and risk planning. It also shows evidence tables for historical indicator performance, sample counts, a “meta-learning” caution, stop/target levels and sizing suggestions.

**What works:** the panel tries to explain the thesis and show its ingredients, rather than presenting only a BUY/SELL badge. Sample sizes beside measured win rates are a good trust signal.

**Friction/opportunity:** several scores and summaries can appear to conflict (for example, a strong direction next to a lower caution score). A user needs a clear hierarchy: market context → setup → invalidation → targets → evidence quality. Our UI should state what each number means, what period/sample it covers and whether it is a model output or an observed result. Do not make confidence look like probability of profit unless calibrated and proven.

### Performance and community areas

The workspace exposes aggregate signal/trading analytics: time filters, win/loss patterns by hour/day, monthly net return, trade duration, MAE/MFE and per-symbol summaries. The help/guide references a separate “AI signal statistics” workflow that includes every result, wins and losses. A leaderboard/community area shows anonymized participants and performance fields. The feed may show setup cards with entry/SL/TP geometry and explains that levels derive from zones, not a backtest.

**What works:** analytics are treated as a first-class product surface, not hidden under account settings. The display of losing outcomes and minimum sample thresholds are especially relevant to the user's “every trade” highlight.

**Friction/opportunity:** performance data can be visually distant from the signal that generated it. A user should be able to open an individual signal, see the exact price path and result, then return to aggregates with the same filters. Avoid a large dashboard of percentages without a click-through evidence trail.

### Jarvis, sharing and social controls

Jarvis offers search/voice commands, chart watching or multi-symbol monitoring, and economic-event reminders. Some functions mention microphone use or credit-based live vision. The workspace also has team broadcasts, favorites and audience/reaction controls.

**Opportunity:** these are secondary workflows for our first release. Keep alert setup and saved watchlists, but gate microphone, video/vision, sharing and credit features behind explicit permissions and clear cost/data notes. Do not let social activity obscure objective signal outcomes.

## 3. Workspace panels inspected

### Price alerts

An empty “watching/history” state leads to a form with current price, target-price stepper, ±1/2/5% presets and direction (break above/below). It was inspected but not saved.

**Good pattern:** the condition is expressed in plain language, and presets accelerate common thresholds. **Improve:** show timezone, expiry, trigger source/last update, duplicate handling, and delivery destinations before creating an alert.

### Market Scanner

The scanner presents asset category chips and a table for asset, signal, confidence, 24-hour move, patterns and details. During this review it stayed at a zero-of-zero/loading state and displayed `NaN%` in an AI/SMC status line.

**Observed weakness:** loading/error states can leak invalid numeric values and appear unfinished. Our scanner should distinguish loading, no eligible instruments, provider outage and calculation failure; never show `NaN` to customers.

### Economic Calendar

The calendar has upcoming/historical views, search/date groupings, local time, impact totals, high-impact event emphasis, countdowns, forecast and previous values. Selecting an event expands an audit comparing frozen AI predictions against simple baselines. The observed module used counts instead of a percentage while sample sizes were small, plus an AI week-ahead summary and affected-asset guidance.

**Good pattern:** freeze predictions before the outcome, show baseline comparisons, and avoid false precision at low sample sizes. **Improve:** keep event time and timezone prominent and label AI summaries as generated interpretation, separate from the event's actual values.

### Analysis Feed

The feed filters by asset class and strategy family (Order Flow, Wyckoff, SMC plan, Quasimodo, Liquidity Sweep, chart patterns, Fibonacci, key levels, volatility and SMC trend). Cards include chart context and, for some plans, entry/stop/target levels. On a prior loaded state, category counts and US-stock cards appeared; on the later visit, the Crypto filter was active while the feed showed a loading state with zero counts.

**Good pattern:** strategy taxonomy and overlays make the source of a setup inspectable. **Friction:** large, evolving category count/filter sets and delayed refresh can make it hard to know if the feed is empty or still calculating. Preserve the last successful results during refresh and identify their timestamp.

### AI Trading Setup

The setup panel accepts a symbol, offers quick picks across metals, crypto, FX and US indices/stocks, and describes support for Crypto, Forex, Metals, Commodities, ETFs, Indices and US/Thai/Taiwan stocks. It presents itself as GPT-4o powered with SMC analysis; at inspection time it showed one credit and a “Generate Trading Setup” action. That action was not run. The generated plan is expected to include Entry/TP/SL.

**Good pattern:** the symbol and supported coverage are visible before generation. **Improve:** disclose credit cost before the generation action (not only the current balance/top-up affordance), state the data timestamp and whether values are executable for that venue, and return a stable plan ID so later outcome statistics can be attached to the exact generated setup.

### Alpha News

The chart-linked news drawer lists real-time financial headlines and offers All, Crypto, Forex, US Stocks, Thai stocks and Commodities filters. A source section showed source counts by publisher/category (e.g. Investing, Cointelegraph, CoinDesk and CNBC). Each headline includes publisher, date, a sentiment tag and an individual “ให้ AI วิเคราะห์” (analyze with AI) action. The AI action was not pressed.

**Good pattern:** filters connect news to market classes, and the source/publisher remains visible. **Improve:** show event time and affected symbol(s), distinguish publisher sentiment from the platform's model interpretation, provide source/update timestamp and label any credit cost before calling AI.

### Trade Diary (Journal)

The drawer has Journal, Statistics and Prop odds tabs; EA synchronization, file import, playbooks, filters and new entry; mood tags; pre-trade plan and post-trade review; and AI review actions with stated credit cost. Statistics have an empty state until trades exist. Prop odds requires at least 30 trades and an R calculation; it explicitly says missing stop values cannot be guessed. AI review describes which journal fields it sends for processing.

**Good pattern:** sample minimums, missing-data honesty, and clear delineation between user-entered journal data and generated review. **Friction:** a crowded drawer mixes daily reflection, import/sync, analytics, playbooks and funded-account simulation. Our journal can use a clear trade ledger first, then tabs for Review, Statistics and Playbook; imports/sync belong in a separate connection flow.

### Script and other destinations

Script claims custom EMA/SMA/RSI/Stoch indicators and a Pro gate. The observed click anchored to `#pricing` without opening an editor. Alpha Lotto and Crowd Simulator have separate affordances. These are ancillary to the first market-chart/statistics workflow.

## 4. Separate pages and their strongest patterns

### Crowd Simulator — `/crowd-sim`

A full-page, data-heavy simulator includes asset selection, live/session/timeframe/regime labels, rerun, a credit-priced summary action, current crowd positioning, liquidity zones, historical setup direction results, track records, an influence-network visualization, 3D graph options, agent/persona details, group bias by participant type, calibration tables and a simulation log.

The page explicitly separates simulated crowd behavior from “real” historical track records, displays sample sizes, and states when exchange positioning data is only supported for specific perpetual crypto instruments. Its edge report includes confidence intervals and can conclude that a result is statistically indistinguishable from a coin flip. This evidence-first handling is a strong pattern.

**Friction:** a very large quantity of technical and simulated information is placed on one page; some metrics are near 50%, so a first-time user may mistake a simulation for a forecast. Keep simulated/observed data visually distinct and lead with the limitations and the one actionable takeaway.

### Platform Guide — `/platform-guide`

A 13-section guide explains how to read a single signal, Entry/SL/TP, validity window, win/loss determination, confidence, break-even, risk, sessions, scalping/swing, psychology and the platform tools. It provides concrete numbers and explains that a confidence score is not the same as likelihood of profit. It shows score bands whose measured average R is below break-even and warns against increasing size based on confidence.

**Strongest pattern:** product documentation acknowledges poor or inconclusive evidence and explains how to interpret numbers. For our platform, the signal card and stats page should carry the same vocabulary as this guide, especially outcome rules and break-even after costs.

### SMC Guide — `/smc-guide`

Nine sections explain SMC concepts, including market structure, BOS/CHoCH, order blocks, FVGs, liquidity sweeps and premium/discount. The guide states that SMC infers likely interest from price shapes; it does not reveal institutional orders. It includes definitions and practical caveats (e.g. count a break at candle close, and do not assume an FVG will always fill).

**Strongest pattern:** explain uncertainty inherent in the analysis framework. This avoids presenting inferred zones as directly observed order flow.

### Academy — `/academy`

Courses are grouped by beginner, intermediate and advanced level, with lesson counts and progress indicators. Course topics cover signal reading, risk management, chart/SMC tools, market mechanics, footprint limitations across asset classes, Wyckoff and advanced order flow.

**Friction:** course progress is an account state; only the course catalogue was viewed. We should keep education searchable and contextual (open a glossary from a chart label) while tracking progress only after sign-in.

### Market — `/market`

A searchable catalogue has access filters (all/new/free/VIP/credit rental), categories, product count and sorting. It distinguishes the chart platform from MT5 indicators and EAs, and labels inclusion/price/credit costs. A test-lab link lets users see EA evaluation criteria.

**Good pattern:** clearly identify where an item runs and how access is paid for. **Opportunity:** make all product costs, market-data limitations and compatibility visible before a user opens a detail page.

### Products, Analysis and Traders

These three marketing/catalogue routes explain offerings, analytical modules and a trader's path. Products lists signal service, scanner, analysis suite, calendar, news, risk tools, mobile notifications, lotto and API. Analysis lays out ten different analytical dimensions; Traders turns them into a six-step journey from learning to alerts.

**Friction:** feature claims repeat across pages and can become difficult to distinguish from live capabilities. Our product should use one canonical feature catalogue with “available now / planned” labels and link each claim directly to the working screen.

### Start — `/start`

A comparatively clear onboarding page explains what the service is and is not, the user-operated broker boundary, the instrument categories, and how to get started. It says that only a subset of instruments have automated AI signals and that the list may change. The 10 visible classes include crypto, Thai, Taiwan, US and Korea equities, forex, indices, ETFs/funds, precious metals and commodities.

**Strong pattern:** start by telling a new user the scope of the system and which action remains theirs. Our first-run experience should ask which markets they trade, then show only relevant categories and explain the data source for each.

### Widgets and Developers

Widgets offers site-embed formats, size/theme/period controls and iframe or image/link snippets. Developers documents a Structure API that accepts 40–500 candles and returns SMC structures/plans, rejected-plan reasons, RR and break-even fields. Its playground shows example data and requires a user key before a real call; the submit control was disabled with no key.

**Strong patterns:** API responses include rejection reasons rather than silently omitting failed setups, and the widget flow previews output before copy. **Caution for our product:** keep API credentials out of logs, make data permissions clear, and do not run a user-supplied API request until they intentionally submit it.

### Gate Lab — `/gate-lab`

An unusually strong trust page commits pass/fail criteria before testing, describes walk-forward and placebo comparisons, and makes the criteria/hash free to inspect. It reports a failed external EA and keeps its own AlphaSync entry “open / not judged” while sample size is insufficient.

**Strong pattern:** pre-register evaluation rules, include failures, state when sample size is inadequate, and separate backtest/simulation from live closed trades. This is directly aligned with the user's desire for real, complete signal statistics.

### News — `/news`

An editorial home with many categories, search, discover/follow tabs, trending/toxic filters and latest/popular sorting; it also prompts for email subscription. The feed was still loading during the inspection.

**Friction:** category count and discovery controls are dense, and an unpopulated/loading feed gives little immediate value. For our product, articles should support the chart workflow rather than compete with it.

### About, Contact and policy pages

`/about-us` is a standalone marketing page with a story, feature/value/service lists and top-line metrics for active users, signals, win rate and markets. In the observed load, those headline values were placeholders (`...`), which weakens the trust claim. `/about` returned the main workspace instead. `/contact` has contact channels and a role-based form with personal details and message fields; it was not submitted.

The Privacy Policy describes personal/technical data and details which trading data may be sent when optional MT5/MetaAPI connections or AI diary review are used. It says website-only use does not access broker account data, distinguishes trade results and spread sampling, and describes model-provider use for AI actions. The Terms page covers account/access rules, payments/refunds, investment risk, liability and service terms.

**Product lesson:** privacy should be explained at the point a feature asks for data, not left only in a long policy. Our signals ledger should say whether it represents market-derived system results or user-connected executed trades, and keep these datasets visibly separate. The marketing page's empty win-rate placeholder is an example of a trust claim that should disappear until a verified number is ready.

### Blog — `/blog`

The blog index shares the News page's editorial taxonomy/search/trending/follow/sort shell and was still showing a loading message during inspection. It includes an email subscription form, which was not submitted. Individual article pages were not opened.

## 5. What to borrow and what to improve

### Borrow

1. **Chart as the shared evidence canvas.** Put signal entry, stop, targets and annotated context at the same price levels as the candles.
2. **The whole result set.** Archive every emitted signal and keep wins, losses, expiries and cancelled/invalid outcomes visible.
3. **Sample counts beside rates.** A win rate without `n`, dates, instrument and outcome rules is not actionable.
4. **Explain non-signals.** Scanner/feed filters should tell users why no setup passed, rather than show an empty state with no explanation.
5. **Frozen forecast vs baseline.** Save the model's view before a news release or signal outcome and compare it with simple baselines.
6. **Strong education and honest uncertainty.** Explain inferred market structure as inference, not as direct visibility into institutional orders.
7. **Explicit user boundary.** Make clear whether the app analyzes, alerts, routes, or executes.
8. **Every metric has provenance.** Timestamp, data source, sample period, methodology and limitations belong near the number.

### Improve

- Reduce simultaneous control density and make advanced tools opt-in.
- Keep one clear hierarchy: **market → setup → entry/invalidation/targets → evidence → risk → outcome**.
- Prevent internal loading errors such as `NaN%`; show stable loading and provider/error states.
- Separate observed live data, generated AI interpretation, agent simulation and historical outcome statistics visually.
- Avoid confidence/accuracy labels that invite users to equate model confidence with expected profitability.
- Keep the last completed feed or scan visible during refresh, with its age marked.
- Use consistent terminology and translations. A tool's label, tooltip, guide and signal card should agree.
- Make categories reflect a user's market and actual tradable instrument instead of a mixed global list.

## 6. Product blueprint for our app

### Primary navigation

- **Overview** — today's markets, latest signals and quick performance.
- **Markets** — grouped by the user's requested asset classes.
- **Signal Statistics** — immutable all-signal ledger plus transparent aggregate results.
- **Alerts** — delivery rules and history.
- **Journal** — optionally link a user's own trade to a system signal.
- **Learn / Settings** — secondary destinations, not persistent clutter around the chart.

### Requested market taxonomy

1. **หุ้นไทย** — SET equities with local symbols, THB currency, local trading sessions and source freshness.
2. **DR** — a separate list for Depositary Receipts with underlying market/symbol, quote currency and FX context visible. Do not silently merge with ordinary SET listings.
3. **TFEX** — exchange-traded futures contracts, separated by product family: Gold, Silver and SET50. Each contract needs its own expiry/rollover, multiplier/tick size, trading session and data-source metadata. Do not substitute a spot metal or cash index price for a futures contract.
4. **หุ้นต่างประเทศ** — equities grouped by exchange/region, with local currency, market hours and delayed/real-time status.
5. **Forex คู่เงิน** — major, minor and cross pairs, with quote/base currency, session and provider/source status.

A universal search can cross categories, but every result should retain its market label and venue. Let users pin favorites across categories without flattening their watchlist into an ambiguous list.

### Signal card and all-trades evidence

Each published signal should have a stable ID and an immutable snapshot of:

- Instrument, market/venue, timeframe, direction, generated timestamp and data source.
- Entry rule/price, stop, targets, setup expiry/validity window and methodology version.
- AI/model outputs with plain definitions; keep confidence separate from win probability.
- A visible chart marker plus entry/SL/TP levels on the Lightweight Charts series.
- Outcome status: **open, win, loss, expired without TP/SL, cancelled/invalid**. Never suppress losses or replace the original signal after the fact.
- Exact outcome trigger: price source and candle resolution; if TP and SL are both crossed in one candle, use finer data or mark the bar ambiguous instead of choosing the favorable path.
- Gross/net result in R and %, costs where known, time to result and link to the candle that determined the result.

The statistics view should include filters for asset class, instrument, timeframe, strategy, date range and signal status. Show win/loss counts, win rate, avg win/loss in R, expectancy, drawdown, open/expired/ambiguous counts, sample size, fees/spread assumptions and a break-even line. Each aggregate should drill down to the underlying rows and chart evidence. Use a consistent snapshot/version to prevent a data refresh from rewriting the historic record.

### Lightweight Charts implementation direction

- Use real OHLCV candles from a documented provider; show symbol, venue, currency, timeframe and last update beside the chart.
- Keep candle/volume series as the base. Add signal entry, stop and target as horizontal price lines; add SMC zones or sessions as clearly labelled overlays.
- Bind signal ID and chart annotation data to the same immutable signal record that powers the alert and stats ledger. The chart must not invent a separate “display-only” signal.
- On selecting a signal from the statistics ledger, move the time scale to its generated and resolved interval, highlight the entry candle and outcome candle, and show the exact price path/rule used to grade it.
- Distinguish unavailable/delayed data from live data. Do not fill gaps with generated candles or label sample charts as live.
- Keep advanced drawing tools and studies behind a searchable indicator panel; remember the user's layout only after an explicit save.

### Notification behavior

For every new signal, send one alert with instrument/category, direction, timeframe, entry, SL, target(s), expiry, source timestamp, and a deep link to the exact chart. Send a second update only when its state changes: target hit, stop hit, expiry or invalidation. Include the permanent signal ID in in-app/email/push records. Give users category-level opt-ins and quiet hours. The alert must not imply execution or guaranteed return.

## 7. Suggested staged implementation

**Stage 1 — Trustworthy core:** requested market taxonomy, real chart/candles, signal cards, immutable all-trades ledger, outcome rules, per-trade chart replay and core aggregate stats.

**Stage 2 — Workflow:** watchlists, alert delivery/history, filters, calendar, journal and signal-to-journal linking.

**Stage 3 — Advanced analysis:** SMC overlays, scanner, evidence comparisons, strategy breakdowns, API/export and additional market-specific analytics.

**Stage 4 — Community/AI extras:** crowd simulation, broadcasts, leaderboards, conversational assistant, 3D or credit-based tools after data provenance and cost controls are clear.

This ordering preserves the modern, chart-led feel while making the user's highlight—**real AI signal statistics for every winning and losing trade**—the product's central trust feature instead of a secondary dashboard.

## 8. Open product decisions for implementation

- Which market-data vendors/licenses are available for SET/DR, TFEX, US equities and FX, and what update latency is permitted?
- Which contract codes/expiry schedule represent TFEX Gold, Silver and SET50 in the data source?
- What candle resolution is authoritative for grading outcomes, and how should same-candle TP/SL ambiguity be presented?
- Are historical statistics meant to cover system signals only, users' executed trades only, or both as explicitly separate datasets?
- Which alert channels are in scope for the first release?

These decisions affect correctness and data rights, so they should be settled before connecting live feeds or publishing performance claims.
