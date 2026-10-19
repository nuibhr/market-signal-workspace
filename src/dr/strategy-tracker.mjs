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

  let camScore = 0;
  if (currentPrice > cam.pivot) camScore++;
  if (currentPrice >= cam.S3 && currentPrice <= cam.R3) camScore++;
  if (currentPrice >= cam.S2 && currentPrice <= cam.S3) camScore += 2;

  // Entry Plan
  const plan = chooseEntryPlan({ currentPrice, ema25: ema25 ?? currentPrice, camarilla: cam, effectiveAtr });

  // Total Score (Max 16)
  const emaContrib = emaScore >= 1 ? emaScore * 2 : 0;
  const totalScore = emaContrib + camScore * 2 + rsiScore + macdScore;

  // Thai Reasons
  const reasons = [];
  if (emaAligned) reasons.push('EMA 25/50/75 เรียงตัวขึ้น');
  else if (emaScore >= 2) reasons.push('EMA เริ่มเรียงตัวขึ้น');
  if (rsi >= 40 && rsi <= 60) reasons.push(`RSI ${rsi.toFixed(1)} อยู่ในโซนดี`);
  else if (rsi < 40) reasons.push(`RSI ${rsi.toFixed(1)} ใกล้ oversold`);
  if (histogram > 0) reasons.push('MACD momentum เป็นบวก');
  if (camScore >= 2) reasons.push('ราคาใกล้ Camarilla S3 (Buy Zone)');
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
    underlyingUsd: 235.40,
    conversionRatio: 100, // 100 DR80 = 1 AAPL Share
    currentDrPrice: 81.25,
    changePct: 1.25,
    closes: [77.5, 78.0, 78.5, 79.2, 79.0, 79.8, 80.2, 80.0, 80.5, 80.8, 81.0, 80.5, 80.8, 81.25],
    highs: [78.0, 78.6, 79.0, 79.5, 79.8, 80.4, 80.8, 80.5, 81.0, 81.5, 81.8, 81.2, 81.6, 81.90],
    lows: [77.0, 77.5, 78.0, 78.5, 78.8, 79.2, 79.5, 79.8, 80.0, 80.2, 80.5, 80.0, 80.3, 80.75],
  },
  {
    symbol: 'NVDA80',
    name: 'NVIDIA Corp. DR',
    underlying: 'NVDA',
    underlyingUsd: 138.80,
    conversionRatio: 100,
    currentDrPrice: 47.90,
    changePct: 2.85,
    closes: [43.2, 43.8, 44.5, 45.0, 44.8, 45.5, 46.2, 45.9, 46.8, 47.1, 46.8, 47.2, 47.5, 47.90],
    highs: [44.0, 44.5, 45.2, 45.6, 45.5, 46.2, 46.8, 46.5, 47.3, 47.8, 47.5, 47.9, 48.2, 48.50],
    lows: [42.8, 43.2, 44.0, 44.2, 44.1, 44.8, 45.4, 45.2, 46.0, 46.5, 46.2, 46.6, 47.0, 47.25],
  },
  {
    symbol: 'MSFT80',
    name: 'Microsoft Corp. DR',
    underlying: 'MSFT',
    underlyingUsd: 422.50,
    conversionRatio: 100,
    currentDrPrice: 145.75,
    changePct: 0.65,
    closes: [141.0, 141.8, 142.5, 143.0, 142.8, 143.5, 144.0, 144.5, 144.2, 145.0, 145.2, 144.8, 145.1, 145.75],
    highs: [142.0, 142.5, 143.2, 143.8, 143.5, 144.2, 144.8, 145.2, 145.0, 145.8, 146.0, 145.5, 145.9, 146.40],
    lows: [140.5, 141.2, 141.8, 142.2, 142.0, 142.8, 143.2, 143.8, 143.6, 144.2, 144.5, 144.0, 144.4, 145.00],
  },
  {
    symbol: 'TSLA80',
    name: 'Tesla Inc. DR',
    underlying: 'TSLA',
    underlyingUsd: 220.80,
    conversionRatio: 100,
    currentDrPrice: 76.20,
    changePct: -1.15,
    closes: [78.5, 79.2, 78.8, 78.0, 77.5, 76.8, 77.2, 76.5, 77.0, 76.8, 77.4, 76.9, 76.5, 76.20],
    highs: [79.5, 80.0, 79.5, 78.8, 78.2, 77.8, 78.0, 77.4, 77.8, 77.5, 78.2, 77.6, 77.2, 76.90],
    lows: [78.0, 78.5, 77.8, 77.2, 76.8, 76.0, 76.5, 75.8, 76.2, 76.0, 76.6, 76.1, 75.8, 75.50],
  },
  {
    symbol: 'BABA80',
    name: 'Alibaba Group DR',
    underlying: 'BABA',
    underlyingUsd: 104.50,
    conversionRatio: 100,
    currentDrPrice: 35.80,
    changePct: 3.45,
    closes: [31.5, 32.0, 32.8, 33.2, 33.0, 33.8, 34.2, 34.0, 34.6, 35.0, 34.8, 35.2, 35.4, 35.80],
    highs: [32.2, 32.8, 33.4, 33.8, 33.6, 34.4, 34.8, 34.5, 35.2, 35.6, 35.4, 35.8, 36.0, 36.40],
    lows: [31.0, 31.5, 32.2, 32.5, 32.4, 33.1, 33.6, 33.4, 34.0, 34.4, 34.2, 34.6, 34.9, 35.20],
  },
  {
    symbol: 'TENCENT80',
    name: 'Tencent Holdings DR',
    underlying: '0700.HK',
    underlyingUsd: 55.60,
    conversionRatio: 50,
    currentDrPrice: 38.40,
    changePct: 1.85,
    closes: [35.2, 35.8, 36.2, 36.5, 36.4, 37.0, 37.4, 37.2, 37.8, 38.0, 37.8, 38.1, 38.2, 38.40],
    highs: [35.8, 36.4, 36.8, 37.1, 37.0, 37.6, 38.0, 37.7, 38.4, 38.6, 38.3, 38.6, 38.8, 39.00],
    lows: [34.8, 35.2, 35.6, 36.0, 35.9, 36.4, 36.8, 36.6, 37.2, 37.4, 37.1, 37.5, 37.7, 37.90],
  },
];

