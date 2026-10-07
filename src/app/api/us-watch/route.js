import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {getUsDailyBars,usEodRights} from '../../../market-data/us-eod.mjs';
import {assessDailySeries} from '../../../market-data/settrade.mjs';
import {analyzeCandles} from '../../../analysis/technical.mjs';
import {customerSummary} from '../../../analysis/customer-summary.mjs';
import {rateLimit} from '../../../security/request-guard.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'},cache=new Map(),pending=new Map();
const assets=new Map(ALL_ASSETS.filter(a=>a.id==='us').map(a=>[a.symbol,a]));
async function summary(symbol){
  const stored=cache.get(symbol);if(stored?.expiresAt>Date.now())return stored.value;
  if(pending.has(symbol))return pending.get(symbol);
  const job=(async()=>{try{
    const asset=assets.get(symbol),series=await getUsDailyBars(symbol,{assetKind:asset.sectionId==='US_ETFS'?'etf':'stock'});
    const bars=series.bars,analysis=analyzeCandles(bars),assessment=assessDailySeries(series);
    const review=customerSummary(analysis,assessment.signalEligible);
    const previous=bars.at(-2)?.close,price=bars.at(-1)?.close;
    const value={symbol,status:'available',price,changePercent:previous>0?(price/previous-1)*100:null,
      observedAt:series.latestDay,source:series.source,historical:true,score:review.score,label:review.label,
      trend:review.score===null?null:analysis?.trend,brief:review.score===null?'รอข้อมูลที่ใหม่และครบ':analysis?.plan?.title,
      live:false,kind:asset.sectionId==='US_ETFS'?'etf':'stock'};
    cache.set(symbol,{expiresAt:Date.now()+10*60000,value});return value;
  }catch{
    const value={symbol,status:'unavailable',score:null,label:'ข้อมูลไม่พร้อม'};
    cache.set(symbol,{expiresAt:Date.now()+30000,value});return value;
  }})().finally(()=>pending.delete(symbol));pending.set(symbol,job);return job;
}
export async function GET(request){
  const values=(new URL(request.url).searchParams.get('symbols')||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const symbols=[...new Set(values)];
  if(!symbols.length||symbols.length>6||symbols.some(s=>!assets.has(s)))return Response.json({status:'unavailable',code:'INVALID_SYMBOLS'},{status:400,headers});
  if(!usEodRights().fmp&&!usEodRights().yahoo)return Response.json({status:'unavailable',code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
  const newReads=symbols.filter(s=>!(cache.get(s)?.expiresAt>Date.now())&&!pending.has(s)).length;
  if(pending.size+newReads>12)return Response.json({status:'unavailable',code:'SOURCE_BUSY'},{status:503,headers:{...headers,'Retry-After':'10'}});
  // Bound provider work even for anonymous browsing; shared histories deduplicate reads.
  if(symbols.some(s=>!(cache.get(s)?.expiresAt>Date.now()))){const limited=(await rateLimit('us-watch-provider','global',30));if(limited)return limited;}
  const quotes=await Promise.all(symbols.map(summary));
  return Response.json({status:quotes.some(q=>q.status==='available')?'available':'unavailable',quotes,
    basis:'ราคาปิดรายวัน · คะแนนเทคนิค ไม่ใช่โอกาสชนะหรือสัญญาณซื้อ',live:false},{headers});
}
