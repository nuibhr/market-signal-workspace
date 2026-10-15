import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { requestErrorResponse } from '../../../../security/request-guard.mjs';
import { portfolioDetail } from '../../../../coaches/store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request,{params}){
  try{
    const {id}=await params,q=new URL(request.url).searchParams;
    return Response.json(await portfolioDetail(await currentMember(),id,{management:q.get('management')==='1',page:q.get('page'),filter:q.get('filter')}),{headers:privateHeaders});
  }catch(error){return requestErrorResponse(error);}
}
