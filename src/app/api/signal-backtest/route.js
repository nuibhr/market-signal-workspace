import { backtestSummary } from '../../../auto-pick/backtest-summary.mjs';
import { currentMember, privateHeaders } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { rateLimit } from '../../../security/request-guard.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const member = await currentMember();
  if (!membershipFor(member).capabilities.autoPickFeed) return Response.json({status:'membership-required'}, {status:403,headers:privateHeaders});
  const limited = rateLimit('backtest-summary',member.id,20); if (limited) return limited;
  const market = new URL(request.url).searchParams.get('market') ?? 'all';
  if (!['all','thai','dr','us'].includes(market)) return Response.json({code:'INVALID_MARKET'}, {status:400,headers:privateHeaders});
  try {return Response.json(backtestSummary(market),{headers:privateHeaders});}
  catch {return Response.json({code:'BACKTEST_UNAVAILABLE'}, {status:503,headers:privateHeaders});}
}