// ─── Featured Thai Equities Universe (SET100 / SETHD) ─────────────────────────

export const FEATURED_THAI_STOCK_UNIVERSE = [
  {
    symbol: 'CPALL',
    name: 'บมจ.ซีพี ออลล์',
    sector: 'Commerce & Retail',
    currentPrice: 64.75,
    changePct: 1.17,
    market: 'SET',
    closes: [61.0, 61.5, 62.0, 62.8, 62.5, 63.2, 63.8, 63.5, 64.0, 64.5, 64.2, 64.5, 64.4, 64.75],
    highs: [61.5, 62.0, 62.5, 63.2, 63.0, 63.8, 64.2, 64.0, 64.6, 65.0, 64.8, 65.0, 64.9, 65.25],
    lows: [60.5, 61.0, 61.5, 62.0, 62.0, 62.6, 63.2, 63.0, 63.5, 63.8, 63.6, 64.0, 63.8, 64.25],
  },
  {
    symbol: 'BDMS',
    name: 'บมจ.กรุงเทพดุสิตเวชการ',
    sector: 'Healthcare & Hospital',
    currentPrice: 28.50,
    changePct: 1.79,
    market: 'SET',
    closes: [26.5, 26.8, 27.2, 27.5, 27.2, 27.8, 28.1, 27.9, 28.2, 28.4, 28.1, 28.3, 28.2, 28.50],
    highs: [26.8, 27.2, 27.6, 27.8, 27.6, 28.2, 28.5, 28.3, 28.6, 28.8, 28.5, 28.7, 28.6, 28.90],
    lows: [26.2, 26.5, 26.8, 27.1, 27.0, 27.5, 27.8, 27.6, 27.9, 28.0, 27.8, 28.0, 27.9, 28.20],
  },
  {
    symbol: 'ADVANC',
    name: 'บมจ.แอดวานซ์ อินโฟร์ เซอร์วิส',
    sector: 'Telecom & Tech',
    currentPrice: 278.00,
    changePct: 0.72,
    market: 'SET',
    closes: [268.0, 270.0, 272.0, 274.0, 273.0, 275.0, 276.5, 275.0, 277.0, 278.5, 277.0, 277.5, 277.0, 278.00],
    highs: [270.0, 272.0, 275.0, 276.0, 275.0, 277.0, 279.0, 277.5, 279.5, 281.0, 279.0, 280.0, 279.0, 280.50],
    lows: [266.0, 268.0, 270.0, 272.0, 271.0, 273.0, 274.5, 273.5, 275.0, 276.0, 275.0, 275.5, 275.0, 276.00],
  },
  {
    symbol: 'GULF',
    name: 'บมจ.กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์',
    sector: 'Energy & Utilities',
    currentPrice: 65.50,
    changePct: 2.34,
    market: 'SET',
    closes: [60.5, 61.2, 62.0, 62.8, 62.5, 63.4, 64.0, 63.8, 64.5, 65.0, 64.6, 64.9, 64.8, 65.50],
    highs: [61.2, 62.0, 62.8, 63.4, 63.2, 64.2, 64.8, 64.5, 65.2, 65.8, 65.2, 65.5, 65.4, 66.00],
    lows: [60.0, 60.8, 61.5, 62.0, 62.0, 62.8, 63.4, 63.2, 63.8, 64.2, 64.0, 64.2, 64.0, 64.80],
  },
  {
    symbol: 'PTT',
    name: 'บมจ.ปตท.',
    sector: 'Energy & Utilities',
    currentPrice: 34.00,
    changePct: 0.74,
    market: 'SET',
    closes: [32.5, 32.8, 33.0, 33.5, 33.2, 33.6, 33.8, 33.5, 33.8, 34.0, 33.8, 33.9, 33.8, 34.00],
    highs: [32.8, 33.2, 33.5, 33.8, 33.6, 34.0, 34.2, 33.9, 34.2, 34.4, 34.1, 34.2, 34.1, 34.30],
    lows: [32.2, 32.5, 32.8, 33.0, 33.0, 33.2, 33.5, 33.2, 33.5, 33.6, 33.5, 33.6, 33.5, 33.70],
  },
  {
    symbol: 'DELTA',
    name: 'บมจ.เดลต้า อีเลคโทรนิคส์ (ประเทศไทย)',
    sector: 'Tech & Electronics',
    currentPrice: 128.50,
    changePct: 3.21,
    market: 'SET',
    closes: [118.0, 120.0, 122.5, 124.0, 123.0, 125.0, 126.8, 125.5, 127.0, 128.2, 126.5, 127.8, 127.0, 128.50],
    highs: [120.0, 122.5, 125.0, 126.5, 125.0, 127.5, 129.0, 127.5, 129.5, 131.0, 128.5, 130.0, 129.0, 131.00],
    lows: [116.5, 118.5, 120.5, 122.0, 121.5, 123.5, 125.0, 124.0, 125.5, 126.5, 125.0, 126.0, 125.5, 126.80],
  },
  {
    symbol: 'KBANK',
    name: 'ธนาคารกสิกรไทย',
    sector: 'Banking & Financials',
    currentPrice: 152.00,
    changePct: 1.00,
    market: 'SET',
    closes: [146.0, 147.5, 148.5, 150.0, 149.0, 150.5, 151.8, 150.5, 151.5, 152.5, 151.0, 151.8, 151.2, 152.00],
    highs: [148.0, 149.5, 150.5, 152.0, 151.0, 152.5, 153.5, 152.0, 153.5, 154.5, 153.0, 153.5, 153.0, 154.00],
    lows: [145.0, 146.5, 147.5, 148.5, 148.0, 149.0, 150.2, 149.5, 150.2, 151.0, 150.0, 150.5, 150.0, 151.00],
  },
  {
    symbol: 'SCB',
    name: 'บมจ.เอสซีบี เอกซ์',
    sector: 'Banking & Financials',
    currentPrice: 114.50,
    changePct: 1.33,
    market: 'SET',
    closes: [109.5, 110.8, 112.0, 113.2, 112.5, 113.5, 114.2, 113.5, 114.0, 114.8, 113.8, 114.2, 113.9, 114.50],
    highs: [111.0, 112.2, 113.5, 114.5, 114.0, 115.0, 115.8, 114.8, 115.5, 116.2, 115.0, 115.5, 115.0, 116.00],
    lows: [108.5, 109.8, 111.0, 112.0, 111.5, 112.5, 113.2, 112.5, 113.0, 113.6, 113.0, 113.2, 113.0, 113.80],
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

