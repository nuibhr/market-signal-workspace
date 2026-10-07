import { currentMember, errorResponse, privateHeaders } from '../../../../../membership/server.mjs';
import { isAdmin } from '../../../../../membership/store.mjs';
import { adminMemberDetail } from '../../../../../admin/operations.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request,{params}){
  const admin=await currentMember();
  if(!isAdmin(admin))return Response.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
  const {id}=await params;
  if(!/^[-_a-zA-Z0-9]{16,100}$/.test(id))return Response.json({error:'INVALID_MEMBER_ID'},{status:400,headers:privateHeaders});
  try{return Response.json(await adminMemberDetail(admin,id),{headers:privateHeaders});}
  catch(error){return errorResponse(error);}
}
