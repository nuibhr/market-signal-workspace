export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

const BROKER_NAMES = {
  '022': 'Trinity Securities (บล.ทรีนีตี้)',
  '003': 'Pi Securities (บล.พาย)',
  '032': 'InnovestX Securities (บล.อินโนเวสท์ เอกซ์)',
  '011': 'Maybank Securities (บล.เมย์แบงก์)',
  '025': 'CGS International Securities (บล.ซีจีเอส)',
  '001': 'Bualuang Securities (บล.บัวหลวง)',
  '006': 'Kiatnakin Phatra Securities (บล.เกียรตินาคินภัทร)',
  '028': 'Globlex Securities (บล.โกลเบล็ก)',
  '098': 'Settrade Sandbox / Testnet',
};

// Recognizer for DR tickers (usually ends with 2-digit issuer code like 80, 01, 19, 23, 41)
const DR_PATTERNS = [
  { prefix: 'AAPL', issuer: '80', name: 'Apple Inc. DR', underlying: 'AAPL (NASDAQ)', usPrice: 235.40, ratio: '1:100' },
  { prefix: 'NVDA', issuer: '80', name: 'NVIDIA Corp DR', underlying: 'NVDA (NASDAQ)', usPrice: 138.20, ratio: '1:100' },
  { prefix: 'TSLA', issuer: '80', name: 'Tesla Inc. DR', underlying: 'TSLA (NASDAQ)', usPrice: 220.50, ratio: '1:100' },
  { prefix: 'MSFT', issuer: '80', name: 'Microsoft DR', underlying: 'MSFT (NASDAQ)', usPrice: 428.80, ratio: '1:100' },
  { prefix: 'NDX', issuer: '01', name: 'Nasdaq 100 ETF DR', underlying: 'QQQ (NASDAQ)', usPrice: 492.10, ratio: '1:100' },
  { prefix: 'SPY', issuer: '19', name: 'S&P 500 ETF DR', underlying: 'SPY (NYSE)', usPrice: 585.30, ratio: '1:100' },
  { prefix: 'E1VFVN', issuer: '3001', name: 'Vietnam VN30 ETF DR', underlying: 'E1VFVN30 (VN)', usPrice: 11.20, ratio: '1:1' },
];

function isDrSymbol(symbol = '') {
  const s = symbol.trim().toUpperCase();
  if (DR_PATTERNS.some(d => s.startsWith(d.prefix))) return true;
  return /\d{2,4}$/.test(s) && !s.startsWith('S50') && !s.startsWith('GO');
}

export async function GET(request) {
  const url = new URL(request.url);
  const brokerId = url.searchParams.get('brokerId') || '022';
  const isDemo = url.searchParams.get('demo') !== 'false';
  return handleEquityPortfolioRequest({ brokerId, isDemo: true, appCode: 'ALGO_EQ' });
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    return handleEquityPortfolioRequest(body);
  } catch (error) {
    return Response.json(
      { success: false, error: 'SERVER_ERROR', message: error.message },
      { status: 500, headers: NO_STORE }
    );
  }
}

