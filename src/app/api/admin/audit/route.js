import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { adminAudit } from '../../../../admin/operations.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
  const admin=await currentMember();
  if(!isAdmin(admin))return Response.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
  try{return Response.json(await adminAudit(admin,{page:new URL(request.url).searchParams.get('page')}),{headers:privateHeaders});}
  catch{return Response.json({error:'AUDIT_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
