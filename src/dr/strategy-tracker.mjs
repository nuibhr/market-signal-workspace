/**
 * DR Strategy Tracker & Thai Dividend Portfolio Engine
 * Inspired and integrated from nuibhr/--dr-strategy-tracker-----ai-research
 * 
 * Features:
 *   1. DR80 Multi-Factor Scanner (EMA 25/50/75, Camarilla Pivots, RSI 14, MACD, ATR)
 *   2. Dynamic Trade Plan with Confluence Entry, TP1, TP2, SL, and Risk:Reward (Max Score 16)
 *   3. Indicative Fair Value & Arbitrage Spread Bridge (Underlying USD * USD/THB / Ratio vs SET DR Price)
 *   4. Thai High-Dividend Portfolio Radar & Allocation Model (SETHD, XD dates, Yield %, Cashflow)
 */

// ─── Camarilla Pivots ─────────────────────────────────────────────────────────

export function calcCamarilla(high, low, close) {
  const range = high - low;
  const r = (v) => Math.round(v * 100) / 100;
  return {
    pivot: r((high + low + close) / 3),
    R1: r(close + range * 1.1 / 12),
    R2: r(close + range * 1.1 / 6),
    R3: r(close + range * 1.1 / 4),
    R4: r(close + range * 1.1 / 2),
    S1: r(close - range * 1.1 / 12),
    S2: r(close - range * 1.1 / 6),
    S3: r(close - range * 1.1 / 4),
    S4: r(close - range * 1.1 / 2),
  };
}

// ─── Technical Indicators ─────────────────────────────────────────────────────

export function calcEma(prices, period) {
  if (!Array.isArray(prices) || prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 10000) / 10000;
}

export function calcRsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

export function calcMacd(closes, fast = 12, slow = 26, signal = 9) {
  if (!Array.isArray(closes) || closes.length < slow + signal) return null;

  const macdHistory = [];
  for (let i = slow; i <= closes.length; i++) {
    const ef = calcEma(closes.slice(0, i), fast);
    const es = calcEma(closes.slice(0, i), slow);
    if (ef !== null && es !== null) macdHistory.push(ef - es);
  }
  if (macdHistory.length < signal) return null;

  const macdLine = macdHistory[macdHistory.length - 1];
  const signalLine = calcEma(macdHistory, signal);
  if (signalLine === null) return null;
  const histogram = macdLine - signalLine;

  return {
    macdLine: Math.round(macdLine * 10000) / 10000,
    signalLine: Math.round(signalLine * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
  };
}

export function calcAtr(highs, lows, closes, period = 14) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) || highs.length < period + 1) {
    return 0;
  }
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hpc = Math.abs(highs[i] - closes[i - 1]);
    const lpc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hpc, lpc));
  }
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