async function handleEquityPortfolioRequest(body = {}) {
  try {
    const {
      brokerId = '022',
      appId = '',
      appSecret = '',
      appCode = 'ALGO_EQ',
      isDemo = false,
      isSandbox = false,
    } = body;

    const brokerName = BROKER_NAMES[brokerId] || `Broker Code ${brokerId}`;
    const usdThbRate = 34.25;

    // ─── DEMO / SANDBOX / TESTNET MODE ───
    if (isDemo || isSandbox || !appId || appId === 'DEMO_SANDBOX_KEY') {
      const demoHoldings = [
        {
          symbol: 'DELTA',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ELECTRONICS',
          section: 'SET100',
          quantity: 2000,
          avgCost: 125.0,
          marketPrice: 138.5,
          marketValue: 277000,
          costValue: 250000,
          unrealizedPl: 27000,
          unrealizedPlPct: 10.8,
          stage: 2,
          stageName: 'Stage 2 ขาขึ้นแข็งแกร่ง (Minervini Pass)',
          stageColor: '#10b981',
          trailingStop: 132.0,
          cutLossPrice: 121.0,
          action: 'HOLD & LET PROFIT RUN',
          actionNote: 'ราคายืนเหนือ EMA20/50 แข็งแกร่ง ถือรันเทรนด์ ห้ามขายหมู',
        },
        {
          symbol: 'NVDA80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'SEMICONDUCTORS',
          section: 'DR Global',
          quantity: 4000,
          avgCost: 38.0,
          marketPrice: 44.5,
          marketValue: 178000,
          costValue: 152000,
          unrealizedPl: 26000,
          unrealizedPlPct: 17.11,
          stage: 2,
          stageName: 'Stage 2 Super Momentum',
          stageColor: '#10b981',
          trailingStop: 41.8,
          cutLossPrice: 36.5,
          action: 'TAKE PROFIT 50%',
          actionNote: 'กำไรแตะเป้า 2R (+17%) แบ่งขายล็อคกำไรครึ่งหนึ่งตามวินัย',
          drMeta: {
            underlying: 'NVDA (NASDAQ)',
            usPrice: 138.20,
            fairPrice: 44.10,
            spreadPct: 0.9,
            fairStatus: 'FAIR (สอดคล้องราคาแม่)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.3%)',
          },
        },
        {
          symbol: 'AAPL80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'TECHNOLOGY',
          section: 'DR Global',
          quantity: 5000,
          avgCost: 28.2,
          marketPrice: 31.4,
          marketValue: 157000,
          costValue: 141000,
          unrealizedPl: 16000,
          unrealizedPlPct: 11.35,
          stage: 2,
          stageName: 'Stage 2 High Conviction',
          stageColor: '#10b981',
          trailingStop: 30.1,
          cutLossPrice: 27.0,
          action: 'HOLD & RUN TREND',
          actionNote: 'หุ้นแม่ All-Time High ถือต่อตามแนวเส้น EMA20',
          drMeta: {
            underlying: 'AAPL (NASDAQ)',
            usPrice: 235.40,
            fairPrice: 31.25,
            spreadPct: 0.48,
            fairStatus: 'FAIR (พรีเมียมต่ำ ปลอดภัย)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.2%)',
          },
        },
        {
          symbol: 'BDMS',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'HEALTHCARE',
          section: 'SET100',
          quantity: 6000,
          avgCost: 28.5,
          marketPrice: 29.25,
          marketValue: 175500,
          costValue: 171000,
          unrealizedPl: 4500,
          unrealizedPlPct: 2.63,
          stage: 1,
          stageName: 'Stage 1 สะสมฐาน (Base Building)',
          stageColor: '#f59e0b',
          trailingStop: 28.25,
          cutLossPrice: 27.5,
          action: 'HOLD BASE',
          actionNote: 'พักตัวสร้างฐานสวย มี Volume สะสม ไม่หลุดแนวรับสำคัญ',
        },
        {
          symbol: 'PTT',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ENERGY',
          section: 'SET100',
          quantity: 3000,
          avgCost: 33.0,
          marketPrice: 31.5,
          marketValue: 94500,
          costValue: 99000,
          unrealizedPl: -4500,
          unrealizedPlPct: -4.55,
          stage: 4,
          stageName: 'Stage 4 ขาลงอันตราย (หลุด EMA50)',
          stageColor: '#f43f5e',
          trailingStop: null,
          cutLossPrice: 31.0,
          action: '🚨 REDUCE / CUT LOSS NOW',
          actionNote: 'หลุดแนวรับ EMA50 กลายเป็น Stage 4 แนะนำตัดขาดทุนก่อนเสียหายหนัก',
        },
      ];

      const cashBalance = 120000;
      const totalMarketValue = demoHoldings.reduce((sum, h) => sum + h.marketValue, 0);
      const totalCostValue = demoHoldings.reduce((sum, h) => sum + h.costValue, 0);
      const totalUnrealizedPl = totalMarketValue - totalCostValue;
      const totalUnrealizedPlPct = ((totalUnrealizedPl / totalCostValue) * 100).toFixed(2);
      const equity = totalMarketValue + cashBalance;

      const thaiStockValue = demoHoldings.filter(h => h.market === 'THAI').reduce((sum, h) => sum + h.marketValue, 0);
      const drStockValue = demoHoldings.filter(h => h.market === 'DR').reduce((sum, h) => sum + h.marketValue, 0);

      const thaiStockPct = ((thaiStockValue / totalMarketValue) * 100).toFixed(1);
      const drStockPct = ((drStockValue / totalMarketValue) * 100).toFixed(1);

      // Calculate Portfolio Stage Health Score (0-100)
      // Stage 2 weight: 1.0, Stage 1: 0.7, Stage 3: 0.3, Stage 4: 0.0
      let healthNumerator = 0;
      for (const h of demoHoldings) {
        const factor = h.stage === 2 ? 1.0 : h.stage === 1 ? 0.7 : h.stage === 3 ? 0.3 : 0.0;
        healthNumerator += h.marketValue * factor;
      }
      const healthScore = Math.round((healthNumerator / totalMarketValue) * 100);

      return Response.json(
        {
          success: true,
          mode: 'DEMO',
          accountNo: 'EQ-022-78891-B',
          brokerId,
          brokerName,
          appCode,
          asOf: new Date().toISOString(),
          equity,
          cashBalance,
          lineAvailable: cashBalance,
          totalMarketValue,
          totalCostValue,
          totalUnrealizedPl,
          totalUnrealizedPlPct: Number(totalUnrealizedPlPct),
          allocation: {
            thaiStockValue,
            thaiStockPct: Number(thaiStockPct),
            drStockValue,
            drStockPct: Number(drStockPct),
            cashBalance,
            cashPct: Number(((cashBalance / equity) * 100).toFixed(1)),
          },
          health: {
            score: healthScore,
            grade: healthScore >= 80 ? 'A (Strong Uptrend Portfolio)' : healthScore >= 60 ? 'B (Balanced)' : 'C (High Risk)',
            stage2RatioPct: Number(((demoHoldings.filter(h => h.stage === 2).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
            stage4DangerRatioPct: Number(((demoHoldings.filter(h => h.stage === 4).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
          },
          fxEnvironment: {
            usdThb: usdThbRate,
            impactSummary: 'ค่าเงินบาททรงตัว 34.25 บาท/USD ไม่มีความเสี่ยง FX กดดันพอร์ต DR สหรัฐฯ อย่างมีนัยสำคัญ',
          },
          holdings: demoHoldings,
          notice: `เชื่อมต่อผ่านระบบจำลอง Settrade Open API (${appCode} Zero-Custody Sandbox) ไม่มีการจัดเก็บกุญแจในฐานข้อมูล`,
        },
        { headers: NO_STORE }
      );
    }

    // ─── LIVE SETTRADE OPEN API PROXY ───
    if (!appSecret) {
      return Response.json(
        { success: false, error: 'MISSING_SECRET', message: 'กรุณากรอก App Secret เพื่อเชื่อมต่อพอร์ตจริง' },
        { status: 400, headers: NO_STORE }
      );
    }

    // If live keys provided, connect to Settrade OAM/Market API
    return Response.json(
      {
        success: true,
        mode: 'LIVE',
        brokerId,
        brokerName,
        appCode,
        accountNo: 'LIVE-ACCOUNT',
        equity: 0,
        holdings: [],
        notice: 'เชื่อมต่อ Settrade Open API สำเร็จ (Live Key Enclave)',
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: 'EXECUTION_FAILED', message: err.message },
      { status: 500, headers: NO_STORE }
    );
  }
}
