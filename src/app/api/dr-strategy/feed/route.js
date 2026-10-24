import {currentMember,privateHeaders,sameOrigin} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
import {signalProviderAllowed} from '../../../../signals/data.mjs';
import {generateStrategyFeed} from '../../../../dr/strategy-feed.mjs';
import {createStrategyFeedCache} from '../../../../dr/strategy-feed-cache.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const readFeed=createStrategyFeedCache({load:generateStrategyFeed});
const readThaiFeed=createStrategyFeedCache({load:()=>generateStrategyFeed({markets:['thai']})});
async function respond(market) {
  try {
    const data=await (market==='thai'?readThaiFeed():readFeed());
    return Response.json(data,{status:data.status==='unavailable'?503:200,headers});
  } catch {return Response.json({status:'unavailable',code:'SCAN_UNAVAILABLE'},{status:503,headers});}
}
async function authorized(request,refresh){
  if(refresh&&!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const member=await currentMember(),rights=membershipFor(member);
  if(refresh&&!rights.capabilities.manualDailyScan)return Response.json({status:'membership-required',code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
  const limited=await rateLimit(refresh?'radar-refresh':'radar-read',member?.id||'public',refresh?3:60);if(limited)return limited;
  const market=new URL(request.url).searchParams.get('market')==='thai'?'thai':'dr';
  if(market==='thai'&&!signalProviderAllowed('thai'))return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
  return respond(market);
}
export async function GET(request){return authorized(request,false);}
export async function POST(request){return authorized(request,true);}
