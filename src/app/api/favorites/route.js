import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { importFavorites, memberFavorites, setFavorite } from '../../../membership/favorites.mjs';
import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../security/request-guard.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  const member=await currentMember();
  if(!member)return Response.json({error:'LOGIN_REQUIRED'},{status:401,headers:privateHeaders});
  const limited=await rateLimit('favorites-read',member.id,60);if(limited)return limited;
  try{return Response.json(await memberFavorites(member),{headers:privateHeaders});}
  catch{return Response.json({error:'FAVORITES_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
export async function POST(request) {
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const member=await currentMember();
  if(!member)return Response.json({error:'LOGIN_REQUIRED'},{status:401,headers:privateHeaders});
  const limited=await rateLimit('favorites-write',member.id,40);if(limited)return limited;
  try {
    const input=await readJsonBody(request,32000);
    const result=input.action==='import'?await importFavorites(member,input.items):await setFavorite(member,input.market,input.symbol,input.saved);
    return Response.json(result,{headers:privateHeaders});
  } catch(error) {
    if(error instanceof RequestError)return requestErrorResponse(error);
    const known=['INVALID_FAVORITES','INVALID_FAVORITE','FAVORITES_LIMIT'].includes(error.message);
    return Response.json({error:known?error.message:'FAVORITES_UNAVAILABLE'},{status:known?400:503,headers:privateHeaders});
  }
}
