/**
 * SMC (Smart Money Concepts) & Market Structure Analyzer for Developers & EAs
 * Accepts an array of OHLCV candles (min 10, max 500) and returns structural JSON.
 */

export function analyzeMarketStructure(candles = []) {
  if (!Array.isArray(candles) || candles.length < 10) {
    return {
      status: 'error',
      code: 'INSUFFICIENT_BARS',
      message: 'ต้องส่งแท่งเทียนอย่างน้อย 10 แท่ง (แนะนำ 40 - 500 แท่ง)',
      barsReceived: Array.isArray(candles) ? candles.length : 0,
    };
  }

  const bars = candles.slice(-500).map((b, i) => ({
    index: i,
    time: b.time || b.timestamp || Date.now() - (candles.length - i) * 60000,
    open: Number(b.open) || 0,
    high: Number(b.high) || 0,
    low: Number(b.low) || 0,
    close: Number(b.close) || 0,
    volume: Number(b.volume) || 0,
  }));

  const lastBar = bars[bars.length - 1];
  const firstBar = bars[0];

  // 1. Detect Swing Highs and Swing Lows (using 3-bar swing definition)
  const swingHighs = [];
  const swingLows = [];

  for (let i = 2; i < bars.length - 2; i++) {
    const cur = bars[i];
    const prev1 = bars[i - 1];
    const prev2 = bars[i - 2];
    const next1 = bars[i + 1];
    const next2 = bars[i + 2];

    if (cur.high > prev1.high && cur.high > prev2.high && cur.high > next1.high && cur.high > next2.high) {
      swingHighs.push({ index: i, time: cur.time, price: cur.high });
    }
    if (cur.low < prev1.low && cur.low < prev2.low && cur.low < next1.low && cur.low < next2.low) {
      swingLows.push({ index: i, time: cur.time, price: cur.low });
    }
  }

  const latestSwingHigh = swingHighs[swingHighs.length - 1] || { price: Math.max(...bars.map((b) => b.high)) };
  const latestSwingLow = swingLows[swingLows.length - 1] || { price: Math.min(...bars.map((b) => b.low)) };

  // 2. Trend & Structure Break (BOS / CHoCH)
  const isHigherHigh = swingHighs.length >= 2 && swingHighs[swingHighs.length - 1].price > swingHighs[swingHighs.length - 2].price;
  const isHigherLow = swingLows.length >= 2 && swingLows[swingLows.length - 1].price > swingLows[swingLows.length - 2].price;

  let trend = 'range';
  if (isHigherHigh && isHigherLow) trend = 'bullish';
  else if (!isHigherHigh && !isHigherLow) trend = 'bearish';

  // 3. Equilibrium / Premium / Discount Zones
  const rangeHigh = latestSwingHigh.price;
  const rangeLow = latestSwingLow.price;
  const equilibrium = (rangeHigh + rangeLow) / 2;
  const currentZone = lastBar.close >= equilibrium ? 'premium' : 'discount';

  // 4. Order Blocks (OB) detection
  const orderBlocks = [];
  for (let i = bars.length - 10; i < bars.length - 1; i++) {
    if (i < 1) continue;
    const b = bars[i];
    const next = bars[i + 1];
    // Bullish OB: last down candle before an explosive up move
    if (b.close < b.open && next.close > b.high) {
      orderBlocks.push({
        type: 'demand_ob',
        top: b.high,
        bottom: b.low,
        barIndex: i,
        status: lastBar.close > b.high ? 'fresh' : 'tested',
      });
    }
    // Bearish OB: last up candle before an explosive down move
    if (b.close > b.open && next.close < b.low) {
      orderBlocks.push({
        type: 'supply_ob',
        top: b.high,
        bottom: b.low,
        barIndex: i,
        status: lastBar.close < b.low ? 'fresh' : 'tested',
      });
    }
  }

  // 5. Fair Value Gap (FVG) detection
  const fvgs = [];
  for (let i = bars.length - 10; i < bars.length - 1; i++) {
    if (i < 2) continue;
    const bar1 = bars[i - 2];
    const bar3 = bars[i];
    // Bullish FVG: bar1 high < bar3 low
    if (bar3.low > bar1.high) {
      fvgs.push({
        type: 'bullish_fvg',
        top: bar3.low,
        bottom: bar1.high,
        gapSize: Math.round((bar3.low - bar1.high) * 1000) / 1000,
      });
    }
    // Bearish FVG: bar1 low > bar3 high
    if (bar1.low > bar3.high) {
      fvgs.push({
        type: 'bearish_fvg',
        top: bar1.low,
        bottom: bar3.high,
        gapSize: Math.round((bar1.low - bar3.high) * 1000) / 1000,
      });
    }
  }

  // 6. Actionable 2R Trade Plan
  const stopBuffer = Math.abs(rangeHigh - rangeLow) * 0.05 || lastBar.close * 0.01;
  const isBull = trend === 'bullish' || currentZone === 'discount';
  const entry = lastBar.close;
  const stopLoss = isBull ? Math.max(0, latestSwingLow.price - stopBuffer) : latestSwingHigh.price + stopBuffer;
  const stopDistance = Math.abs(entry - stopLoss);
  const target = isBull ? entry + stopDistance * 2 : entry - stopDistance * 2;

  const tradePlan = {
    strategy: isBull ? 'SMC_DISCOUNT_DEMAND_EXPANSION' : 'SMC_PREMIUM_SUPPLY_FADE',
    bias: isBull ? 'LONG' : 'SHORT',
    entryPrice: Math.round(entry * 1000) / 1000,
    stopLoss: Math.round(stopLoss * 1000) / 1000,
    targetPrice: Math.round(Math.max(0, target) * 1000) / 1000,
    riskRewardRatio: '1:2.0',
    breakevenWinRateRequired: '33.3%',
    invalidationReason: isBull ? 'Price closes below last demand swing' : 'Price closes above last supply swing',
  };

  return {
    status: 'success',
    timestamp: Date.now(),
    barsAnalyzed: bars.length,
    structure: {
      trend,
      currentZone,
      equilibrium: Math.round(equilibrium * 1000) / 1000,
      swingHigh: latestSwingHigh.price,
      swingLow: latestSwingLow.price,
      orderBlocks: orderBlocks.slice(-3),
      fairValueGaps: fvgs.slice(-3),
    },
    plan: tradePlan,
  };
}
