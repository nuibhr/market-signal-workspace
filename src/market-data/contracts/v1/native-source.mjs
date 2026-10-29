import {candleClosedAt} from '../../delayed-candles.mjs';
import {closedThaiChartBars} from '../../thai-feed-meta.mjs';
import {sharedDaily,sharedSeries} from '../../shared-policy.mjs';
import {providerFor} from './adapters.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const stamp=v=>typeof v==='string'&&/T/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const kind=(market,asset)=>({thai:'DAILY_BAR',dr:'DR_DAILY_BAR',us:asset.sectionId==='US_ETFS'?'ETF_EOD':'EQUITY_EOD',tfex:'FUTURES_QUOTE',forex:'SCAN_CANDIDATE'}[market]);
export function emptyNativeInput(asset,market,attempted=false){return {market,symbol:asset.symbol,instrumentId:asset.instrumentId,assetType:market==='us'&&asset.sectionId==='US_ETFS'?'ETF':undefined,providerId:market==='us'?'fmp':market==='forex'?'owner-ingest':'settrade',providerState:attempted?'UNAVAILABLE':'NOT_CONFIGURED',dataMode:market==='tfex'?'DELAYED':'EOD',dataKind:kind(market,asset),available:false,attempted,qualityVerified:false,closed:false,failureCode:attempted?'SOURCE_UNAVAILABLE':'SOURCE_NOT_CONFIGURED',data:{}};}
function validDaily(b){return typeof b.time==='string'&&/^\d{4}-\d\d-\d\d$/.test(b.time)&&Number.isFinite(Date.parse(b.time))&&new Date(b.time).toISOString().slice(0,10)===b.time&&[b.open,b.high,b.low,b.close].every(n=>finite(n)&&n>0)&&finite(b.volume)&&b.volume>=0&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close);}
// Native mode reads only native providers. Shared mode preserves the cached source
// and fallback metadata; the canonical projection authorizes that actual source.
export function createNativeSource({assets,createSettrade,createTfex,getUsBars,clock=Date.now,sharedMode=sharedDaily,readShared=sharedSeries}){
 const cache=new Map(),pending=new Map();
 async function read(asset,market,now,shared){
  const base=emptyNativeInput(asset,market,true);
  try{
   if(market==='tfex'&&!shared){
    const client=createTfex();if(!client.configuration.configured)return emptyNativeInput(asset,market);
    const quote=await client.getQuote(asset.symbol);
    if(quote.symbol!==asset.symbol||quote.status!=='available'||!finite(quote.price)||quote.price<=0||
     ['bid','ask','openInterest','volume'].some(k=>quote[k]!=null&&(!finite(quote[k])||quote[k]<0))||
     (finite(quote.bid)&&finite(quote.ask)&&quote.ask<quote.bid))return base;
    return {...base,providerState:'READY',available:true,failureCode:null,dataAsOf:stamp(quote.observedAt),observedAt:stamp(quote.observedAt),receivedAt:stamp(quote.receivedAt),
     data:{price:quote.price,changePct:quote.changePercent,bid:quote.bid,ask:quote.ask,volume:quote.volume,openInterest:quote.openInterest??null}};
   }
   if(!['thai','dr','us','tfex'].includes(market))return emptyNativeInput(asset,market);
   let series;
   if(shared)series=await readShared(asset,'1d');
   else if(market==='us')series=await getUsBars(asset.symbol,now);
   else{const client=createSettrade();if(!client.configuration.configured)return emptyNativeInput(asset,market);series=await client.getDailyCandles(asset.symbol,300);}
   if(series.symbol!==asset.symbol||series.timeframe!=='1d'||!Array.isArray(series.bars)||(shared&&series.instrumentId!==asset.instrumentId))return base;
   const providerId=providerFor(series.source);
   const allowed=market==='tfex'?['settrade']:market==='us'?['fmp','yahoo']:['settrade','yahoo'];
   if(shared&&!allowed.includes(providerId)||!shared&&providerId!=='unknown'&&providerId!==base.providerId)return base;
   const bars=(market==='us'?series.bars.filter(b=>candleClosedAt(b,'1d','us')<=now):closedThaiChartBars(series.bars,'1d',now,market));
   if(!bars.length||bars.some((b,i)=>!validDaily(b)||(i>0&&b.time<=bars[i-1].time)))return base;
   const last=bars.at(-1),previous=bars.at(-2),closed=candleClosedAt(last,'1d',market);
   if(!Number.isFinite(closed)||closed>now)return base;
   return {...base,providerId:shared?providerId:base.providerId,fallback:shared||series.fallback===true||series.chartOnly===true,dataMode:'EOD',dataKind:market==='tfex'?'CANDLE':base.dataKind,providerState:'READY',available:true,closed:true,failureCode:null,dataAsOf:new Date(closed).toISOString(),observedAt:null,receivedAt:stamp(series.receivedAt),
    data:{price:last.close,changePct:previous?.close>0?(last.close/previous.close-1)*100:null,bars:bars.slice(-300).map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume})),timeframe:'1d'}};
  }catch(error){return {...base,failureCode:['AUTH_FAILED','PLAN_REQUIRED','RATE_LIMITED','SOURCE_NOT_CONFIGURED','NETWORK_UNAVAILABLE','MARKET_DATA_UNAVAILABLE'].includes(error?.code)?error.code:'SOURCE_UNAVAILABLE'};}
 }
 return async(market,{universe='default',symbol=null}={})=>{
  // The stable scan selection is shared by all views; symbols never rotate it.
  const selection=assets(market,universe).slice(0,market==='dr'?6:market==='us'?10:8);
  const now=clock(),shared=sharedMode(),key=(shared?'shared:':'native:')+market+':'+universe,hit=cache.get(key);
  let rows;
  if(hit&&now-hit.at<60000)rows=hit.rows;
  else{
   if(!pending.has(key))pending.set(key,(async()=>{
    const result=[];for(let i=0;i<selection.length;i+=2)result.push(...await Promise.all(selection.slice(i,i+2).map(a=>read(a,market,now,shared))));
    cache.set(key,{at:now,rows:result});return result;
   })().finally(()=>pending.delete(key)));
   rows=await pending.get(key);
  }
  return symbol?rows.filter(r=>r.symbol===symbol):rows;
 };
}
