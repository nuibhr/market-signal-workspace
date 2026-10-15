// Public-market read only. No members, cost preferences, journal mutations or orders.
import {ALL_ASSETS} from '../src/markets/catalog.mjs';
import {loadSignalFrame} from '../src/signals/data.mjs';
import {inspectSignalBars,candidateViews} from '../src/signals/model.mjs';
import {defaultSignalCosts} from '../src/signals/store.mjs';
import {loadSignalReplay} from '../src/signals/replay.mjs';
import {signalMarketOverview} from '../src/signals/overview.mjs';
const results=[];
for(const [market,symbol] of [['thai','SCB'],['dr','AAPL80'],['us','SPY']]){
 const asset=ALL_ASSETS.find(a=>a.id===market&&a.symbol===symbol);
 try{
  const daily=await loadSignalFrame(asset,'1d'),four=await loadSignalFrame(asset,'4h');
  const snapshot=inspectSignalBars({...asset,signalSource:`${daily.source} / ${four.source}`},daily.bars,four.bars);
  const views=candidateViews(snapshot,defaultSignalCosts(asset));
  results.push({market,symbol,source:snapshot.source,status:snapshot.status,bars:{daily:daily.bars.length,fourHour:four.bars.length},
   price:snapshot.price,priceAt:snapshot.priceAt,atr:snapshot.atr,rsiD1:snapshot.rsiD1,rsi4h:snapshot.rsi4h,relativeVolume:snapshot.relativeVolume,
   variants:views.map(v=>({mode:v.mode,state:v.state,reasons:v.reasons,entry:v.plan?.entry,stop:v.plan?.stopLoss,tp1:v.plan?.minimumTarget}))});
  if(market==='thai'){
   const replay=await loadSignalReplay(asset,defaultSignalCosts(asset));
   results.push({market,symbol,test:'actual-short-replay',status:replay.status,period:replay.period,counts:replay.counts,
    variants:replay.variants.map(v=>({mode:v.mode,statistics:v.statistics,records:v.records.length})),strategyValidated:replay.strategyValidated});
  }
 }catch(error){results.push({market,symbol,code:error.code||'SOURCE_UNAVAILABLE'});}
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),scope:'Actual public data / no customer portfolio',overview:await signalMarketOverview('thai'),results},null,2));
