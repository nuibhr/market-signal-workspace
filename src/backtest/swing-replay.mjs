import { atr14 } from '../analysis/chart-levels.mjs';
import { buildSwingResearchPlan, netRForExit } from '../analysis/swing-standard.mjs';
import { candleClosedAt } from '../market-data/delayed-candles.mjs';
import { newYorkParts } from '../market-data/fmp-us.mjs';

const failure = code => Object.assign(new Error(code), { code });
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const stamp = seconds => new Date(seconds * 1000).toISOString();
const ema = (values, period) => {
  if (values.length < period) return null;
  let result = values.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
  for (const value of values.slice(period)) result += (value - result) * 2 / (period + 1);
  return result;
};
// Both right-side bars must be available before a pivot is used.
export function confirmedSwings(bars, width = 2) {
  const lows = [], highs = [];
  for (let i = width; i < bars.length - width; i++) {
    const neighbors = bars.slice(i - width, i + width + 1).filter((_, j) => j !== width);
    if (neighbors.every(bar => bar.low > bars[i].low)) lows.push(bars[i].low);
    if (neighbors.every(bar => bar.high < bars[i].high)) highs.push(bars[i].high);
  }
  return { lows, highs };
}

// Explicit research entry definitions, separate results for each mode. These
// parameters are assumptions to compare, not user-confirmed entry rules.
export const RESEARCH_ENTRY_RULES = Object.freeze({ dailyFastEMA: 20, dailySlowEMA: 50,
  breakoutLookback: 20, pullbackEMA: 20, pivotWidth: 2, maximumEntryWaitHours: 24 });

export function buildSwingEntries({ daily, fourHour, market, mode, rules }) {
  if (!['breakout', 'pullback'].includes(mode)) throw failure('SEPARATE_ENTRY_MODE_REQUIRED');
  if (!rules || Object.keys(RESEARCH_ENTRY_RULES).some(key => !Number.isSafeInteger(rules[key]) || rules[key] < 1 || rules[key] > 250) || rules.dailyFastEMA >= rules.dailySlowEMA)
    throw failure('EXPLICIT_RESEARCH_ENTRY_RULES_REQUIRED');
  const signals = [], trails = []; let dailyCursor = 0;
  for (let i = 0; i < fourHour.length; i++) {
    const availableAt = candleClosedAt(fourHour[i], '4h', market) / 1000 + 900;
    while (dailyCursor < daily.length && candleClosedAt(daily[dailyCursor], '1d', market) / 1000 + 900 <= availableAt) dailyCursor++;
    const history = fourHour.slice(0, i + 1), atr = atr14(history), swings = confirmedSwings(history, rules.pivotWidth);
    if (!positive(atr) || !swings.lows.length) continue;
    const swingLow = swings.lows.at(-1);
    trails.push({ availableAt, swingLow, atr });
    const days = daily.slice(0, dailyCursor), closes = days.map(bar => bar.close);
    const fast = ema(closes, rules.dailyFastEMA), slow = ema(closes, rules.dailySlowEMA);
    if (!positive(slow) || !(fast > slow && closes.at(-1) > fast)) continue;
    const current = history.at(-1), prior = history.at(-2);
    let matched = false;
    if (mode === 'breakout' && history.length > rules.breakoutLookback + 1) {
      const level = Math.max(...history.slice(-rules.breakoutLookback - 1, -1).map(bar => bar.high));
      matched = current.close > level && prior.close <= level;
    } else if (mode === 'pullback' && prior) {
      const average = ema(history.map(bar => bar.close), rules.pullbackEMA);
      matched = positive(average) && current.low <= average && current.close > average && current.close > prior.high && current.close > current.open;
    }
    if (!matched) continue;
    const overhead = confirmedSwings(days, rules.pivotWidth).highs.filter(price => price > current.close);
    signals.push({ mode, signalTime: current.time, availableAt, expiresAt: availableAt + rules.maximumEntryWaitHours * 3600,
      swingLow, atr, resistanceLevels: overhead });
  }
  return { signals, trails };
}

