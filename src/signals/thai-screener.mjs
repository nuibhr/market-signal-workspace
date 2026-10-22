import {storage} from '../storage/database.mjs';
import {signalUniverse} from './data.mjs';
import {candidateViews} from './model.mjs';
import {defaultSignalCosts} from './store.mjs';
import {emaSeries} from '../analysis/minervini-stage2.mjs';
export async function thaiScreenerFeed(now=Date.now()){
 const observations=await storage.all('SELECT symbol,payload_json,checked_ms,next_scan_ms FROM signal_desk_observations WHERE market=?','thai');
 const bySymbol=new Map(observations.map(r=>[r.symbol,r]));
 const profileAllowed=process.env.NODE_ENV!=='production'||process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED==='true';
 const profiles=new Map((profileAllowed?await storage.all("SELECT payload_json FROM provider_cache WHERE id LIKE 'thai-stage2-profile:%' AND expires_at>?",now):[]).map(r=>{const p=JSON.parse(r.payload_json);return [p.symbol,p];}));
 const benchmarkRow=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?','thai-stage2-benchmark-v2',now);
 let benchmark=benchmarkRow?JSON.parse(benchmarkRow.payload_json):null;
 if(benchmark?.source?.startsWith('Yahoo')&&!profileAllowed)benchmark=null;
 const rows=signalUniverse('thai').map(asset=>{
  const stored=bySymbol.get(asset.symbol),snapshot=stored?JSON.parse(stored.payload_json):null;
  const fresh=Boolean(stored&&now-stored.checked_ms<=20*60000),assessment=fresh?snapshot?.stage2:null;
  const profile=profiles.get(asset.symbol),technical=assessment?.technical??{};
  const plans=snapshot&&fresh?candidateViews(snapshot,defaultSignalCosts(asset)):[];
  const plan=plans.find(r=>r.plan?.signalEligible)?.plan??assessment?.plan??null;
  return {symbol:asset.symbol,name:profile?.name??asset.name,section:asset.sectionId,market:'thai',
   status:fresh?assessment?.status??'unavailable':'unavailable',code:fresh?assessment?.code??'WAIT_STAGE2_SCAN':'SCAN_STALE',
   price:assessment?.price??null,changePercent:assessment?.changePercent??null,priceDay:assessment?.priceDay??null,
   stage:assessment?.stage??null,score:assessment?.score??null,criteria:assessment?.criteria??[],templatePass:assessment?.templatePass??false,
   rsi:technical.rsi??null,macdHistogram:technical.macdHistogram??null,volumeBreakout:assessment?.volumeBreakout??false,pullback:assessment?.pullback??false,
   rs:assessment?.rs??null,rvol:assessment?.rvol??null,plan,planFrame:plans.some(r=>r.plan===plan)?'4H':'D1',
   pe:profile?.pe??null,dividendPercent:profile?.dividendPercent??null,sector:profile?.sectorCode??null,sectorLabel:profile?.sector??null,
   profileAt:profile?.checkedAt??null,checkedAt:snapshot?.checkedAt??null,nextScanAt:stored?new Date(stored.next_scan_ms).toISOString():null};
 });
 const available=rows.filter(r=>r.price!==null&&r.status!=='unavailable'&&r.status!=='stale');
 const rsLeaders=available.filter(r=>r.rs?.status==='available'&&r.rs.outperforming).sort((a,b)=>b.rs.excessReturnPercent-a.rs.excessReturnPercent).slice(0,3).map(r=>({symbol:r.symbol,excessReturnPercent:r.rs.excessReturnPercent}));
 const indexBars=benchmark?.bars?.filter(b=>Date.parse(`${b.time}T17:15:00+07:00`)<=now)??[],ema=emaSeries(indexBars.map(b=>b.close),50).at(-1),index=indexBars.at(-1);
 const indexFresh=index&&now-Date.parse(`${index.time}T17:15:00+07:00`)<=8*86400000;
 return {status:'available',market:'thai',assessmentOnly:true,ruleVersion:'thai-ema-stage2-context-v1',rows,
  stats:{expected:rows.length,observed:available.length,stage2:available.filter(r=>r.templatePass).length,surge:available.filter(r=>r.rvol>1.5).length,rsLeaders,
   advance:available.filter(r=>r.changePercent>0).length,decline:available.filter(r=>r.changePercent<0).length,flat:available.filter(r=>r.changePercent===0).length,
   index:indexFresh?{price:index.close,day:index.time,trend:ema?index.close>=ema?'up':'down':'unknown',source:benchmark.source}:null},
  cadence:{discoveryMinutes:10},note:'EMA adaptation · reference screening only · closed D1 + delay ≥15m · provider groups, not certified SET sectors/SETHD'};
}
