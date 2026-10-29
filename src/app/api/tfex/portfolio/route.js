import {requireDataOwner,requireOwnedBrokerAccount} from '../../../../market-data/contracts/v1/owner-server.mjs';
import {readBrokerPortfolio} from '../../../../market-data/broker-portfolio.mjs';
import {currentMember,sameOrigin} from '../../../../membership/server.mjs';
import {rateLimit,readJsonBody,requestErrorResponse} from '../../../../security/request-guard.mjs';
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

// TFEX official margin standards (as of current market regulations)
const SPEC_DATA = {
  S50: { im: 10850, mm: 7595, fm: 3255, multiplier: 200 },
  GO: { im: 31500, mm: 22050, fm: 9450, multiplier: 300 },
  SVF: { im: 18200, mm: 12740, fm: 5460, multiplier: 3000 },
  USD: { im: 1050, mm: 735, fm: 315, multiplier: 1000 },
};

export async function GET(request) {
  const denied=await requireDataOwner(request); if(denied)return denied;
  const url = new URL(request.url);
  const brokerId = url.searchParams.get('brokerId') || '032';
  const isDemo = url.searchParams.get('demo') !== 'false';
  return handlePortfolioRequest({ brokerId, isDemo: true, isSandbox: false });
}

export async function POST(request) {
  const denied=await requireDataOwner(request); if(denied)return denied;
  if(!sameOrigin(request))return Response.json({success:false,error:'INVALID_ORIGIN'},{status:403,headers:NO_STORE});
  let body;try{body=await readJsonBody(request,12288);}catch(e){return requestErrorResponse(e);}
  if (body?.isDemo || body?.isSandbox) {
    return handlePortfolioRequest(body);
  }
  const member=await currentMember();if(!member)return Response.json({success:false,error:'SIGN_IN_REQUIRED'},{status:401,headers:NO_STORE});
  const limited=await rateLimit('broker-portfolio',member.id,10);if(limited)return limited;
  return handlePortfolioRequest(body);
}

async function handlePortfolioRequest(body = {}) {
  try {
    const {
      brokerId = '032',
      appId = '',
      appSecret = '',
      appCode = '',
      isDemo = false,
      isSandbox = false,
    } = body;

    const brokerName = BROKER_NAMES[brokerId] || `Broker Code ${brokerId}`;

    // ─── DEMO / SANDBOX / TESTNET MODE ───
    if (isDemo || isSandbox) {
      const demoPositions = [
        {
          symbol: 'S50Z26',
          product: 'S50',
          productName: 'SET50 Index Futures',
          side: 'LONG',
          contracts: 5,
          entryPrice: 894.20,
          marketPrice: 895.60,
          unrealizedPl: 1400,
          im: SPEC_DATA.S50.im * 5,
          mm: SPEC_DATA.S50.mm * 5,
          fm: SPEC_DATA.S50.fm * 5,
          multiplier: SPEC_DATA.S50.multiplier,
        },
        {
          symbol: 'GOM26',
          product: 'GO',
          productName: 'Gold Online Futures',
          side: 'LONG',
          contracts: 2,
          entryPrice: 2650.0,
          marketPrice: 2642.0,
          unrealizedPl: -4800,
          im: SPEC_DATA.GO.im * 2,
          mm: SPEC_DATA.GO.mm * 2,
          fm: SPEC_DATA.GO.fm * 2,
          multiplier: SPEC_DATA.GO.multiplier,
        },
      ];

      const totalIm = demoPositions.reduce((acc, p) => acc + p.im, 0); // 117,250
      const totalMm = demoPositions.reduce((acc, p) => acc + p.mm, 0); // 82,075
      const totalFm = demoPositions.reduce((acc, p) => acc + p.fm, 0); // 35,175
      const totalUnrealizedPl = demoPositions.reduce((acc, p) => acc + p.unrealizedPl, 0); // -3,400
      const equity = 300000 + totalUnrealizedPl; // 296,600
      const excessEquity = Math.max(0, equity - totalIm); // 179,350
      const marginUsagePct = ((totalIm / equity) * 100).toFixed(1);

      return Response.json(
        {
          success: true,
          mode: isSandbox ? 'SANDBOX' : 'DEMO',
          accountNo: 'INNO-88392-T',
          brokerId,
          brokerName,
          asOf: new Date().toISOString(),
          equity,
          cashBalance: 300000,
          excessEquity,
          totalIm,
          totalMm,
          totalFm,
          totalUnrealizedPl,
          marginUsagePct,
          positions: demoPositions,
          notice: 'เชื่อมต่อผ่านระบบจำลอง Settrade Open API (Zero-Custody Sandbox) ไม่มีการจัดเก็บกุญแจในฐานข้อมูลส่วนกลาง',
        },
        { status: 200, headers: NO_STORE }
      );
    }

    if(!await requireOwnedBrokerAccount(body,'TFEX'))return Response.json({error:'FORBIDDEN'},{status:403,headers:NO_STORE});
    const live = await readBrokerPortfolio('TFEX', body);
    return Response.json({...live,brokerName},{headers:NO_STORE});
  } catch (error) {
    return Response.json(
      { success: false, error: 'SERVER_ERROR', message: 'อ่านพอร์ตไม่สำเร็จ ตรวจเลขบัญชีและสิทธิ API ของโบรกเกอร์' },
      { status: 500, headers: NO_STORE }
    );
  }
}
