import {requireDataOwner,requireOwnedBrokerAccount} from '../../../../market-data/contracts/v1/owner-server.mjs';
import { readBrokerPortfolio } from '../../../../market-data/broker-portfolio.mjs';
import { currentMember, sameOrigin } from '../../../../membership/server.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

const BROKER_NAMES = {
  '003': 'Pi Securities (บล.พาย)',
  '022': 'Trinity Securities (บล.ทรีนีตี้)',
};

function buildDemoPortfolio(brokerId = '022', appCode = 'ALGO_EQ') {
  const isPi = brokerId === '003';
  const brokerName = BROKER_NAMES[brokerId] || `Broker Code ${brokerId}`;
  const usdThbRate = 34.25;

  const demoHoldings = isPi
    ? [
        {
          symbol: 'DELTA',
          name: 'Delta Electronics (Thailand)',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ELECTRONICS',
          section: 'SET50',
          quantity: 1200,
          avgCost: 72.5,
          marketPrice: 84.0,
          marketValue: 100800,
          costValue: 87000,
          unrealizedPl: 13800,
          unrealizedPlPct: 15.86,
          stage: 2,
          stageName: 'Stage 2 ขาขึ้นแข็งแกร่ง (Uptrend Leader)',
          stageColor: '#10b981',
          trailingStop: 79.5,
          cutLossPrice: 69.5,
          action: 'HOLD & LET PROFIT RUN',
          actionNote: 'ราคายกไฮยกโลว์เหนือ EMA20 รันกำไรตาม Trailing Stop',
        },
        {
          symbol: 'NVDA80',
          name: 'NVIDIA DR (US Underlying)',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'SEMICONDUCTORS',
          section: 'DR Global',
          quantity: 2500,
          avgCost: 48.0,
          marketPrice: 54.5,
          marketValue: 136250,
          costValue: 120000,
          unrealizedPl: 16250,
          unrealizedPlPct: 13.54,
          stage: 2,
          stageName: 'Stage 2 (Global Tech Leader)',
          stageColor: '#10b981',
          trailingStop: 51.5,
          cutLossPrice: 46.0,
          action: 'HOLD & RUN TREND',
          actionNote: 'หุ้นแม่สหรัฐฯ ทำ ATH ค่าเงินบาททรงตัว ไม่เสียเปรียบ FX',
          drMeta: {
            underlying: 'NVDA (NASDAQ)',
            usPrice: 141.5,
            fairPrice: 53.8,
            spreadPct: 1.3,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'GULF',
          name: 'Gulf Energy Development',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ENERGY',
          section: 'SET50',
          quantity: 3000,
          avgCost: 46.0,
          marketPrice: 48.75,
          marketValue: 146250,
          costValue: 138000,
          unrealizedPl: 8250,
          unrealizedPlPct: 5.98,
          stage: 2,
          stageName: 'Stage 2 (Base Breakout)',
          stageColor: '#10b981',
          trailingStop: 46.5,
          cutLossPrice: 44.0,
          action: 'HOLD & RUN TREND',
          actionNote: 'เบรกแนวต้าน 46.50 พร้อมวอลุ่ม ยืนเหนือแนวรับโครงสร้างหลักอย่างแข็งแกร่ง',
        },
        {
          symbol: 'SPY80',
          name: 'SPDR S&P 500 ETF DR',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'BROAD_MARKET',
          section: 'DR Global',
          quantity: 1500,
          avgCost: 19.5,
          marketPrice: 20.2,
          marketValue: 30300,
          costValue: 29250,
          unrealizedPl: 1050,
          unrealizedPlPct: 3.59,
          stage: 2,
          stageName: 'Stage 2 (Steady Up)',
          stageColor: '#10b981',
          trailingStop: 19.4,
          cutLossPrice: 18.8,
          action: 'HOLD (CORE GLOBAL)',
          actionNote: 'สเปรด Fair กระจายความเสี่ยงตลาดโลก',
          drMeta: {
            underlying: 'SPY (NYSE)',
            usPrice: 585.0,
            fairPrice: 20.15,
            spreadPct: 0.25,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'CPALL',
          name: 'CP ALL Public Company Limited',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'COMMERCE',
          section: 'SET50',
          quantity: 3500,
          avgCost: 65.5,
          marketPrice: 61.25,
          marketValue: 214375,
          costValue: 229250,
          unrealizedPl: -14875,
          unrealizedPlPct: -6.49,
          stage: 4,
          stageName: 'Stage 4 (Downtrend Risk)',
          stageColor: '#f43f5e',
          trailingStop: null,
          cutLossPrice: 62.0,
          action: '🚨 REDUCE / CUT LOSS NOW',
          actionNote: 'หลุดแนวรับโครงสร้างสำคัญ แนะนำลดพอร์ตเพื่อจำกัด Drawdown',
        },
      ]
    : [
        {
          symbol: 'DELTA',
          name: 'Delta Electronics (Thailand)',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ELECTRONICS',
          section: 'SET50',
          quantity: 1500,
          avgCost: 110.0,
          marketPrice: 135.5,
          marketValue: 203250,
          costValue: 165000,
          unrealizedPl: 38250,
          unrealizedPlPct: 23.18,
          stage: 2,
          stageName: 'Stage 2 ขาขึ้นแข็งแกร่ง (Trend Leader)',
          stageColor: '#10b981',
          trailingStop: 128.0,
          cutLossPrice: 121.0,
          action: 'HOLD & LET PROFIT RUN',
          actionNote: 'ราคายืนเหนือ EMA20/50 แข็งแกร่ง ถือรันเทรนด์ ห้ามขายหมู',
        },
        {
          symbol: 'NVDA80',
          name: 'NVIDIA DR (US Underlying)',
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
            usPrice: 138.2,
            fairPrice: 44.1,
            spreadPct: 0.9,
            fairStatus: 'FAIR (สอดคล้องราคาแม่)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.3%)',
          },
        },
        {
          symbol: 'AAPL80',
          name: 'Apple Inc. DR (US Underlying)',
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
            usPrice: 235.4,
            fairPrice: 31.25,
            spreadPct: 0.48,
            fairStatus: 'FAIR (พรีเมียมต่ำ ปลอดภัย)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.2%)',
          },
        },
        {
          symbol: 'BDMS',
          name: 'Bangkok Dusit Medical Services',
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
          name: 'PTT Public Company Limited',
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
          stageName: 'Stage 4 โครงสร้างขาลงอันตราย',
          stageColor: '#f43f5e',
          trailingStop: null,
          cutLossPrice: 31.0,
          action: '🚨 REDUCE / CUT LOSS NOW',
          actionNote: 'หลุดแนวรับโครงสร้างหลัก กลายเป็น Stage 4 แนะนำตัดขาดทุนก่อนเสียหายหนัก',
        },
      ];

  const cashBalance = 120000;
  const totalMarketValue = demoHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostValue = demoHoldings.reduce((sum, h) => sum + h.costValue, 0);
  const totalUnrealizedPl = totalMarketValue - totalCostValue;
  const totalUnrealizedPlPct = ((totalUnrealizedPl / totalCostValue) * 100).toFixed(2);
  const equity = totalMarketValue + cashBalance;

  const thaiStockValue = demoHoldings.filter((h) => h.market === 'THAI').reduce((sum, h) => sum + h.marketValue, 0);
  const drStockValue = demoHoldings.filter((h) => h.market === 'DR').reduce((sum, h) => sum + h.marketValue, 0);

  const thaiStockPct = ((thaiStockValue / totalMarketValue) * 100).toFixed(1);
  const drStockPct = ((drStockValue / totalMarketValue) * 100).toFixed(1);

  let healthNumerator = 0;
  for (const h of demoHoldings) {
    const factor = h.stage === 2 ? 1.0 : h.stage === 1 ? 0.7 : h.stage === 3 ? 0.3 : 0.0;
    healthNumerator += h.marketValue * factor;
  }
  const healthScore = Math.round((healthNumerator / totalMarketValue) * 100);

  return {
    success: true,
    mode: 'DEMO',
    accountNo: `EQ-${brokerId}-78891-B`,
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
      grade: healthScore >= 80 ? 'เกรด A (พอร์ตขาขึ้นแข็งแกร่ง)' : healthScore >= 60 ? 'เกรด B (สมดุลปานกลาง)' : 'เกรด C (ความเสี่ยงสูง)',
      stage2RatioPct: Number(((demoHoldings.filter((h) => h.stage === 2).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
      stage4DangerRatioPct: Number(((demoHoldings.filter((h) => h.stage === 4).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
    },
    fxEnvironment: {
      usdThb: usdThbRate,
      impactSummary: 'ค่าเงินบาททรงตัว 34.25 บาท/USD ไม่มีความเสี่ยง FX กดดันพอร์ต DR สหรัฐฯ อย่างมีนัยสำคัญ',
    },
    holdings: demoHoldings,
    notice: `เชื่อมต่อผ่านระบบจำลอง Settrade Open API (${appCode} Zero-Custody Sandbox) ไม่มีการจัดเก็บกุญแจในฐานข้อมูล`,
  };
}

export async function GET(request) {
  const denied=await requireDataOwner(request); if(denied)return denied;
  const url = new URL(request.url);
  const brokerId = url.searchParams.get('brokerId') || '022';
  return Response.json(buildDemoPortfolio(brokerId), { headers: NO_STORE });
}

export async function POST(request) {
  const denied=await requireDataOwner(request); if(denied)return denied;
  if (!sameOrigin(request)) {
    return Response.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  }

  let body;
  try {
    body = await readJsonBody(request, 12288);
  } catch (e) {
    return requestErrorResponse(e);
  }

  const {
    brokerId = '022',
    appCode = 'ALGO_EQ',
    isDemo = false,
    isSandbox = false,
  } = body || {};

  // ─── 1. DEMO SANDBOX MODE ───
  if (isDemo || isSandbox) {
    return Response.json(buildDemoPortfolio(brokerId, appCode), { headers: NO_STORE });
  }

  // ─── 2. LIVE SETTRADE OPEN API MODE ───
  const member = await currentMember();
  if (!member) {
    return Response.json({ success: false, error: 'SIGN_IN_REQUIRED' }, { status: 401, headers: NO_STORE });
  }

  const limited = await rateLimit('broker-portfolio', member.id, 10);
  if (limited) return limited;

  try {
    if(!await requireOwnedBrokerAccount(body,'SET'))return Response.json({error:'FORBIDDEN'},{status:403,headers:NO_STORE});
    const live = await readBrokerPortfolio('SET', body);
    const brokerName = BROKER_NAMES[brokerId] || `Broker Code ${brokerId}`;

    // Enrich live holdings with diagnostic stages and actions
    const enrichedHoldings = (live.holdings || []).map((h) => {
      let stage = 2;
      let stageName = 'Stage 2 ขาขึ้นแข็งแกร่ง (Trend Follow)';
      let stageColor = '#10b981';
      let action = 'HOLD & RUN TREND';
      let actionNote = 'ราคาทรงตัวในกรอบแนวโน้ม ถือตามรอบวินัย';
      let trailingStop = h.marketPrice ? Number((h.marketPrice * 0.94).toFixed(2)) : null;
      let cutLossPrice = h.avgCost ? Number((h.avgCost * 0.92).toFixed(2)) : null;

      if (h.unrealizedPlPct !== null && h.unrealizedPlPct <= -5) {
        stage = 4;
        stageName = 'Stage 4 ขาลงอันตราย (หลุดแนวรับ)';
        stageColor = '#f43f5e';
        action = '🚨 REDUCE / CUT LOSS NOW';
        actionNote = 'ขาดทุนเกิน 5% แนะนำพิจารณาตัดขาดทุนหรือลดขนาดไม้';
        trailingStop = null;
      } else if (h.unrealizedPlPct !== null && h.unrealizedPlPct >= 15) {
        stage = 2;
        stageName = 'Stage 2 Super Profit (แตะเป้า 2R)';
        stageColor = '#10b981';
        action = 'TAKE PROFIT 50%';
        actionNote = 'กำไรเกิน 15% ทยอยแบ่งล็อคกำไรครึ่งหนึ่งตามวินัย';
      } else if (h.unrealizedPlPct !== null && h.unrealizedPlPct < 2 && h.unrealizedPlPct > -5) {
        stage = 1;
        stageName = 'Stage 1 สะสมฐาน (Base Building)';
        stageColor = '#f59e0b';
        action = 'HOLD BASE';
        actionNote = 'ต้นทุนใกล้ราคาตลาด ถือจับตากรอบแนวรับ';
      }

      const isDr = /\d{2,4}$/.test(h.symbol);
      let drMeta = null;
      if (isDr) {
        drMeta = {
          underlying: `${h.symbol.replace(/\d+$/, '')} Global Underlying`,
          fairStatus: 'FAIR (สอดคล้องราคาอ้างอิง)',
          fxImpact: 'USD/THB (ผลกระทบค่าเงินทรงตัว)',
        };
      }

      return {
        ...h,
        stage,
        stageName,
        stageColor,
        action,
        actionNote,
        trailingStop,
        cutLossPrice,
        drMeta,
      };
    });

    const totalMVal = enrichedHoldings.reduce((s, h) => s + (h.marketValue || 0), 0);
    let healthNumerator = 0;
    for (const h of enrichedHoldings) {
      const factor = h.stage === 2 ? 1.0 : h.stage === 1 ? 0.7 : h.stage === 3 ? 0.3 : 0.0;
      healthNumerator += (h.marketValue || 0) * factor;
    }
    const healthScore = totalMVal > 0 ? Math.round((healthNumerator / totalMVal) * 100) : 75;

    const stage2Sum = enrichedHoldings.filter((h) => h.stage === 2).reduce((s, h) => s + (h.marketValue || 0), 0);
    const stage4Sum = enrichedHoldings.filter((h) => h.stage === 4).reduce((s, h) => s + (h.marketValue || 0), 0);

    return Response.json(
      {
        ...live,
        brokerName,
        holdings: enrichedHoldings,
        health: {
          score: healthScore,
          grade: healthScore >= 80 ? 'เกรด A (พอร์ตขาขึ้นแข็งแกร่ง)' : healthScore >= 60 ? 'เกรด B (สมดุลปานกลาง)' : 'เกรด C (ความเสี่ยงสูง)',
          stage2RatioPct: totalMVal > 0 ? Number(((stage2Sum / totalMVal) * 100).toFixed(1)) : 0,
          stage4DangerRatioPct: totalMVal > 0 ? Number(((stage4Sum / totalMVal) * 100).toFixed(1)) : 0,
        },
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    const codes = [
      'ACCOUNT_AND_CREDENTIALS_REQUIRED',
      'BROKER_PERMISSION_DENIED',
      'BROKER_RATE_LIMITED',
      'BROKER_SOURCE_UNAVAILABLE',
      'BROKER_INVALID_RESPONSE',
      'PORTFOLIO_SCHEMA_UNSUPPORTED',
      'ACCOUNT_EQUITY_UNAVAILABLE',
    ];
    const code = codes.includes(e.code) ? e.code : 'BROKER_SOURCE_UNAVAILABLE';
    return Response.json(
      {
        success: false,
        error: code,
        message: 'อ่านพอร์ตไม่สำเร็จ · ' + code,
      },
      { status: code === 'ACCOUNT_AND_CREDENTIALS_REQUIRED' ? 400 : 502, headers: NO_STORE }
    );
  }
}
