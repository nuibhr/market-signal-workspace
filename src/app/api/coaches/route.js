import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import { listPortfolios, mutatePortfolio } from '../../../coaches/store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
  try{
    const q=new URL(request.url).searchParams;
    return Response.json(await listPortfolios(await currentMember(),{admin:q.get('admin')==='1',own:q.get('own')==='1',page:q.get('page')}),{headers:privateHeaders});
  }catch(error){return requestErrorResponse(error);}
}
export async function POST(request){
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  try{
    const actor=await currentMember();
    if(!actor)return Response.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
    const limited=await rateLimit('coach-write',actor.id,20);if(limited)return limited;
    return Response.json(await mutatePortfolio(actor,await readJsonBody(request,4096)),{headers:privateHeaders});
  }catch(error){return requestErrorResponse(error);}
}
