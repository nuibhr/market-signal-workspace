import {delayedChartSnapshot,delayedChartSeries,candleClosedAt} from './delayed-candles.mjs';
import {storage} from '../storage/database.mjs';
export const sharedDaily=()=>process.env.SHARED_MARKET_DATA_MODE==='daily';
export const scanAgeMinutes=market=>sharedDaily()?36*60:market==='us'?60:20;
const publicCache=new Map();
export async function sharedCached(key,load){
 if(!sharedDaily())return load();
 const hit=publicCache.get(key);if(hit&&hit.until>Date.now())return hit.value;
 const value=Promise.resolve().then(load);publicCache.set(key,{value,until:Date.now()+300000});
 if(publicCache.size>1500)publicCache.delete(publicCache.keys().next().value);
 try{return await value;}catch(e){publicCache.delete(key);throw e;}
}
export async function sharedSeries(asset,timeframe){
 const value=await sharedCached(`series:${asset.instrumentId}:${timeframe}`,()=>delayedChartSnapshot(asset,timeframe));
 if(!value)throw Object.assign(Error('SHARED_SNAPSHOT_PENDING'),{code:'SHARED_SNAPSHOT_PENDING'});
 return {...value,shared:true,dataMode:'daily-snapshot',live:false,signalEligible:false,executionEligible:false,chartOnly:true,
  snapshotAt:value.receivedAt,note:'ข้อมูลส่วนกลางรอบรายวัน ใช้ร่วมกันทุกสมาชิก ดูเวลาข้อมูลก่อนใช้ ไม่ใช่ราคาสด'};
}
export async function sharedSeriesResponse(asset,timeframe,headers){
 try{return Response.json(await sharedSeries(asset,timeframe),{headers});}
 catch{return Response.json({status:'unavailable',code:'SHARED_SNAPSHOT_PENDING',message:'ยังไม่มีข้อมูลส่วนกลางของสินทรัพย์/กรอบเวลานี้ รอรอบรายวันหรือเชื่อมแหล่งข้อมูลส่วนตัวที่รองรับ'},{status:503,headers});}
}
export function canonicalSharedSeries(series,asset){
 if(series?.symbol!==asset.symbol)return null;
 if(series.instrumentId===asset.instrumentId)return series;
 if(['thai','dr'].includes(asset.id)&&series.instrumentId===`SET:${asset.symbol}`)return {...series,instrumentId:asset.instrumentId};
 return null;
}
export async function publishSharedSeries(series,asset,timeframe,now=Date.now()){
 series=canonicalSharedSeries(series,asset);
 const checked=delayedChartSeries(series,asset,timeframe,now);
 if(!checked)throw Object.assign(Error('INVALID_SHARED_SERIES'),{code:'INVALID_SHARED_SERIES'});
 const clean={instrumentId:asset.instrumentId,symbol:asset.symbol,timeframe,market:asset.id,source:series.source,receivedAt:new Date(now).toISOString(),bars:checked.bars};
 await storage.run(`INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at WHERE json_extract(excluded.payload_json,'$.dataAsOfMs') >= json_extract(provider_cache.payload_json,'$.dataAsOfMs')`,
  `chart-snapshot-v1:${asset.id}:${asset.instrumentId}:${timeframe}`,JSON.stringify({dataAsOfMs:candleClosedAt(checked.bars.at(-1),timeframe,asset.id),series:clean}),now+7*86400000);
}
export async function sharedQuote(asset){
 const series=await sharedSeries(asset,'1d'),last=series.bars.at(-1),prior=series.bars.at(-2);
 return {status:'available',symbol:asset.symbol,instrumentId:asset.instrumentId,price:last.close,changePercent:prior?.close?(last.close/prior.close-1)*100:null,
  high:last.high,low:last.low,volume:last.volume,source:series.source,observedAt:series.dataAsOf,receivedAt:series.receivedAt,freshness:'daily-snapshot',live:false,dataMode:'daily-snapshot'};
}
