import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcCamarilla,
  calcEma,
  calcRsi,
  calcMacd,
  calcAtr,
  chooseEntryPlan,
  scoreDRCandidate,
  calcIndicativePrice,
  THAI_DIVIDEND_PORTFOLIO_MODEL,
  TOP_THAI_DIVIDEND_STOCKS,
  FEATURED_DR_UNIVERSE,
} from './strategy-tracker.mjs';

test('calcCamarilla computes accurate 8-level pivots and central pivot', () => {
  const high = 85.0;
  const low = 80.0;
  const close = 82.0;
  const cam = calcCamarilla(high, low, close);

  // Range = 5.0
  // Pivot = (85 + 80 + 82) / 3 = 82.33
  // R1 = close + 5 * 1.1 / 12 = 82 + 0.458 = 82.46
  // R2 = close + 5 * 1.1 / 6 = 82 + 0.917 = 82.92
  // R3 = close + 5 * 1.1 / 4 = 82 + 1.375 = 83.38
  // R4 = close + 5 * 1.1 / 2 = 82 + 2.75 = 84.75
  // S1 = close - 5 * 1.1 / 12 = 82 - 0.458 = 81.54
  // S2 = close - 5 * 1.1 / 6 = 82 - 0.917 = 81.08
  // S3 = close - 5 * 1.1 / 4 = 82 - 1.375 = 80.63
  // S4 = close - 5 * 1.1 / 2 = 82 - 2.75 = 79.25

  assert.equal(cam.pivot, 82.33);
  assert.equal(cam.R1, 82.46);
  assert.equal(cam.R2, 82.92);
  assert.equal(cam.R3, 83.38);
  assert.equal(cam.R4, 84.75);
  assert.equal(cam.S1, 81.54);
  assert.equal(cam.S2, 81.08);
  assert.equal(cam.S3, 80.63);
  assert.equal(cam.S4, 79.25);
});

test('calcEma returns exponential moving average with sufficient period', () => {
  const prices = Array.from({ length: 30 }, (_, i) => 10 + i);
  const ema25 = calcEma(prices, 25);
  assert.ok(typeof ema25 === 'number' && ema25 > 20);
  assert.equal(calcEma([10, 11], 25), null);
});

test('calcRsi returns valid momentum value between 0 and 100', () => {
  const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
  const rsi = calcRsi(closes, 14);
  assert.ok(typeof rsi === 'number');
  assert.ok(rsi >= 70, 'Monotonically rising closes should produce high RSI');
});

test('calcMacd calculates MACD line, signal line, and histogram', () => {
  const closes = Array.from({ length: 45 }, (_, i) => 50 + Math.sin(i / 5) * 5 + i * 0.2);
  const macd = calcMacd(closes);
  assert.ok(macd !== null);
  assert.ok(typeof macd.macdLine === 'number');
  assert.ok(typeof macd.signalLine === 'number');
  assert.ok(typeof macd.histogram === 'number');
  assert.equal(Math.round((macd.macdLine - macd.signalLine) * 10000) / 10000, macd.histogram);
});

test('chooseEntryPlan generates actionable entry, TP1, TP2, and SL with positive R:R', () => {
  const currentPrice = 81.25;
  const ema25 = 80.50;
  const cam = calcCamarilla(82.5, 79.5, 81.0);
  const effectiveAtr = 1.20;

  const plan = chooseEntryPlan({ currentPrice, ema25, camarilla: cam, effectiveAtr });
  assert.ok(plan.entry <= currentPrice * 1.002);
  assert.ok(plan.sl < plan.entry, 'Stop loss must be below entry');
  assert.ok(plan.tp1 > plan.entry, 'TP1 must be above entry');
  assert.ok(plan.tp2 > plan.tp1, 'TP2 must be above TP1');
  assert.ok(plan.riskReward >= 0);
  assert.ok(typeof plan.label === 'string');
});

test('scoreDRCandidate produces composite score <= 16 and rich breakdown', () => {
  const item = FEATURED_DR_UNIVERSE[0]; // AAPL80
  const candidate = scoreDRCandidate({
    symbol: item.symbol,
    currentPrice: item.currentDrPrice,
    changePct: item.changePct,
    closes: Array.from({ length: 30 }, (_, i) => 75 + i * 0.25),
    highs: Array.from({ length: 30 }, (_, i) => 76 + i * 0.25),
    lows: Array.from({ length: 30 }, (_, i) => 74.5 + i * 0.25),
    underlying: item.underlying,
  });

  assert.ok(candidate !== null);
  assert.ok(candidate.totalScore >= 0 && candidate.totalScore <= 16);
  assert.ok(candidate.emaScore >= 0 && candidate.emaScore <= 3);
  assert.ok(candidate.rsiScore >= 0 && candidate.rsiScore <= 3);
  assert.ok(candidate.camScore >= 0 && candidate.camScore <= 4);
  assert.ok(candidate.macdScore >= 0 && candidate.macdScore <= 3);
  assert.ok(candidate.reason.length > 5);
});

test('calcIndicativePrice calculates Fair Value, Premium/Discount % and status', () => {
  // Scenario 1: Discount (Underlying = $235.40, Rate = 34.50, Ratio = 100 -> Fair = 81.21, Market DR = 79.50)
  const discountRes = calcIndicativePrice({
    underlyingUsd: 235.40,
    usdThbRate: 34.50,
    conversionRatio: 100,
    currentDrPrice: 79.50,
  });
  assert.equal(discountRes.fairPriceThb, 81.21);
  assert.equal(discountRes.status, 'DISCOUNT');
  assert.ok(discountRes.diffPct < 0);

  // Scenario 2: Premium (Market DR = 83.50, Fair = 81.21)
  const premiumRes = calcIndicativePrice({
    underlyingUsd: 235.40,
    usdThbRate: 34.50,
    conversionRatio: 100,
    currentDrPrice: 83.50,
  });
  assert.equal(premiumRes.status, 'PREMIUM');
  assert.ok(premiumRes.diffPct > 0);

  // Scenario 3: Fair Zone (Market DR = 81.25, Fair = 81.21)
  const fairRes = calcIndicativePrice({
    underlyingUsd: 235.40,
    usdThbRate: 34.50,
    conversionRatio: 100,
    currentDrPrice: 81.25,
  });
  assert.equal(fairRes.status, 'FAIR');
});

test('THAI_DIVIDEND_PORTFOLIO_MODEL allocates exactly 100% across all 5 buckets', () => {
  const totalTarget = THAI_DIVIDEND_PORTFOLIO_MODEL.reduce((sum, item) => sum + item.target, 0);
  assert.equal(totalTarget, 100, 'Model portfolio allocation targets must sum to 100%');
  assert.equal(THAI_DIVIDEND_PORTFOLIO_MODEL.length, 5);
  assert.ok(TOP_THAI_DIVIDEND_STOCKS.length >= 6);
});
