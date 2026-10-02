import { currentMember, privateHeaders } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
import { createSettradeClient } from '../../../market-data/settrade.mjs';
import { buildTradePlan } from '../../../analysis/trade-plan.mjs';
import { normalizeThaiTradePlan } from '../../../analysis/thai-tick.mjs';
import { completedCandles } from '../../../analysis/pivots.mjs';
import { rateLimit } from '../../../security/request-guard.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const client=createSettradeClient(); const cache=new Map(); const pending=new Map();
function displayPlan(plan) {
  return Object.fromEntries(['tradeAllowed','side','bias','entryZone','stopLoss','tp1','tp2','signalScore','riskReward1'].map(key=>[key,plan[key]??null]));
}
export async function GET(request) {
  const member=await currentMember();
  if(!membershipFor(member).capabilities.autoPickFeed) return Response.json({status:'membership-required'},{status:403,headers:privateHeaders});
  const limited=rateLimit('technical-plan',member.id,15); if(limited)return limited;
  const symbol=new URL(request.url).searchParams.get('symbol')?.toUpperCase();
  const asset=ALL_ASSETS.find(a=>a.symbol===symbol&&a.feed==='settrade-daily');
  if(!asset)return Response.json({status:'unavailable'},{status:404,headers:privateHeaders});
  if(process.env.NODE_ENV==='production'&&process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED!=='true')return Response.json({status:'unavailable'},{status:503,headers:privateHeaders});
  try {
    const saved=cache.get(symbol);
    if(saved&&Date.now()-saved.at<60000)return Response.json(saved.data,{headers:privateHeaders});
    if(!pending.has(symbol))pending.set(symbol,(async()=>{
      const now=Date.now(); const series=await Promise.all(['1d','4h','1h'].map(frame=>client.getCandles(symbol,frame,250)));
      const [dailyBars,fourHourBars,oneHourBars]=series.map((s,i)=>completedCandles(s.bars,['1d','4h','1h'][i],now));
      let plan=buildTradePlan({symbol,instrumentId:asset.instrumentId,dailyBars,fourHourBars,oneHourBars,allowShort:false});
      if(asset.id==='thai')plan=normalizeThaiTradePlan(plan);
      const data={status:'available',instrumentId:asset.instrumentId,plan:displayPlan(plan)};
      cache.set(symbol,{at:Date.now(),data});if(cache.size>300)cache.delete(cache.keys().next().value);return data;
    })());
    return Response.json(await pending.get(symbol),{headers:privateHeaders});
  }catch{return Response.json({status:'unavailable'},{status:503,headers:privateHeaders});}
  finally{pending.delete(symbol);}
}
