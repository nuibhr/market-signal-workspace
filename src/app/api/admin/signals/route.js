import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { signalResults } from '../../../../auto-pick/store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
  const admin=await currentMember();
  if(!isAdmin(admin))return Response.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
  const params=new URL(request.url).searchParams;
  try{
    const result=await signalResults({market:params.get('market'),status:params.get('status'),scope:'history',page:params.get('page'),pageSize:7});
    return Response.json({...result,signals:result.signals.map(({plan,...signal})=>({...signal,
      plannedEntry:plan?.entry??null,stopLoss:plan?.stopLoss??null,target:plan?.tp1??null}))},{headers:privateHeaders});
  }catch{return Response.json({error:'SIGNALS_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
