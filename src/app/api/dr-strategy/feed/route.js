import {currentMember,privateHeaders,sameOrigin} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
import {generateStrategyFeed} from '../../../../dr/strategy-feed.mjs';
import {createStrategyFeedCache} from '../../../../dr/strategy-feed-cache.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const readFeed=createStrategyFeedCache({load:generateStrategyFeed});
async function respond() {
  try {
    const data=await readFeed();
    return Response.json(data,{status:data.status==='unavailable'?503:200,headers});
  } catch {return Response.json({status:'unavailable',code:'SCAN_UNAVAILABLE'},{status:503,headers});}
}
async function authorized(request,refresh){
  if(refresh&&!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const member=await currentMember(),rights=membershipFor(member);
  if(!rights.capabilities.autoPickFeed||refresh&&!rights.capabilities.manualDailyScan)return Response.json({status:'membership-required',code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
  const limited=await rateLimit(refresh?'radar-refresh':'radar-read',member.id,refresh?3:30);if(limited)return limited;
  return respond();
}
export async function GET(request){return authorized(request,false);}
export async function POST(request){return authorized(request,true);}
