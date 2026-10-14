import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { readJsonBody, rateLimit, requestErrorResponse } from '../../../security/request-guard.mjs';
import { communityOverview, channelMessages, communityAdmin, mutateCommunity } from '../../../community/store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request) {
  try {
    const actor=await currentMember(),q=new URL(request.url).searchParams;
    if(!actor)return Response.json({error:'LOGIN_REQUIRED'},{status:401,headers:privateHeaders});
    const limited=await rateLimit('community-read',actor.id,90);if(limited)return limited;
    const view=q.get('view')||'overview';
    const data=view==='channel'?await channelMessages(actor,{kind:q.get('kind'),id:q.get('id'),page:q.get('page')}):view==='admin'?await communityAdmin(actor,{page:q.get('page')}):await communityOverview(actor,{team:q.get('team')==='1',page:q.get('page')});
    return Response.json(data,{headers:privateHeaders});
  } catch(error){return requestErrorResponse(error);}
}
export async function POST(request) {
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  try {
    const actor=await currentMember();
    if(!actor)return Response.json({error:'LOGIN_REQUIRED'},{status:401,headers:privateHeaders});
    const body=await readJsonBody(request,10000);
    const limited=await rateLimit(body.action==='read'?'community-receipt':'community-write',actor.id,body.action==='read'?60:15);if(limited)return limited;
    return Response.json(await mutateCommunity(actor,body),{headers:privateHeaders});
  } catch(error){return requestErrorResponse(error);}
}
