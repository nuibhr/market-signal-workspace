import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePositionSize } from './calculator.mjs';

describe('Multi-Market Risk & Position Calculator Engine', () => {
  it('validates invalid inputs cleanly', () => {
    const res = calculatePositionSize({ capital: 0, entryPrice: 100, stopLossPrice: 90 });
    assert.equal(res.isValid, false);
    assert.match(res.error, /ทุน/);
  });

  it('rejects inverted stop loss for Long position', () => {
    const res = calculatePositionSize({
      market: 'thai',
      side: 'long',
      capital: 100000,
      entryPrice: 50,
      stopLossPrice: 55, // Invalid for long
    });
    assert.equal(res.isValid, false);
    assert.match(res.error, /Stop Loss ต้องต่ำกว่าราคาเข้า/);
  });

  it('rejects inverted stop loss for Short position', () => {
    const res = calculatePositionSize({
      market: 'tfex',
      side: 'short',
      capital: 100000,
      entryPrice: 900,
      stopLossPrice: 890, // Invalid for short
    });
    assert.equal(res.isValid, false);
    assert.match(res.error, /Stop Loss ต้องสูงกว่าราคาเข้า/);
  });

  it('calculates Thai stocks with 100-share board lot rounding', () => {
    // 100,000 THB capital, 1% risk = 1,000 THB
    // Entry 50, SL 48 -> Stop distance = 2 THB
    // Raw shares = 1,000 / 2 = 500 shares -> exactly 5 board lots (500 shares)
    const res = calculatePositionSize({
      market: 'thai',
      side: 'long',
      capital: 100000,
      riskPercent: 1.0,
      entryPrice: 50,
      stopLossPrice: 48,
      targetMultiple: 2.0,
    });
    assert.equal(res.isValid, true);
    assert.equal(res.units, 500);
    assert.equal(res.unitLabel, 'หุ้น');
    assert.equal(res.targetPrice, 54);
    assert.equal(res.riskAmount, 1000);
  });

  it('calculates TFEX S50 contracts accurately', () => {
    // 200,000 THB capital, 2% risk = 4,000 THB
    // Entry 920, SL 915 -> 5 points distance
    // 1 point = 200 THB -> 5 points = 1,000 THB risk per contract
    // Contracts = 4,000 / 1,000 = 4 contracts
    const res = calculatePositionSize({
      market: 'tfex',
      side: 'long',
      capital: 200000,
      riskPercent: 2.0,
      entryPrice: 920,
      stopLossPrice: 915,
      targetMultiple: 2.0,
    });
    assert.equal(res.isValid, true);
    assert.equal(res.units, 4);
    assert.equal(res.unitLabel, 'สัญญา');
    assert.equal(res.targetPrice, 930);
    assert.equal(res.expectedLoss, 4000);
    assert.equal(res.expectedGain, 8000);
  });

  it('calculates Gold (XAU/USD) lot sizing correctly', () => {
    // $10,000 capital, 1% risk = $100
    // Entry $2650, SL $2645 -> $5 distance
    // $1 move in 1.0 lot = $100 -> $5 move in 1.0 lot = $500
    // Lots = 100 / 500 = 0.20 lots
    const res = calculatePositionSize({
      market: 'gold',
      side: 'long',
      capital: 10000,
      riskPercent: 1.0,
      entryPrice: 2650,
      stopLossPrice: 2645,
      targetMultiple: 2.0,
    });
    assert.equal(res.isValid, true);
    assert.equal(res.units, 0.2);
    assert.equal(res.unitLabel, 'Lots');
    assert.equal(res.targetPrice, 2660);
  });
});
