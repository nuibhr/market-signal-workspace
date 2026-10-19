import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMarketStructure } from './structure.mjs';

describe('Developer Structure Engine', () => {
  it('returns error when bars count is less than 10', () => {
    const res = analyzeMarketStructure([{ open: 1, high: 2, low: 0.5, close: 1.5 }]);
    assert.equal(res.status, 'error');
    assert.equal(res.code, 'INSUFFICIENT_BARS');
  });

  it('analyzes valid candle sequence and extracts structure and 2R plan', () => {
    // Generate 30 ascending candles
    const sampleCandles = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 100 + i * 1.0,
      high: 102 + i * 1.0,
      low: 99.5 + i * 1.0,
      close: 101.5 + i * 1.0,
      volume: 1000 + i * 50,
    }));

    const res = analyzeMarketStructure(sampleCandles);
    assert.equal(res.status, 'success');
    assert.equal(res.barsAnalyzed, 30);
    assert.ok(res.structure);
    assert.ok(res.structure.equilibrium > 0);
    assert.ok(res.plan);
    assert.equal(res.plan.riskRewardRatio, '1:2.0');
    assert.equal(res.plan.breakevenWinRateRequired, '33.3%');
    assert.ok(res.plan.entryPrice > 0);
    assert.ok(res.plan.stopLoss > 0);
    assert.ok(res.plan.targetPrice > 0);
  });
});
