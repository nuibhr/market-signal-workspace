import {currentMember,privateHeaders,sameOrigin} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
import {generateStrategyFeed} from '../../../../dr/strategy-feed.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
let cached,pending,expires=0;
async function respond(refresh=false) {
  try {
    if(!pending&&(refresh||!cached||Date.now()>=expires)) {
      pending=generateStrategyFeed().then(data=>{cached=data;expires=Date.now()+60000;return data;}).finally(()=>{pending=null;});
    }
    const data=pending?await pending:cached;
    return Response.json(data,{status:data.status==='unavailable'?503:200,headers});
  } catch {return Response.json({status:'unavailable',code:'SCAN_UNAVAILABLE'},{status:503,headers});}
}
async function authorized(request,refresh){
  if(refresh&&!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const member=await currentMember(),rights=membershipFor(member);
  if(!rights.capabilities.autoPickFeed||refresh&&!rights.capabilities.manualDailyScan)return Response.json({status:'membership-required',code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
  const limited=await rateLimit(refresh?'radar-refresh':'radar-read',member.id,refresh?3:30);if(limited)return limited;
  return respond(refresh);
}
export async function GET(request){return authorized(request,false);}
export async function POST(request){return authorized(request,true);}
