import {refreshThaiDesk} from '../../../signals/thai-desk-refresh.mjs';
import {currentMember,privateHeaders,sameOrigin} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {rateLimit,readJsonBody,requestErrorResponse} from '../../../security/request-guard.mjs';
import {signalProviderAllowed} from '../../../signals/data.mjs';
import {thaiScreenerFeed} from '../../../signals/thai-screener.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const member=await currentMember();
 const limited=await rateLimit('thai-screener-read',member?.id||'public',60);if(limited)return limited;
 if(!signalProviderAllowed('thai'))return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers:privateHeaders});
 try{return Response.json(await thaiScreenerFeed(),{headers:privateHeaders});}
 catch{return Response.json({code:'SCREENER_STORE_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}

export async function POST(request){
 if(!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
 const member=await currentMember();
 if(!membershipFor(member).capabilities.autoPickFeed)return Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
 if(process.env.SHARED_MARKET_DATA_MODE==='daily')return Response.json({...await thaiScreenerFeed(),refresh:{status:'shared-daily',message:'โหลดผลส่วนกลางรอบรายวัน ไม่เรียกสแกนใหม่'}},{headers:privateHeaders});
 if(!signalProviderAllowed('thai'))return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers:privateHeaders});
 const limited=await rateLimit('thai-desk-refresh',member.id,20);if(limited)return limited;
 let body;try{body=await readJsonBody(request,2048);}catch(e){return requestErrorResponse(e);}
 try{
  const result=await refreshThaiDesk(body.symbols);
  return Response.json({...await thaiScreenerFeed(),refresh:result},{headers:privateHeaders});
 }catch(e){return Response.json({code:e.code==='INVALID_SYMBOLS'?'INVALID_SYMBOLS':'SCREENER_SOURCE_UNAVAILABLE'},{status:e.code==='INVALID_SYMBOLS'?400:503,headers:privateHeaders});}
}
