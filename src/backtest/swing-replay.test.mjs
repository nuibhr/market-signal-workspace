import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwingEntries, confirmedSwings, RESEARCH_ENTRY_RULES, replayStandardSignals, runStandardResearch } from './swing-replay.mjs';
import { buildSwingResearchPlan, thaiResearchCosts } from '../analysis/swing-standard.mjs';
import { inspectSwingDataset } from './dataset.mjs';
const costs = thaiResearchCosts();
const baseTime = Date.parse('2026-10-14T08:15:00Z') / 1000;
const signal = { mode: 'breakout', signalTime: baseTime - 15300, availableAt: baseTime, expiresAt: baseTime + 86400, swingLow: 98, atr: 1, resistanceLevels: [] };
const defaults = { signals: [signal], execution: [], costs, tickSize: 0.01, lotSize: 100,
  initialCapital: 1000000, riskFraction: 0.01, fromSeconds: baseTime - 900, toSeconds: baseTime + 86400 };
const bar = (time, open = 100, high = 101, low = 99, close = 100) => ({ time, open, high, low, close, volume: 10000 });
const plan = buildSwingResearchPlan({ entry: 100, swingLow: 98, atr: 1, costs, tickSize: 0.01 });

test('a delayed signal never fills before availableAt, and actual entry is the later execution open', () => {
  const result = replayStandardSignals({ ...defaults, execution: [bar(baseTime - 900, 99, 100, 98, 99), bar(baseTime, 101, 102, 100, 101)] });
  assert.equal(result.openPosition.enteredAt, new Date(baseTime * 1000).toISOString());
  assert.equal(result.openPosition.plan.entry, 101);
  assert.ok(result.openPosition.initialRiskMoney <= defaults.initialCapital * 0.01);
  assert.equal(result.openPosition.quantity % 100, 0);
  assert.equal(result.metrics.closedTrades, 0); assert.equal(result.metrics.expectancyNetR, null);
});
test('partial 2R and cost-covered breakeven are one closed trade around 1R, with cash PnL reconciled', () => {
  const result = replayStandardSignals({ ...defaults, execution: [bar(baseTime),
    bar(baseTime + 900, 106, plan.targets[0].price + 0.2, 105, 106),
    bar(baseTime + 1800, 101, 102, 99.8, 100)] });
  const trade = result.trades[0];
  assert.equal(result.metrics.closedTrades, 1); assert.equal(trade.fills.length, 2);
  assert.ok(trade.netR >= 1 && trade.netR < 1.01); assert.equal(trade.ambiguous, false);
  assert.ok(Math.abs(result.metrics.finalLiquidationEquity - defaults.initialCapital - trade.netPnl) < 1e-6);
  assert.equal(result.metrics.profitFactor, null); assert.equal(result.metrics.profitFactorReason, 'NO_CLOSED_LOSSES');
});
test('a gap through stop loses more than 1R and is filled at opening price, not the old stop', () => {
  const result = replayStandardSignals({ ...defaults, execution: [bar(baseTime), bar(baseTime + 900, 90, 92, 89, 91)] });
  assert.equal(result.trades[0].fills[0].price, 90); assert.ok(result.trades[0].netR < -1);
  assert.ok(result.metrics.maxDrawdownPercent > 1);
});
test('unresolved stop/target order is marked ambiguous and adverse; opening above TP resolves the order', () => {
  const collision = replayStandardSignals({ ...defaults, execution: [bar(baseTime, 100, plan.targets[0].price + 1, 96, 100)] });
  assert.ok(Math.abs(collision.trades[0].netR + 1) < 1e-9); assert.equal(collision.metrics.ambiguousTrades, 1);
  const gapTp = replayStandardSignals({ ...defaults, execution: [bar(baseTime),
    bar(baseTime + 900, plan.targets[0].price + 1, plan.targets[0].price + 2, 96, 100)] });
  assert.equal(gapTp.trades[0].fills[0].reason, 'tp1-2r'); assert.equal(gapTp.trades[0].ambiguous, false);
  assert.ok(gapTp.trades[0].netR >= 1);
});
test('trail ratchets only after TP1 and only when the new 4H support is available', () => {
  const result = replayStandardSignals({ ...defaults, execution: [bar(baseTime),
    bar(baseTime + 900, 106, plan.targets[0].price + 1, 105, 106),
    bar(baseTime + 1800, 105, 106, 104, 105), bar(baseTime + 2700, 105, 106, 104, 105)],
    trails: [{ availableAt: baseTime + 2700, swingLow: 105, atr: 0.5 }] });
  assert.equal(result.trades[0].exitedAt, new Date((baseTime + 2700) * 1000).toISOString());
  assert.equal(result.trades[0].fills.at(-1).price, 104.5);
});
test('a swing needs right-side confirmation; entry candidates are prefix-invariant and modes stay separate', () => {
  const pivot = [bar(1, 100, 102, 99), bar(2, 100, 102, 98), bar(3, 100, 102, 97), bar(4, 100, 102, 98)];
  assert.deepEqual(confirmedSwings(pivot).lows, []);
  assert.deepEqual(confirmedSwings([...pivot, bar(5, 100, 102, 99)]).lows, [97]);
  const daily = Array.from({ length: 100 }, (_, i) => ({ time: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), open: 90 + i, high: 92 + i, low: 89 + i, close: 91 + i, volume: 10000 }));
  const fourHour = Array.from({ length: 100 }, (_, i) => {
    const close = 100 + i * 0.2 + Math.sin(i) * 2;
    return bar(baseTime - (100 - i) * 14400, close - 0.2, close + 0.5, close - 0.7, close);
  });
  for (const mode of ['breakout', 'pullback']) {
    const full = buildSwingEntries({ daily, fourHour, market: 'thai', mode, rules: RESEARCH_ENTRY_RULES });
    const prefix = buildSwingEntries({ daily, fourHour: fourHour.slice(0, 60), market: 'thai', mode, rules: RESEARCH_ENTRY_RULES });
    assert.deepEqual(full.signals.filter(item => item.signalTime <= fourHour[59].time), prefix.signals);
    assert.ok(full.signals.every(item => item.mode === mode && item.availableAt >= item.signalTime + 15300));
  }
});
test('blocked data has unavailable metrics; missing costs, odd lots and lookahead signals are refused', () => {
  const result = runStandardResearch({}, {}, { blocked: ['D1_AND_4H_REQUIRED'] });
  assert.equal(result.status, 'blocked'); assert.equal(result.metrics, null); assert.equal(result.strategyValidated, false);
  assert.throws(() => replayStandardSignals({ ...defaults, lotSize: 1 }));
  assert.throws(() => replayStandardSignals({ ...defaults, signals: [{ ...signal, availableAt: signal.signalTime }] }));
  const missing = replayStandardSignals({ ...defaults, costs: null, execution: [bar(baseTime)] });
  assert.equal(missing.skipped[0].code, 'COSTS_REQUIRED'); assert.equal(missing.openPosition, null);
});
test('a complete declared fixture replays both entry modes at both risks; a shifted execution slot blocks the run', () => {
  const start = Date.parse('2026-10-14T03:00:00Z') / 1000;
  const daily = Array.from({ length: 201 }, (_, i) => {
    const close = 90 + i * 0.1;
    return { time: new Date(Date.UTC(2026, 9, 14 - 200 + i)).toISOString().slice(0, 10), open: close - 0.2, high: close + 0.5, low: close - 0.5, close, volume: 10000 };
  });
  const fourHour = Array.from({ length: 52 }, (_, i) => {
    const close = i < 50 ? 100 + Math.sin(i) * 0.3 : 102;
    const time = i < 50 ? start - 86400 - (49 - i) * 14400 : start + (i - 50) * 14400;
    return bar(time, close, close + 0.5, close - 0.5, close);
  });
  const execution = Array.from({ length: 32 }, (_, i) => bar(start + i * 900, 102, 103, 101.5, 102.5));
  const manifest = { symbol: 'FIXTURE', instrumentId: 'TEST:FIXTURE', market: 'thai', currency: 'THB', provider: 'unit-fixture', timezone: 'Asia/Bangkok',
    from: '2026-10-14', toExclusive: '2026-10-15', adjustment: 'split-adjusted', entryMode: 'both', entryRules: RESEARCH_ENTRY_RULES,
    constantTickConfirmed: true, tickSize: 0.01, lotSize: 100, initialCapital: 1000000, costs,
    tradingDays: ['2026-10-14'], expected4hBarsByDay: { '2026-10-14': 2 }, expected15mBarsByDay: { '2026-10-14': 32 },
    expected4hStartsByDay: { '2026-10-14': [start, start + 14400] }, expected15mStartsByDay: { '2026-10-14': execution.map(item => item.time) } };
  const frames = { '1d': daily, '4h': fourHour, '15m': execution };
  const preflight = inspectSwingDataset(manifest, frames);
  assert.deepEqual(preflight.blocked, []);
  const result = runStandardResearch(manifest, frames, preflight);
  assert.equal(result.results.length, 4); assert.equal(result.strategyValidated, false);
  assert.deepEqual(result.results.map(item => [item.mode, item.riskFraction]), [['breakout', 0.005], ['breakout', 0.01], ['pullback', 0.005], ['pullback', 0.01]]);
  assert.ok(result.results[0].openPosition, 'fixture breakout must actually enter; comparison cannot pass vacuously');
  const shifted = { ...frames, '15m': execution.map((item, i) => i === 4 ? { ...item, time: item.time + 60 } : item) };
  const rejected = runStandardResearch(manifest, shifted, inspectSwingDataset(manifest, shifted));
  assert.equal(rejected.status, 'blocked'); assert.equal(rejected.metrics, null);
  assert.ok(rejected.blocked.includes('EXECUTION_TIMESTAMPS_UNVERIFIED'));
});
