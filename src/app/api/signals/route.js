import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
import { signalDeskFeed, saveUsCosts, usCostProfile, defaultSignalCosts } from '../../../signals/store.mjs';
import { runSignalScan } from '../../../signals/runner.mjs';
import { loadSignalReplay } from '../../../signals/replay.mjs';
import { signalMarketOverview } from '../../../signals/overview.mjs';
import { signalProviderAllowed } from '../../../signals/data.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
async function member(){const m=await currentMember();return membershipFor(m).capabilities.autoPickFeed?m:null;}
const denied=()=>Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
export async function GET(request){
  const m=await member();if(!m)return denied();
  const limited=await rateLimit('signal-desk-read',m.id,90);if(limited)return limited;
  const p=new URL(request.url).searchParams,market=p.get('market')||'thai',mode=p.get('mode')||'all';
  if(p.has('record')&&(!p.get('record').trim()||p.get('record').length>300))return Response.json({code:'INVALID_RECORD'},{status:400,headers:privateHeaders});
  if(!['thai','dr','us'].includes(market)||!['all','breakout','pullback'].includes(mode))return Response.json({code:'INVALID_MARKET_OR_MODE'},{status:400,headers:privateHeaders});
  if(!signalProviderAllowed(market))return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers:privateHeaders});
  try{const [feed,overview]=await Promise.all([signalDeskFeed(m.id,{market,mode,page:p.get('page'),query:(p.get('q')||'').slice(0,40),after:p.get('after'),recordId:p.get('record'),favorites:p.has('favorites')?p.get('favorites').split(',').filter(Boolean).slice(0,500):null}),signalMarketOverview(market)]);return Response.json({...feed,overview},{headers:privateHeaders});}
  catch(e){return Response.json({code:e.code==='INVALID_EVENT_CURSOR'?e.code:'SIGNAL_STORE_UNAVAILABLE'},{status:e.code==='INVALID_EVENT_CURSOR'?400:503,headers:privateHeaders});}
}
export async function POST(request){
  if(!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const m=await member();if(!m)return denied();
  let body;try{body=await readJsonBody(request,4096);}catch(e){return requestErrorResponse(e);}
  const limited=await rateLimit('signal-desk-write',m.id,3);if(limited)return limited;
  try{
    if(body.action==='costs')return Response.json({status:'saved',profile:await saveUsCosts(m.id,body.costs||{})},{headers:privateHeaders});
    const asset=ALL_ASSETS.find(a=>a.id===body.market&&a.symbol===body.symbol&&['thai','dr','us'].includes(a.id));
    if(body.action==='replay'&&asset){
      const globalLimit=await rateLimit('signal-replay','provider-global',6);if(globalLimit)return globalLimit;
      const costs=asset.id==='us'?(await usCostProfile(m.id))?.costs:defaultSignalCosts(asset);
      if(!costs)return Response.json({code:'COSTS_REQUIRED'},{status:422,headers:privateHeaders});
      return Response.json(await loadSignalReplay(asset,costs),{headers:privateHeaders});
    }
    if(body.action==='scan'&&['thai','dr','us'].includes(body.market)&&Array.isArray(body.symbols)&&body.symbols.length>0&&body.symbols.length<=6){
      const globalLimit=await rateLimit('signal-scan','provider-global',6);if(globalLimit)return globalLimit;
      return Response.json(await runSignalScan(body.market,{symbols:body.symbols,maxSymbols:6,budgetMs:25000}),{headers:privateHeaders});
    }
    return Response.json({code:'INVALID_SIGNAL_REQUEST'},{status:400,headers:privateHeaders});
  }catch(e){const invalid=['COSTS_REQUIRED','INVALID_COSTS'].includes(e.message);return Response.json({code:invalid?e.message:'SIGNAL_SOURCE_UNAVAILABLE'},{status:invalid?400:503,headers:privateHeaders});}
}
