import YahooFinance from 'yahoo-finance2';
import {storage} from '../storage/database.mjs';
import {createSettradeClient} from '../market-data/settrade.mjs';
const silent=()=>{};
const yahoo=new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,logger:{info:silent,warn:silent,error:silent,debug:silent,dir:silent},fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)})});
const pending=new Map();
const native=createSettradeClient();
const permitted=()=>process.env.NODE_ENV!=='production'||process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED==='true';
export async function cachedThaiContext(id,now=Date.now()){
 const r=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?',id,now);
 return r?JSON.parse(r.payload_json):null;
}
async function remember(id,ttl,load){
 const hit=await cachedThaiContext(id);if(hit)return hit;
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{let value;try{value=await load();}catch{value={status:'unavailable',code:'CONTEXT_SOURCE_UNAVAILABLE'};}
  await storage.run('INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at',id,JSON.stringify(value),Date.now()+(value.status==='available'?ttl:600000));return value;
 })().finally(()=>pending.delete(id));pending.set(id,task);return task;
}
export async function loadThaiBenchmark(){
 const nativeAllowed=process.env.NODE_ENV!=='production'||process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED==='true';
 if(!permitted()&&!nativeAllowed)return {status:'unavailable',code:'DISPLAY_RIGHTS_NOT_CONFIRMED',bars:[]};
 return remember('thai-stage2-benchmark-v2',600000,async()=>{
  if(nativeAllowed&&native.configuration.configured){
   try{const result=await native.getCandles('SET','1d',500);
    if(result.symbol==='SET'&&result.status==='available'&&result.bars.length>=64)return {status:'available',symbol:'SET',source:'Settrade · SET Index D1',checkedAt:new Date().toISOString(),bars:result.bars.map(b=>({time:b.time,close:b.close}))};
   }catch{/* Exact SET index only; never substitute a constituent/SET50 ETF. */}
  }
  if(!permitted())throw Error('INDEX_UNAVAILABLE');
  const now=Date.now(),result=await yahoo.chart('^SET.BK',{period1:new Date(now-3*366*86400000),period2:new Date(now),interval:'1d'},{validateResult:false});
  if(result.meta?.symbol!=='^SET.BK'||result.meta?.currency!=='THB'||result.meta?.instrumentType!=='INDEX'||result.meta?.exchangeName!=='SET')throw Error('INDEX_MISMATCH');
  const bars=result.quotes.flatMap(q=>Number.isFinite(q.close)&&q.close>0?[{time:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(q.date),close:q.close}]:[]);
  return {status:'available',symbol:'SET',source:'Yahoo Finance · SET Index D1',checkedAt:new Date(now).toISOString(),bars};
 });
}
// These are provider industry groups, explicitly labelled as such in the UI;
// they are not an assertion of official SET sector or SETHD membership.
export function providerSectorCode(sector='',industry=''){
 const text=`${sector} ${industry}`.toLowerCase();
 return /bank/.test(text)?'BANK':/telecom|software|information technology/.test(text)?'ICT':/semiconductor|electronic/.test(text)?'ETRON':/energy|utilities|oil|gas/.test(text)?'ENERG':/retail|department stores/.test(text)?'COMM':/medical|hospital|healthcare/.test(text)?'HELTH':/real estate/.test(text)?'PROP':/food|beverage/.test(text)?'FOOD':null;
}
export async function loadThaiProfile(symbol){
 if(!/^[A-Z0-9-]{1,20}$/.test(symbol)||!permitted())return null;
 return remember(`thai-stage2-profile:${symbol}`,86400000,async()=>{
  const q=await yahoo.quoteSummary(`${symbol}.BK`,{modules:['price','summaryDetail','assetProfile']});
  if(q.price?.symbol!==`${symbol}.BK`||q.price?.currency!=='THB')throw Error('PROFILE_MISMATCH');
  const detail=q.summaryDetail??{},profile=q.assetProfile??{};
  const positive=v=>Number.isFinite(v)&&v>0?v:null;
  return {status:'available',symbol,name:q.price.longName??symbol,source:'Yahoo Finance · company profile',checkedAt:new Date().toISOString(),
   pe:positive(detail.trailingPE),dividendPercent:Number.isFinite(detail.dividendYield)&&detail.dividendYield>=0?detail.dividendYield*100:null,
   sector:profile.sector??null,industry:profile.industry??null,sectorCode:providerSectorCode(profile.sector,profile.industry),sethd:null};
 });
}
