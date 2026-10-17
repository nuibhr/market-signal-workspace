import { receiverConfiguration } from '../forex-mt5/runtime-policy.mjs';
import { storeFor } from '../forex-mt5/store.mjs';
import { dashboard } from './store.mjs';
import { membershipFor } from '../membership/rights.mjs';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function createDaytradeHandlers({currentMember,getStore=storeFor,env=process.env}) {
  return {async GET(request){
    const params=new URL(request.url).searchParams,market=params.get('market')||'us',recordId=params.get('record');
    if(recordId!==null&&(!recordId.trim()||recordId.length>300))return Response.json({error:'INVALID_RECORD'},{status:400,headers});
    if(!['thai','dr','tfex','us','forex'].includes(market))return Response.json({error:'INVALID_MARKET'},{status:400,headers});
    const member=await currentMember();
    if(!member)return Response.json({error:'SIGN_IN_REQUIRED'},{status:401,headers});
    const config=receiverConfiguration(env);
    if(!config.enabled)return Response.json({error:config.disabledReason||'SCANNER_DISABLED'},{status:503,headers});
    try {
      const store=getStore(config),connection=store.connection(`member:${member.id}`);
      store.limit('daytrade-read',member.id,90);
      const safe=connection&&connection.expires>Date.now()&&config.servers.includes(connection.server)?connection:null;
      const data=dashboard(store.db,safe,market,{symbol:params.get('symbol'),compact:params.get('compact')==='1',recordId});
      data.notificationScope=`daytrade:${member.id}:${['us','forex'].includes(market)?safe?.id||'disconnected':'native'}:${market}`;
      data.historicalTimePolicy=config.historyPolicy||'observed-clock-only';
      data.signalAccess=membershipFor(member).capabilities.autoPickFeed;
      if(!data.signalAccess){
        data.universe=data.universe.map(r=>({...r,side:null,monitorPlan:null,ranking:null}));
        data.monitorEvents=[];
        data.forward=[];data.summary=null;data.record=null;
        if(data.selected){data.selected.replay=null;data.selected.forward=[];}
      }
      return Response.json(data,{headers});
    } catch(error) {return Response.json({error:error.status===429?'RATE_LIMITED':'SCANNER_UNAVAILABLE'},{status:error.status===429?429:503,headers});}
  }};
}
