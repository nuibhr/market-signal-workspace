import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server.js';
import {storage,operation as op} from '../../../../storage/database.mjs';
import {createSession,deleteSession,sessionMember} from '../../../../membership/store.mjs';
import {DEMO_COOKIE,DEMO_ROLES,demoEnabled} from '../../../../membership/demo-policy.mjs';
import {privateHeaders,sameOrigin,secureCookie} from '../../../../membership/server.mjs';
import {rateLimit,readJsonBody,requestErrorResponse} from '../../../../security/request-guard.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const disabled=()=>Response.json({error:'DEMO_LOGIN_DISABLED'},{status:404,headers:privateHeaders});
export async function POST(request){
  if(!demoEnabled())return disabled();
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  try{
    const {role}=await readJsonBody(request,1024);
    if(!DEMO_ROLES.includes(role))return Response.json({error:'INVALID_DEMO_ROLE'},{status:400,headers:privateHeaders});
    const limited=await rateLimit('demo-login','global',120);if(limited)return limited;
    const previous=request.cookies.get(DEMO_COOKIE)?.value;
    const prior=await sessionMember(previous);
    const id=prior?.demo?prior.id:`demo-${randomUUID()}`;
    const now=new Date().toISOString(),expiresAt=prior?.demo?.expiresAt??new Date(Date.now()+2*3600000).toISOString();
    await storage.batch([
      op(`INSERT INTO members(id,line_id,display_name,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at`,id,`Udemo_${id.slice(5)}`,`Demo ${role}`,now,now),
      op('INSERT INTO demo_access(member_id,role,expires_at) VALUES(?,?,?) ON CONFLICT(member_id) DO UPDATE SET role=excluded.role',id,role,expiresAt),
    ]);
    const session=await createSession(id,expiresAt);
    if(prior?.demo)await deleteSession(previous);
    const response=NextResponse.json({ok:true,role},{headers:privateHeaders});
    response.cookies.set(DEMO_COOKIE,session.value,{httpOnly:true,secure:secureCookie(request),sameSite:'lax',path:'/',expires:new Date(expiresAt)});
    return response;
  }catch(error){return requestErrorResponse(error);}
}
export async function DELETE(request){
  if(!demoEnabled())return disabled();
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const value=request.cookies.get(DEMO_COOKIE)?.value;
  if((await sessionMember(value))?.demo)await deleteSession(value);
  const response=NextResponse.json({ok:true},{headers:privateHeaders});
  response.cookies.delete(DEMO_COOKIE);
  return response;
}
