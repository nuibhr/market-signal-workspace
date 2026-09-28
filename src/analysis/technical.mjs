function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function last(values) { return values.at(-1) ?? null; }

function ema(values, period) {
  const multiplier = 2 / (period + 1);
  const output = [];
  let current = null;
  for (let index = 0; index < values.length; index += 1) {
    if (index === period - 1) current = average(values.slice(0, period));
    else if (index >= period) current = values[index] * multiplier + current * (1 - multiplier);
    output.push(current);
  }
  return output;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  const ratio = averageGain / averageLoss;
  return 100 - 100 / (1 + ratio);
}

function pivotLevels(bars, price) {
  const window = bars.slice(-90);
  const lows = [];
  const highs = [];
  for (let index = 2; index < window.length - 2; index += 1) {
    const bar = window[index];
    if (window.slice(index - 2, index + 3).every(other => other.low >= bar.low)) lows.push(bar.low);
    if (window.slice(index - 2, index + 3).every(other => other.high <= bar.high)) highs.push(bar.high);
  }
  const support = lows.filter(level => level < price).sort((a, b) => b - a)[0]
    ?? Math.min(...window.slice(-20).map(bar => bar.low));
  const resistance = highs.filter(level => level > price).sort((a, b) => a - b)[0]
    ?? Math.max(...window.slice(-20).map(bar => bar.high));
  return { support, resistance };
}

export function analyzeCandles(bars, quotePrice = null, timeframeLabel = 'รายวัน') {
  if (!Array.isArray(bars) || bars.length < 50) return null;
  const closes = bars.map(bar => bar.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdSeries = ema12.map((value, index) => value === null || ema26[index] === null ? null : value - ema26[index]);
  const macdValues = macdSeries.filter(value => value !== null);
  const signalSeries = ema(macdValues, 9);
  const macd = last(macdValues);
  const macdSignal = last(signalSeries);
  const recent = closes.slice(-20);
  const mean = average(recent);
  const deviation = Math.sqrt(average(recent.map(value => (value - mean) ** 2)));
  const price = typeof quotePrice === 'number' && quotePrice > 0 ? quotePrice : last(closes);
  const levels = pivotLevels(bars, price);
  const latestEma20 = last(ema20);
  const latestEma50 = last(ema50);
  const latestRsi = rsi(closes);
  const previousHigh = Math.max(...bars.slice(-21, -1).map(bar => bar.high));
  const trend = latestEma20 > latestEma50 && price > latestEma20 ? 'up'
    : latestEma20 < latestEma50 && price < latestEma20 ? 'down' : 'sideways';
  const events = [];
  if (closes.at(-2) <= ema20.at(-2) && closes.at(-1) > latestEma20) events.push({ tone: 'up', label: 'กลับขึ้นเหนือ EMA20' });
  if (closes.at(-2) >= ema20.at(-2) && closes.at(-1) < latestEma20) events.push({ tone: 'down', label: 'หลุด EMA20' });
  if (closes.at(-1) > previousHigh) events.push({ tone: 'up', label: 'ปิดเหนือจุดสูงสุด 20 แท่ง' });
  if (latestRsi >= 70) events.push({ tone: 'watch', label: 'RSI อยู่ในเขตสูง' });
  if (latestRsi <= 30) events.push({ tone: 'watch', label: 'RSI อยู่ในเขตต่ำ' });
  if (Math.abs(price - levels.support) / price <= 0.01) events.push({ tone: 'watch', label: 'ราคาใกล้แนวรับ' });
  if (!events.length) events.push({ tone: 'flat', label: 'ยังไม่มีเงื่อนไขสแกนเด่น' });

  const plan = trend === 'up' && levels.resistance > price
    ? { title: 'เฝ้าดูการปิดเหนือแนวต้าน', trigger: levels.resistance, invalidation: levels.support,
      rationale: `EMA20 อยู่เหนือ EMA50 และราคาอยู่เหนือ EMA20; รอแท่ง ${timeframeLabel} ยืนยันเหนือแนวต้านก่อนประเมินใหม่` }
    : trend === 'down'
      ? { title: 'รอการฟื้นตัวเหนือ EMA20', trigger: latestEma20, invalidation: levels.support,
        rationale: 'EMA20 ต่ำกว่า EMA50 และราคาอยู่ใต้ EMA20; ยังไม่มีเงื่อนไขฝั่งขาขึ้นที่ยืนยันแล้ว' }
      : { title: 'เฝ้าดูกรอบแนวรับและแนวต้าน', trigger: levels.resistance, invalidation: levels.support,
        rationale: `แนวโน้มยังไม่ชัดเจน; ใช้การปิดแท่ง ${timeframeLabel} เทียบกับขอบกรอบเพื่อประเมินต่อ` };

  return {
    price,
    support: levels.support,
    resistance: levels.resistance,
    ema20: latestEma20,
    ema50: latestEma50,
    ema20Series: ema20.map((value, index) => value === null ? null : { time: bars[index].time, value }).filter(Boolean),
    ema50Series: ema50.map((value, index) => value === null ? null : { time: bars[index].time, value }).filter(Boolean),
    sma20Series: closes.map((_, index) => index < 19 ? null : { time: bars[index].time, value: average(closes.slice(index - 19, index + 1)) }).filter(Boolean),
    donchianUpperSeries: bars.map((_, index) => index < 19 ? null : { time: bars[index].time, value: Math.max(...bars.slice(index - 19, index + 1).map(bar => bar.high)) }).filter(Boolean),
    donchianLowerSeries: bars.map((_, index) => index < 19 ? null : { time: bars[index].time, value: Math.min(...bars.slice(index - 19, index + 1).map(bar => bar.low)) }).filter(Boolean),
    vwapSeries: (() => {
      let priceVolume = 0;
      let totalVolume = 0;
      return bars.map(bar => {
        if (!Number.isFinite(bar.volume) || bar.volume <= 0) return null;
        priceVolume += (bar.high + bar.low + bar.close) / 3 * bar.volume;
        totalVolume += bar.volume;
        return { time: bar.time, value: priceVolume / totalVolume };
      }).filter(Boolean);
    })(),
    bollinger: { middle: mean, upper: mean + 2 * deviation, lower: mean - 2 * deviation },
    bollingerUpperSeries: closes.map((_, index) => {
      if (index < 19) return null;
      const sample = closes.slice(index - 19, index + 1);
      const middle = average(sample);
      return { time: bars[index].time, value: middle + 2 * Math.sqrt(average(sample.map(value => (value - middle) ** 2))) };
    }).filter(Boolean),
    bollingerLowerSeries: closes.map((_, index) => {
      if (index < 19) return null;
      const sample = closes.slice(index - 19, index + 1);
      const middle = average(sample);
      return { time: bars[index].time, value: middle - 2 * Math.sqrt(average(sample.map(value => (value - middle) ** 2))) };
    }).filter(Boolean),
    rsi14: latestRsi,
    macd,
    macdSignal,
    macdHistogram: macd - macdSignal,
    trend,
    events,
    plan,
    analyzedDay: bars.at(-1).time,
  };
}