export function roundPrice(value) {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

// ─── Trade Plan Selection ─────────────────────────────────────────────────────

export function chooseEntryPlan({ currentPrice, ema25, camarilla: cam, effectiveAtr }) {
  const buyZoneLow = Math.min(cam.S2, cam.S3);
  const buyZoneHigh = Math.max(cam.S2, cam.S3);
  const isInBuyZone = currentPrice >= buyZoneLow && currentPrice <= buyZoneHigh;

  const candidates = [
    { price: cam.S2, label: 'Camarilla S2' },
    { price: (cam.S2 + cam.S3) / 2, label: 'กลางโซน Camarilla S2-S3' },
    { price: cam.S3, label: 'Camarilla S3' },
    { price: ema25, label: 'EMA25 pullback' },
    { price: currentPrice - effectiveAtr * 0.75, label: 'ย่อ 0.75 ATR' },
  ]
    .filter(candidate => Number.isFinite(candidate.price) && candidate.price > 0)
    .filter(candidate => candidate.price <= currentPrice * 1.002)
    .filter(candidate => candidate.price >= currentPrice * 0.92);

  const scored = candidates.map(candidate => {
    const pullbackPct = (currentPrice - candidate.price) / currentPrice;
    let score = 0;

    if (candidate.price >= buyZoneLow && candidate.price <= buyZoneHigh) score += 4;
    if (Math.abs(candidate.price - cam.S3) <= effectiveAtr * 0.35) score += 2;
    if (Math.abs(candidate.price - ema25) <= effectiveAtr * 0.35) score += 2;
    if (pullbackPct >= 0.005 && pullbackPct <= 0.04) score += 2;
    else if (pullbackPct >= 0 && pullbackPct < 0.005) score += isInBuyZone ? 2 : 0;
    else if (pullbackPct > 0.06) score -= 1;

    return { ...candidate, score };
  });

  scored.sort((a, b) => b.score - a.score || b.price - a.price);
  const selected = scored[0] ?? {
    price: currentPrice - effectiveAtr * 0.75,
    label: 'ย่อ 0.75 ATR',
    score: 0,
  };

  const rawEntry = isInBuyZone && currentPrice <= selected.price * 1.003
    ? currentPrice
    : selected.price;
  const entry = roundPrice(Math.min(rawEntry, currentPrice));

  const slByAtr = entry - effectiveAtr * 1.2;
  const slByCamarilla = cam.S4 < entry ? cam.S4 - effectiveAtr * 0.1 : slByAtr;
  const sl = roundPrice(Math.min(slByAtr, slByCamarilla));

  const tp1Candidates = [entry + effectiveAtr * 1.5, cam.pivot, cam.R1].filter(p => p > entry);
  const tp2Candidates = [entry + effectiveAtr * 2.8, cam.R2, cam.R3].filter(p => p > entry);
  const tp1 = roundPrice(Math.max(...tp1Candidates, entry * 1.025));
  const tp2 = roundPrice(Math.max(...tp2Candidates, entry * 1.05));

  const riskReward = entry - sl > 0
    ? Math.round(((tp1 - entry) / (entry - sl)) * 100) / 100
    : 0;

  const pullbackPct = Math.max(0, ((currentPrice - entry) / currentPrice) * 100);
  const label = entry === roundPrice(currentPrice)
    ? 'ราคาอยู่ใน buy zone แล้ว'
    : `รอรับ ${selected.label} (-${pullbackPct.toFixed(1)}%)`;

  return { entry, tp1, tp2, sl, riskReward, label };
}

export const RADAR_SCORING_VERSION='radar-score-v2';
export function scoreCamarillaPrice(price,cam) {
  const low=Math.min(cam.S2,cam.S3),high=Math.max(cam.S2,cam.S3);
  if(price>=low&&price<=high)return 4;
  if(price>cam.pivot&&price<=cam.R3)return 2;
  if(price>=cam.S3&&price<=cam.R3)return 1;
  return 0;
}

// ─── Multi-Factor Scorer (16-Point Scale) ──────────────────────────────────────

export function scoreDRCandidate({
  symbol,
  currentPrice,
  changePct = 0,
  closes = [],
  highs = [],
  lows = [],
  underlying = null,
}) {
  if (!Array.isArray(closes) || closes.length < 10) {
    return null;
  }

  // 1. EMA
  const ema25 = calcEma(closes, Math.min(25, closes.length));
  const ema50 = calcEma(closes, Math.min(50, closes.length));
  const ema75 = calcEma(closes, Math.min(75, closes.length));

  let emaScore = 0;
  if (ema25 !== null && currentPrice > ema25) emaScore++;
  if (ema25 !== null && ema50 !== null && ema25 > ema50) emaScore++;
  if (ema50 !== null && ema75 !== null && ema50 > ema75) emaScore++;
  const emaAligned = emaScore === 3;

  // 2. RSI
  const rsi = calcRsi(closes) ?? 50;
  let rsiScore = 0;
  if (rsi >= 40 && rsi <= 60) rsiScore = 3;
  else if (rsi >= 30 && rsi < 40) rsiScore = 2;
  else if (rsi > 60 && rsi <= 70) rsiScore = 1;
  else if (rsi < 30) rsiScore = 1;

  // 3. MACD
  const macdData = calcMacd(closes);
  const macdLine = macdData?.macdLine ?? 0;
  const signalLine = macdData?.signalLine ?? 0;
  const histogram = macdData?.histogram ?? 0;
  let macdScore = 0;
  if (macdLine > signalLine) macdScore++;
  if (histogram > 0) macdScore++;
  const prevMacd = calcMacd(closes.slice(0, -1));
  if (prevMacd && histogram > prevMacd.histogram) macdScore++;

  // 4. ATR
  const atr = calcAtr(highs, lows, closes, 14);
  const effectiveAtr = Math.max(atr, currentPrice * 0.005);

  // 5. Camarilla Pivots (5-day lookback)
  const lookback = Math.min(5, highs.length, lows.length);
  const weeklyHigh = Math.max(...highs.slice(-lookback));
  const weeklyLow = Math.min(...lows.slice(-lookback));
  const prevClose = closes[closes.length - 2] ?? closes[closes.length - 1];
  const cam = calcCamarilla(weeklyHigh, weeklyLow, prevClose);

  const camScore=scoreCamarillaPrice(currentPrice,cam);

  // Entry Plan
  const plan = chooseEntryPlan({ currentPrice, ema25: ema25 ?? currentPrice, camarilla: cam, effectiveAtr });

  // Total Score (Max 16)
  const emaContrib = emaScore >= 1 ? emaScore * 2 : 0;
  const totalScore = emaContrib + camScore + rsiScore + macdScore;

  // Thai Reasons
  const reasons = [];
  if (emaAligned) reasons.push('EMA 25/50/75 เรียงตัวขึ้น');
  else if (emaScore >= 2) reasons.push('EMA เริ่มเรียงตัวขึ้น');
  if (rsi >= 40 && rsi <= 60) reasons.push(`RSI ${rsi.toFixed(1)} อยู่ในโซนดี`);
  else if (rsi < 40) reasons.push(`RSI ${rsi.toFixed(1)} ใกล้ oversold`);
  if (histogram > 0) reasons.push('MACD momentum เป็นบวก');
  if (camScore === 4) reasons.push('ราคาอยู่ระหว่าง Camarilla S3–S2 (Buy Zone)');
  else if (currentPrice > cam.pivot) reasons.push('ราคาอยู่เหนือ Pivot');
  reasons.push(plan.label);

  const reason = reasons.join(' | ') || 'Technical setup น่าสนใจ';

  return {
    symbol,
    currentPrice,
    changePct,
    ema25,
    ema50,
    ema75,
    emaAligned,
    emaScore,
    rsi,
    rsiScore,
    macdLine,
    signalLine,
    histogram,
    macdScore,
    camarilla: cam,
    camScore,
    entry: plan.entry,
    tp1: plan.tp1,
    tp2: plan.tp2,
    sl: plan.sl,
    riskReward: plan.riskReward,
    totalScore,
    scoringVersion:RADAR_SCORING_VERSION,
    reason,
    underlying,
  };
}

// ─── Indicative Fair Value & Arbitrage Spread Bridge ─────────────────────────

export function calcIndicativePrice({
  underlyingUsd,
  usdThbRate = 34.50,
  conversionRatio = 100, // 100 DR = 1 Share
  currentDrPrice,
}) {
  if (!underlyingUsd || underlyingUsd <= 0 || !currentDrPrice || currentDrPrice <= 0) {
    return null;
  }

  // Fair Value = (Price_USD * USD/THB) / Ratio
  const fairPriceThb = Math.round(((underlyingUsd * usdThbRate) / conversionRatio) * 100) / 100;
  const diffThb = Math.round((currentDrPrice - fairPriceThb) * 100) / 100;
  const diffPct = Math.round(((currentDrPrice - fairPriceThb) / fairPriceThb) * 10000) / 100;

  let status = 'FAIR';
  let label = 'ราคาสมดุล (Fair Zone)';
  let color = '#10b981'; // Emerald

  if (diffPct > 1.5) {
    status = 'PREMIUM';
    label = `Premium +${diffPct.toFixed(2)}% (แพงกว่าหุ้นแม่)`;
    color = '#f59e0b'; // Amber
  } else if (diffPct < -1.5) {
    status = 'DISCOUNT';
    label = `Discount ${diffPct.toFixed(2)}% (ถูกกว่าหุ้นแม่)`;
    color = '#0284c7'; // Blue
  }

  return {
    underlyingUsd,
    usdThbRate,
    conversionRatio,
    currentDrPrice,
    fairPriceThb,
    diffThb,
    diffPct,
    status,
    label,
    color,
  };
}

// ─── Thai Dividend Portfolio Data & Model Allocation ──────────────────────────

export const THAI_DIVIDEND_PORTFOLIO_MODEL = [
  { bucket: 'Defensive income', target: 35, description: 'สาธารณูปโภค, สื่อสาร, โครงสร้างพื้นฐาน', examples: ['ADVANC', 'GULF', 'GPSC', 'DIF'] },
  { bucket: 'Quality dividend growth', target: 35, description: 'ธุรกิจที่กำไรและเงินปันผลเติบโตสม่ำเสมอ', examples: ['PTT', 'CPALL', 'BDMS', 'AP'] },
  { bucket: 'Financials', target: 15, description: 'ธนาคาร/การเงิน ปันผลสูง กระจายความเสี่ยง', examples: ['SCB', 'TISCO', 'KBANK'] },
  { bucket: 'REIT & Property Fund', target: 10, description: 'กระแสเงินสดปันผลสม่ำเสมอทุกไตรมาส', examples: ['CPNREIT', 'WHART', 'FTREIT'] },
  { bucket: 'Cash buffer', target: 5, description: 'สภาพคล่องรอ rebalancing และจังหวะย่อ', examples: ['THB Cash / Money Market'] },
];

export const TOP_THAI_DIVIDEND_STOCKS = [
  {
    symbol: 'TISCO',
    name: 'บมจ.ทิสโก้ไฟแนนเชียลกรุ๊ป',
    sector: 'Banking & Financials',
    price: 98.50,
    annualDividend: 7.75,
    yieldPct: 7.87,
    frequency: 'ปีละ 1 ครั้ง',
    payoutRatio: 85.4,
    lastXdDate: '2026-04-24',
    nextXdDate: 'เม.ย. 2027 (คาดการณ์)',
    safetyScore: 92,
    bucket: 'Financials',
    highlight: 'ปันผลสูงสม่ำเสมอ NPL ต่ำ สำรองสูงเป็นอันดับต้นของกลุ่มธนาคาร',
  },
  {
    symbol: 'SCB',
    name: 'บมจ.เอสซีบี เอกซ์',
    sector: 'Banking & Financials',
    price: 114.50,
    annualDividend: 8.44,
    yieldPct: 7.37,
    frequency: 'ปีละ 2 ครั้ง',
    payoutRatio: 78.2,
    lastXdDate: '2026-08-28',
    nextXdDate: 'เม.ย. 2027 (ปันผลงวดสุดท้าย)',
    safetyScore: 90,
    bucket: 'Financials',
    highlight: 'นโยบายจ่ายปันผลเชิงรุก กระแสเงินสดแข็งแกร่ง ROE ระดับแถวหน้า',
  },
  {
    symbol: 'ADVANC',
    name: 'บมจ.แอดวานซ์ อินโฟร์ เซอร์วิส',
    sector: 'Telecom & Tech',
    price: 278.00,
    annualDividend: 11.20,
    yieldPct: 4.03,
    frequency: 'ปีละ 2 ครั้ง',
    payoutRatio: 85.0,
    lastXdDate: '2026-08-19',
    nextXdDate: 'ก.พ. 2027 (ปันผลงวดสุดท้าย)',
    safetyScore: 98,
    bucket: 'Defensive income',
    highlight: 'Cash Cow ประจำตลาด สัญญาณ 5G ครอบคลุม ขยายสู่ AI Data Center ร่วมกับ GULF',
  },
  {
    symbol: 'PTT',
    name: 'บมจ.ปตท.',
    sector: 'Energy & Utilities',
    price: 34.00,
    annualDividend: 2.10,
    yieldPct: 6.18,
    frequency: 'ปีละ 2 ครั้ง',
    payoutRatio: 52.3,
    lastXdDate: '2026-09-04',
    nextXdDate: 'มี.ค. 2027 (ปันผลงวดสุดท้าย)',
    safetyScore: 94,
    bucket: 'Quality dividend growth',
    highlight: 'รัฐวิสาหกิจพลังงานมั่นคง Balance Sheet แกร่ง จ่ายปันผลมากกว่า 20 ปีต่อเนื่อง',
  },
  {
    symbol: 'AP',
    name: 'บมจ.เอพี (ไทยแลนด์)',
    sector: 'Property & Real Estate',
    price: 10.20,
    annualDividend: 0.70,
    yieldPct: 6.86,
    frequency: 'ปีละ 1 ครั้ง',
    payoutRatio: 42.1,
    lastXdDate: '2026-05-08',
    nextXdDate: 'พ.ค. 2027 (คาดการณ์)',
    safetyScore: 86,
    bucket: 'Quality dividend growth',
    highlight: 'ผู้นำอสังหาฯ แนวราบ Backlog หนาแน่น Payout ปลอดภัยและมีส่วนลด Valuation',
  },
  {
    symbol: 'SPALI',
    name: 'บมจ.ศุภาลัย',
    sector: 'Property & Real Estate',
    price: 18.60,
    annualDividend: 1.45,
    yieldPct: 7.80,
    frequency: 'ปีละ 2 ครั้ง',
    payoutRatio: 45.0,
    lastXdDate: '2026-08-26',
    nextXdDate: 'เม.ย. 2027 (ปันผลงวดสุดท้าย)',
    safetyScore: 88,
    bucket: 'Quality dividend growth',
    highlight: 'อัตรากำไรสุทธิสูงสุดในกลุ่มอสังหาฯ หนี้สินต่อทุนต่ำ ขยายตลาดออสเตรเลีย',
  },
  {
    symbol: 'DIF',
    name: 'กองทุนรวมโครงสร้างพื้นฐานโทรคมนาคม ดิจิทัล',
    sector: 'Infrastructure Fund',
    price: 8.50,
    annualDividend: 0.82,
    yieldPct: 9.65,
    frequency: 'ปีละ 4 ครั้ง (รายไตรมาส)',
    payoutRatio: 95.0,
    lastXdDate: '2026-08-14',
    nextXdDate: 'พ.ย. 2026 (ไตรมาส 3)',
    safetyScore: 84,
    bucket: 'REIT & Property Fund',
    highlight: 'สัญญาเช่าระยะยาวกับ TRUE กระแสเงินสดเสมือนพันธบัตร Yield สูงเกือบสองหลัก',
  },
  {
    symbol: 'CPNREIT',
    name: 'ทรัสต์เพื่อการลงทุนในสิทธิการเช่าอสังหาริมทรัพย์ CPN รีเทล',
    sector: 'REIT',
    price: 11.30,
    annualDividend: 1.05,
    yieldPct: 9.29,
    frequency: 'ปีละ 4 ครั้ง (รายไตรมาส)',
    payoutRatio: 90.0,
    lastXdDate: '2026-08-20',
    nextXdDate: 'พ.ย. 2026 (ไตรมาส 3)',
    safetyScore: 89,
    bucket: 'REIT & Property Fund',
    highlight: 'สิทธิ์เช่าห้างเซ็นทรัลทำเลทอง Traffic หนาแน่น ปรับค่าเช่าตามเงินเฟ้อได้ดี',
  },
];

// ─── Core Featured DR Universe with Underlying References ────────────────────

export const FEATURED_DR_UNIVERSE = [
  {
    symbol: 'AAPL80',
    name: 'Apple Inc. DR',
    underlying: 'AAPL',
    underlyingUsd: 342.94,
    conversionRatio: 1000, // 1000 AAPL80 = 1 AAPL Share
    currentDrPrice: 11.50,
    changePct: 0.87,
    closes: [11.2, 11.4, 11.3, 11.0, 11.2, 11.2, 11.2, 11.3, 11.3, 11.4, 11.2, 11.3, 11.6, 11.5, 11.5],
    highs: [11.3, 11.5, 11.4, 11.2, 11.3, 11.3, 11.3, 11.4, 11.4, 11.5, 11.3, 11.4, 11.7, 11.6, 11.6],
    lows: [11.0, 11.2, 11.1, 10.9, 11.1, 11.1, 11.1, 11.2, 11.2, 11.3, 11.1, 11.2, 11.4, 11.4, 11.4],
  },
  {
    symbol: 'NVDA80',
    name: 'NVIDIA Corp. DR',
    underlying: 'NVDA',
    underlyingUsd: 180.50,
    conversionRatio: 160,
    currentDrPrice: 36.50,
    changePct: 0.00,
    closes: [35.0, 35.5, 36.0, 36.2, 35.8, 36.4, 36.8, 36.2, 36.0, 36.5, 36.8, 36.2, 36.5, 36.5, 36.5],
    highs: [35.5, 36.0, 36.5, 36.8, 36.2, 37.0, 37.2, 36.8, 36.5, 37.0, 37.2, 36.8, 37.0, 37.0, 37.0],
    lows: [34.5, 35.0, 35.5, 35.8, 35.2, 36.0, 36.2, 35.8, 35.5, 36.0, 36.2, 35.8, 36.0, 36.0, 36.0],
  },
  {
    symbol: 'MSFT80',
    name: 'Microsoft Corp. DR',
    underlying: 'MSFT',
    underlyingUsd: 422.50,
    conversionRatio: 1500,
    currentDrPrice: 8.95,
    changePct: 0.56,
    closes: [8.7, 8.8, 8.85, 8.9, 8.8, 8.95, 9.0, 8.9, 8.95, 9.0, 8.9, 8.92, 8.95, 8.95, 8.95],
    highs: [8.8, 8.9, 8.95, 9.0, 8.9, 9.05, 9.1, 9.0, 9.05, 9.1, 9.0, 9.02, 9.05, 9.05, 9.05],
    lows: [8.6, 8.7, 8.75, 8.8, 8.7, 8.85, 8.9, 8.8, 8.85, 8.9, 8.8, 8.82, 8.85, 8.85, 8.85],
  },
  {
    symbol: 'TSLA80',
    name: 'Tesla Inc. DR',
    underlying: 'TSLA',
    underlyingUsd: 240.20,
    conversionRatio: 3000,
    currentDrPrice: 2.48,
    changePct: 3.33,
    closes: [2.35, 2.38, 2.4, 2.36, 2.34, 2.38, 2.42, 2.39, 2.4, 2.44, 2.41, 2.43, 2.45, 2.48, 2.48],
    highs: [2.4, 2.42, 2.45, 2.4, 2.38, 2.44, 2.48, 2.45, 2.45, 2.5, 2.46, 2.48, 2.5, 2.52, 2.52],
    lows: [2.3, 2.34, 2.36, 2.32, 2.3, 2.34, 2.38, 2.35, 2.36, 2.4, 2.37, 2.39, 2.4, 2.44, 2.44],
  },
  {
    symbol: 'BABA80',
    name: 'Alibaba Group DR',
    underlying: 'BABA',
    underlyingUsd: 104.50,
    conversionRatio: 800,
    currentDrPrice: 4.52,
    changePct: -2.16,
    closes: [4.4, 4.45, 4.5, 4.55, 4.5, 4.58, 4.62, 4.58, 4.6, 4.65, 4.6, 4.58, 4.62, 4.52, 4.52],
    highs: [4.45, 4.5, 4.55, 4.6, 4.55, 4.65, 4.7, 4.65, 4.68, 4.72, 4.68, 4.65, 4.7, 4.6, 4.6],
    lows: [4.35, 4.4, 4.45, 4.5, 4.45, 4.52, 4.58, 4.52, 4.55, 4.58, 4.55, 4.52, 4.55, 4.48, 4.48],
  },
  {
    symbol: 'TENCENT80',
    name: 'Tencent Holdings DR',
    underlying: '0700.HK',
    underlyingUsd: 54.00,
    conversionRatio: 100,
    currentDrPrice: 17.70,
    changePct: -2.75,
    closes: [17.5, 17.8, 18.0, 18.2, 18.0, 18.4, 18.6, 18.2, 18.4, 18.5, 18.1, 18.2, 18.0, 17.7, 17.7],
    highs: [17.8, 18.2, 18.4, 18.6, 18.3, 18.8, 19.0, 18.6, 18.8, 18.9, 18.5, 18.6, 18.4, 18.0, 18.0],
    lows: [17.2, 17.5, 17.6, 17.8, 17.6, 18.0, 18.2, 17.8, 18.0, 18.1, 17.8, 17.8, 17.6, 17.4, 17.4],
  },
];

// ─── Featured Thai Equities Universe (SET100 / SETHD) ─────────────────────────

export const FEATURED_THAI_STOCK_UNIVERSE = [
  {
    symbol: 'CPALL',
    name: 'บมจ.ซีพี ออลล์',
    sector: 'Commerce & Retail',
    currentPrice: 43.50,
    changePct: 0.00,
    market: 'SET',
    closes: [44.0, 43.75, 43.75, 42.5, 42.25, 43.0, 43.0, 42.5, 42.5, 42.5, 43.0, 43.0, 43.0, 43.5, 43.5],
    highs: [44.5, 44.0, 44.0, 43.0, 43.0, 43.5, 43.5, 43.0, 43.0, 43.0, 43.5, 43.5, 43.5, 44.0, 44.0],
    lows: [43.5, 43.25, 43.25, 42.0, 42.0, 42.5, 42.5, 42.0, 42.0, 42.0, 42.5, 42.5, 42.5, 43.0, 43.0],
  },
  {
    symbol: 'BDMS',
    name: 'บมจ.กรุงเทพดุสิตเวชการ',
    sector: 'Healthcare & Hospital',
    currentPrice: 19.10,
    changePct: 0.52,
    market: 'SET',
    closes: [18.8, 18.9, 19.0, 19.1, 18.9, 19.2, 19.3, 19.0, 19.1, 19.2, 19.0, 19.1, 19.0, 19.1, 19.1],
    highs: [19.0, 19.1, 19.2, 19.3, 19.1, 19.4, 19.5, 19.2, 19.3, 19.4, 19.2, 19.3, 19.2, 19.3, 19.3],
    lows: [18.6, 18.7, 18.8, 18.9, 18.7, 19.0, 19.1, 18.8, 18.9, 19.0, 18.8, 18.9, 18.8, 18.9, 18.9],
  },
  {
    symbol: 'ADVANC',
    name: 'บมจ.แอดวานซ์ อินโฟร์ เซอร์วิส',
    sector: 'Telecom & Tech',
    currentPrice: 334.00,
    changePct: -0.60,
    market: 'SET',
    closes: [328.0, 330.0, 332.0, 335.0, 333.0, 336.0, 338.0, 335.0, 336.0, 338.0, 335.0, 336.0, 335.0, 334.0, 334.0],
    highs: [330.0, 332.0, 335.0, 338.0, 335.0, 338.0, 340.0, 338.0, 338.0, 340.0, 338.0, 338.0, 337.0, 336.0, 336.0],
    lows: [325.0, 328.0, 330.0, 332.0, 330.0, 333.0, 335.0, 332.0, 333.0, 335.0, 332.0, 333.0, 332.0, 332.0, 332.0],
  },
  {
    symbol: 'GULF',
    name: 'บมจ.กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์',
    sector: 'Energy & Utilities',
    currentPrice: 61.50,
    changePct: 0.82,
    market: 'SET',
    closes: [59.0, 59.5, 60.0, 60.5, 60.25, 61.0, 61.5, 61.0, 61.25, 61.5, 61.0, 61.25, 61.0, 61.5, 61.5],
    highs: [59.5, 60.0, 60.5, 61.0, 60.75, 61.5, 62.0, 61.5, 61.75, 62.0, 61.5, 61.75, 61.5, 62.0, 62.0],
    lows: [58.5, 59.0, 59.5, 60.0, 59.75, 60.5, 61.0, 60.5, 60.75, 61.0, 60.5, 60.75, 60.5, 61.0, 61.0],
  },
  {
    symbol: 'PTT',
    name: 'บมจ.ปตท.',
    sector: 'Energy & Utilities',
    currentPrice: 41.00,
    changePct: 0.00,
    market: 'SET',
    closes: [40.0, 40.25, 40.5, 40.75, 40.5, 41.0, 41.25, 41.0, 41.0, 41.25, 41.0, 41.0, 41.0, 41.0, 41.0],
    highs: [40.25, 40.5, 40.75, 41.0, 40.75, 41.25, 41.5, 41.25, 41.25, 41.5, 41.25, 41.25, 41.25, 41.25, 41.25],
    lows: [39.75, 40.0, 40.25, 40.5, 40.25, 40.75, 41.0, 40.75, 40.75, 41.0, 40.75, 40.75, 40.75, 40.75, 40.75],
  },
  {
    symbol: 'DELTA',
    name: 'บมจ.เดลต้า อีเลคโทรนิคส์ (ประเทศไทย)',
    sector: 'Tech & Electronics',
    currentPrice: 252.00,
    changePct: -0.79,
    market: 'SET',
    closes: [245.0, 248.0, 250.0, 255.0, 252.0, 256.0, 260.0, 255.0, 256.0, 258.0, 254.0, 255.0, 253.0, 252.0, 252.0],
    highs: [248.0, 252.0, 255.0, 258.0, 255.0, 260.0, 265.0, 260.0, 260.0, 262.0, 258.0, 258.0, 256.0, 255.0, 255.0],
    lows: [242.0, 245.0, 248.0, 250.0, 248.0, 252.0, 255.0, 250.0, 252.0, 254.0, 250.0, 251.0, 250.0, 250.0, 250.0],
  },
  {
    symbol: 'KBANK',
    name: 'ธนาคารกสิกรไทย',
    sector: 'Banking & Financials',
    currentPrice: 237.00,
    changePct: 0.00,
    market: 'SET',
    closes: [230.0, 232.0, 234.0, 236.0, 235.0, 238.0, 240.0, 236.0, 237.0, 239.0, 236.0, 237.0, 236.0, 237.0, 237.0],
    highs: [232.0, 235.0, 236.0, 238.0, 237.0, 240.0, 242.0, 239.0, 239.0, 241.0, 238.0, 239.0, 238.0, 238.0, 238.0],
    lows: [228.0, 230.0, 232.0, 234.0, 233.0, 236.0, 237.0, 234.0, 235.0, 236.0, 234.0, 235.0, 234.0, 235.0, 235.0],
  },
  {
    symbol: 'SCB',
    name: 'บมจ.เอสซีบี เอกซ์',
    sector: 'Banking & Financials',
    currentPrice: 147.00,
    changePct: 0.00,
    market: 'SET',
    closes: [142.0, 143.5, 145.0, 146.0, 145.0, 147.0, 148.5, 146.0, 146.5, 148.0, 146.5, 147.0, 146.5, 147.0, 147.0],
    highs: [144.0, 145.0, 146.5, 148.0, 147.0, 149.0, 150.0, 148.0, 148.0, 149.5, 148.0, 148.5, 148.0, 148.0, 148.0],
    lows: [140.0, 142.0, 143.5, 144.5, 143.5, 145.5, 147.0, 144.5, 145.0, 146.0, 145.0, 145.5, 145.0, 145.5, 145.5],
  },
];

// ─── Morning Signal Audio Speech Generator ────────────────────────────────────

export function generateMorningSignalSpeech({ thaiPicks = [], drPicks = [] }) {
  const parts = ['สวัสดีครับ สรุปสัญญาณสแกนตลาดเช้าวันนี้จากน้องนักออม'];

  if (thaiPicks.length > 0) {
    const topThai = thaiPicks.slice(0, 2);
    parts.push(`หุ้นไทยที่น่าจับตา ${topThai.length} ตัว`);
    for (const p of topThai) {
      parts.push(
        `${p.symbol} ราคาเข้า ${p.entry.toFixed(2)} บาท เป้าหมายทำกำไร ${p.tp1.toFixed(2)} บาท ตัดขาดทุน ${p.sl.toFixed(2)} บาท สถานะ ${p.status || 'อยู่ในโซนซื้อ'}`
      );
    }
  }

  if (drPicks.length > 0) {
    const topDr = drPicks.slice(0, 2);
    parts.push(`สำหรับ ตราสาร DR ต่างประเทศเด่น ${topDr.length} ตัว`);
    for (const p of topDr) {
      parts.push(
        `${p.symbol} ราคาเข้า ${p.entry.toFixed(2)} บาท เป้าหมายทำกำไร ${p.tp1.toFixed(2)} บาท ตัดขาดทุน ${p.sl.toFixed(2)} บาท สถานะ ${p.status || 'อยู่ในโซนซื้อ'}`
      );
    }
  }

  parts.push('ขอให้การเทรดวันนี้มีวินัยและรักษาระดับความเสี่ยงตามแผนครับ');
  return parts.join('. ');
}