// Single-instrument, LONG-only Standard execution. All orders are simulated.
// Stops/limits already placed with a broker may execute between observations;
// new entries and trail changes cannot use a bar before close + availability lag.
export function replayStandardSignals({ signals, trails = [], execution, market = 'thai', costs,
  tickSize, lotSize, initialCapital, riskFraction, fromSeconds, toSeconds }) {
  if (!positive(tickSize) || !Number.isSafeInteger(lotSize) || lotSize < 1 || lotSize % 2 || !positive(initialCapital) ||
    ![0.005, 0.01].includes(riskFraction) || !Number.isFinite(fromSeconds) || !Number.isFinite(toSeconds) || fromSeconds >= toSeconds)
    throw failure('EXECUTION_CAPITAL_EVEN_LOT_TICK_AND_RANGE_REQUIRED');
  if (!['thai', 'dr', 'us'].includes(market)) throw failure('LONG_EQUITY_EXECUTION_ONLY');
  const ordered = rows => rows.every((row, i) => Number.isFinite(row.availableAt) && (!i || row.availableAt >= rows[i - 1].availableAt));
  if (!ordered(signals) || !ordered(trails) || signals.some(row => !(row.expiresAt > row.availableAt) || row.availableAt < row.signalTime + 14400 + 900))
    throw failure('SIGNAL_AVAILABILITY_ORDER_REQUIRED');
  if (!execution.every((bar, i) => Number.isSafeInteger(bar.time) && (!i || bar.time > execution[i - 1].time) &&
    [bar.open, bar.high, bar.low, bar.close].every(positive) && bar.high >= Math.max(bar.open, bar.close, bar.low) && bar.low <= Math.min(bar.open, bar.close)))
    throw failure('VALID_ORDERED_EXECUTION_BARS_REQUIRED');
  const trades = [], skipped = [], equityCurve = []; let cash = initialCapital, position = null, signalCursor = 0, trailCursor = 0, latestTrail = null;
  const sell = (bar, price, fraction, reason, ambiguous = false) => {
    const qty = position.quantity * fraction;
    cash += qty * price * (1 - position.plan.friction.slip) * (1 - position.plan.friction.fee);
    position.fills.push({ at: stamp(bar.time), timeBasis: '15m-execution-window-start', windowEnd: stamp(bar.time + 900), price, fraction, quantity: qty, reason, ambiguous,
      netR: netRForExit(position.plan, price) });
    position.remainingFraction = Math.max(0, position.remainingFraction - fraction);
    if (position.remainingFraction < 1e-9) {
      const netR = position.fills.reduce((sum, fill) => sum + fill.fraction * fill.netR, 0);
      trades.push({ ...position, status: 'closed', exitedAt: stamp(bar.time), netR,
        netPnl: netR * position.initialRiskMoney, ambiguous: position.fills.some(fill => fill.ambiguous) });
      position = null;
    }
  };
  for (const bar of execution) {
    if (bar.time < fromSeconds || bar.time + 900 > toSeconds) continue;
    while (trailCursor < trails.length && trails[trailCursor].availableAt <= bar.time) latestTrail = trails[trailCursor++];
    // Consume signals while a position is open, rather than replaying them later.
    let candidate = null;
    while (signalCursor < signals.length && signals[signalCursor].availableAt <= bar.time) {
      const signal = signals[signalCursor++];
      if (signal.availableAt < fromSeconds) continue;
      if (position) { skipped.push({ availableAt: signal.availableAt, code: 'POSITION_ALREADY_OPEN' }); continue; }
      if (signal.expiresAt < bar.time) { skipped.push({ availableAt: signal.availableAt, code: 'ENTRY_EXPIRED' }); continue; }
      candidate = signal;
    }
    if (!position && candidate) {
      const resistance = (candidate.resistanceLevels || []).filter(price => price > bar.open).sort((a, b) => a - b)[0] ?? null;
      const plan = buildSwingResearchPlan({ entry: bar.open, swingLow: candidate.swingLow, atr: candidate.atr,
        tickSize, market, costs, nearestResistance: resistance, dataAvailableAt: stamp(candidate.availableAt) });
      if (!plan.researchEligible) skipped.push({ availableAt: candidate.availableAt, code: plan.code });
      else {
        // Even lots allow the requested exact 50% exit without fractional shares.
        const sizeByRisk = Math.floor(cash * riskFraction / plan.netRiskPerUnit / lotSize) * lotSize;
        const sizeByCash = Math.floor(cash / plan.entryBasis / lotSize) * lotSize;
        const quantity = Math.min(sizeByRisk, sizeByCash);
        if (quantity < lotSize) skipped.push({ availableAt: candidate.availableAt, code: 'INSUFFICIENT_CAPITAL_FOR_LOT' });
        else {
          cash -= quantity * plan.entryBasis;
          position = { status: 'open', mode: candidate.mode, enteredAt: stamp(bar.time), signalAvailableAt: stamp(candidate.availableAt),
            quantity, initialRiskMoney: quantity * plan.netRiskPerUnit, plan, stop: plan.stopLoss,
            remainingFraction: 1, tookProfit: false, fills: [] };
        }
      }
    }
    if (position?.tookProfit && latestTrail) {
      const raw = latestTrail.swingLow - latestTrail.atr;
      const rounded = Math.floor((raw + 1e-10) / tickSize) * tickSize;
      if (positive(rounded)) position.stop = Math.max(position.stop, rounded);
    }
    if (position) {
      const target = position.plan.targets[0].price, stop = position.stop;
      const stopHit = bar.low <= stop, targetHit = !position.tookProfit && bar.high >= target;
      if (bar.open > stop && !position.tookProfit && bar.open >= target) {
        // The opening price resolves this ordering: a standing TP limit fills
        // before a later intrabar stop. Keep the conservative limit price.
        sell(bar, target, 0.5, 'tp1-2r');
        position.tookProfit = true; position.stop = Math.max(stop, position.plan.breakEvenStop);
        if (bar.low <= position.stop) sell(bar, position.stop, position.remainingFraction, 'breakeven-after-tp1');
      } else if (bar.open <= stop || stopHit) {
        // With unresolved stop/target order, assume the adverse sequence and
        // expose ambiguity. A gap can lose more than the initial 1R budget.
        sell(bar, Math.min(bar.open, stop), position.remainingFraction, 'stop', targetHit && bar.open > stop);
      } else if (targetHit) {
        const breakEven = position.plan.breakEvenStop;
        sell(bar, target, 0.5, 'tp1-2r');
        position.tookProfit = true; position.stop = Math.max(position.stop, breakEven);
        if (bar.low <= position.stop) sell(bar, position.stop, position.remainingFraction, 'breakeven-after-tp1', true);
      }
    }
    const liquidation = position ? position.quantity * position.remainingFraction * bar.close *
      (1 - position.plan.friction.slip) * (1 - position.plan.friction.fee) : 0;
    equityCurve.push({ at: stamp(bar.time + 900), equity: cash + liquidation });
  }
  const profit = trades.filter(trade => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0);
  const loss = -trades.filter(trade => trade.netPnl < 0).reduce((sum, trade) => sum + trade.netPnl, 0);
  let peak = initialCapital, maxDrawdownPercent = 0;
  for (const point of equityCurve) { peak = Math.max(peak, point.equity); maxDrawdownPercent = Math.max(maxDrawdownPercent, (peak - point.equity) / peak * 100); }
  return { status: 'research-simulation', strategyValidated: false, liveEligible: false, trades, skipped, openPosition: position,
    equityCurve, metrics: { closedTrades: trades.length, expectancyNetR: trades.length ? trades.reduce((sum, trade) => sum + trade.netR, 0) / trades.length : null,
      profitFactor: loss > 0 ? profit / loss : null, profitFactorReason: loss > 0 ? null : trades.length ? 'NO_CLOSED_LOSSES' : 'NO_CLOSED_TRADES',
      winRate: trades.length ? trades.filter(trade => trade.netPnl > 0).length / trades.length : null,
      closedNetPnl: profit - loss, finalLiquidationEquity: equityCurve.at(-1)?.equity ?? initialCapital,
      maxDrawdownPercent, drawdownBasis: '15m-close-liquidation-after-costs', ambiguousTrades: trades.filter(trade => trade.ambiguous).length },
    limitations: ['Single instrument; not a multi-asset portfolio backtest', 'LONG Standard only; Advanced and TFEX replay unavailable',
      'Stop/target collisions use an adverse sequence and remain marked ambiguous', 'No forced close or winning-trade count for open runners',
      'Declared constant tick and even lot required; tiered tick schedules require separate implementation',
      'Cash dividends, splits and FX cash flows are not simulated', 'Stop/limit fills assume standing broker orders; volume/liquidity queue not simulated'] };
}

