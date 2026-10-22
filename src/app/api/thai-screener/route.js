import {currentMember,privateHeaders} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {rateLimit} from '../../../security/request-guard.mjs';
import {signalProviderAllowed} from '../../../signals/data.mjs';
import {thaiScreenerFeed} from '../../../signals/thai-screener.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const member=await currentMember();
 if(!membershipFor(member).capabilities.autoPickFeed)return Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
 const limited=await rateLimit('thai-screener-read',member.id,30);if(limited)return limited;
 if(!signalProviderAllowed('thai'))return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers:privateHeaders});
 try{return Response.json(await thaiScreenerFeed(),{headers:privateHeaders});}
 catch{return Response.json({code:'SCREENER_STORE_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
