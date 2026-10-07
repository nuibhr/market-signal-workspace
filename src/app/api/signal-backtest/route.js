import { signalPerformance } from '../../../auto-pick/store.mjs';
import { currentMember, privateHeaders } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { rateLimit } from '../../../security/request-guard.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const member = await currentMember();
  if (!membershipFor(member).capabilities.autoPickFeed) return Response.json({status:'membership-required'}, {status:403,headers:privateHeaders});
  const limited = (await rateLimit('backtest-summary',member.id,20)); if (limited) return limited;
  const market = new URL(request.url).searchParams.get('market') ?? 'all';
  if (!['all','thai','dr','us','tfex','forex'].includes(market)) return Response.json({code:'INVALID_MARKET'}, {status:400,headers:privateHeaders});
  // Compatibility URL: the customer report now uses the same recorded ledger as /auto-pick/results.
  try {return Response.json({status:'available',...(await signalPerformance(market)),note:'100 ไม้ที่เข้าและปิดผลล่าสุดจากประวัติสัญญาณเดียวกัน · ก่อนค่าธรรมเนียมและสลิปเพจ'},{headers:privateHeaders});}
  catch {return Response.json({code:'BACKTEST_UNAVAILABLE'}, {status:503,headers:privateHeaders});}
}