export function runStandardResearch(manifest, frames, preflight) {
  const blocked = [...preflight.blocked];
  if (manifest.adjustment !== 'split-adjusted') blocked.push('REPLAY_REQUIRES_SPLIT_ADJUSTED_PRICES');
  if (!manifest.entryRules) blocked.push('EXPLICIT_RESEARCH_ENTRY_RULES_REQUIRED');
  if (!manifest.constantTickConfirmed || !positive(manifest.tickSize)) blocked.push('CONSTANT_TICK_SCHEDULE_REQUIRED');
  if (!Number.isSafeInteger(manifest.lotSize) || manifest.lotSize < 2 || manifest.lotSize % 2 || !positive(manifest.initialCapital)) blocked.push('EVEN_LOT_AND_INITIAL_CAPITAL_REQUIRED');
  if (blocked.length) return { status: 'blocked', strategyValidated: false, metrics: null, blocked: [...new Set(blocked)], preflight };
  const modes = manifest.entryMode === 'both' ? ['breakout', 'pullback'] : [manifest.entryMode];
  const results = [];
  const boundary = date => {
    if (manifest.market !== 'us') return Date.parse(`${date}T00:00:00+07:00`) / 1000;
    const summer = Date.parse(`${date}T04:00:00Z`);
    return (newYorkParts(summer).minutes === 0 ? summer : summer + 3600000) / 1000;
  };
  for (const mode of modes) {
    const entries = buildSwingEntries({ daily: frames['1d'], fourHour: frames['4h'], market: manifest.market, mode, rules: manifest.entryRules });
    for (const riskFraction of [0.005, 0.01]) results.push({ mode, profile: 'standard', riskFraction,
      ...replayStandardSignals({ ...entries, execution: frames['15m'], market: manifest.market,
        costs: preflight.costs.assumptions, tickSize: manifest.tickSize,
        lotSize: manifest.lotSize, initialCapital: manifest.initialCapital, riskFraction,
        fromSeconds: boundary(preflight.requestedFrom), toSeconds: boundary(preflight.requestedToExclusive) }) });
  }
  return { status: 'research-simulation', strategyValidated: false, liveEligible: false, preflight, results };
}
