import YahooFinance from 'yahoo-finance2';
import {newYorkParts} from './fmp-us.mjs';
import {delayedChartSeries} from './delayed-candles.mjs';
import {sharedDaily,sharedSeries} from './shared-policy.mjs';
const createYahoo=()=>new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(12000)}),queue:{concurrency:2}});
const yahoo=createYahoo();
const cache=new Map(),pending=new Map();
const error=code=>Object.assign(new Error(code),{code});
const durations={'15m':900,'1h':3600};
const dayIn=(ms,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function isYahooCandleStart(ms,timeframe,market){
 if(!Number.isFinite(ms)||ms%60000!==0)return false;
 if(timeframe==='15m'&&ms%900000!==0)return false;
 if(market==='us'){
  const clock=newYorkParts(ms);
  if(['Sat','Sun'].includes(clock.weekday)||clock.minutes<570||clock.minutes>=960)return false;
  if(timeframe==='1h'&&clock.minutes%60!==30)return false;
 }
 return true;
}
export function yahooInstrument(asset){
 if(['thai','dr'].includes(asset.id))return {ticker:`${asset.symbol}.BK`,currency:'THB',zone:'Asia/Bangkok',exchange:'SET'};
 if(asset.id==='us')return {ticker:asset.symbol,currency:'USD',zone:'America/New_York'};
 if(asset.id==='forex'){
  if(asset.symbol==='XAU/USD'||asset.symbol==='XAUUSD')return {ticker:'GC=F',currency:'USD',zone:'UTC',exchange:'CMX'};
  if(asset.symbol==='XAG/USD'||asset.symbol==='XAGUSD')return {ticker:'SI=F',currency:'USD',zone:'UTC',exchange:'CMX'};
  if(/^[A-Z]{3}\/[A-Z]{3}$/.test(asset.symbol))return {ticker:`${asset.symbol.replace('/','')}=X`,currency:asset.symbol.split('/')[1],zone:'UTC',exchange:'CCY'};
  if(/^[A-Z]{6}$/.test(asset.symbol))return {ticker:`${asset.symbol}=X`,currency:asset.symbol.slice(3),zone:'UTC',exchange:'CCY'};
 }
 return null;
}
export async function getYahooHistory(asset,timeframe='1d',options={}){
 if(sharedDaily()&&!options.chartFetcher)return sharedSeries(asset,timeframe);
 const instrument=yahooInstrument(asset);
 if(!instrument)throw error('INSTRUMENT_NOT_SUPPORTED');
 if(!['15m','1h','1d'].includes(timeframe))throw error('TIMEFRAME_NOT_AVAILABLE');
 if(options.chartFetcher)return load(asset,instrument,timeframe,options);
 const key=`${asset.instrumentId}:${timeframe}`,hit=cache.get(key);
 if(hit?.expires>Date.now()){
  const value=asset.id==='forex'?hit.value:delayedChartSeries(hit.value,asset,timeframe,Date.now(),'yahoo');
  if(!value)throw error('BARS_UNAVAILABLE');return value;
 }
 // SDK queues and cookie discovery may only use I/O from their invocation.
 if(process.env.STORAGE_PROVIDER==='d1'){
  const client=createYahoo();return load(asset,instrument,timeframe,{chartFetcher:client.chart.bind(client)});
 }
 if(pending.has(key))return pending.get(key);
 const job=load(asset,instrument,timeframe).finally(()=>pending.delete(key));pending.set(key,job);return job;
}
async function load(asset,instrument,timeframe,{now=Date.now(),chartFetcher=yahoo.chart.bind(yahoo)}={}){
 const days=timeframe==='1d'?1100:timeframe==='15m'?59:700;
 let result;
 try{result=await chartFetcher(instrument.ticker,{period1:new Date(now-days*86400000),period2:new Date(now),interval:timeframe,includePrePost:false});}catch{throw error('HISTORY_UNAVAILABLE');}
 if(result.meta?.symbol!==instrument.ticker||result.meta?.currency!==instrument.currency||instrument.exchange&&result.meta?.exchangeName!==instrument.exchange)throw error('INSTRUMENT_MISMATCH');
 if(asset.id==='us'&&(!['NMS','NGM','NCM','NYQ','ASE','PCX','BTS'].includes(result.meta?.exchangeName)||result.meta?.instrumentType!==(asset.sectionId==='US_ETFS'?'ETF':'EQUITY')))throw error('INSTRUMENT_MISMATCH');
 const today=dayIn(now,instrument.zone),usClock=newYorkParts(now);
 const dailyClosed=asset.id==='us'&&!['Sat','Sun'].includes(usClock.weekday)&&usClock.minutes>=990;
 const byTime=new Map(),duplicates=new Set();
 const scale=instrument.scale||1;
 for(const q of result.quotes??[]){
  const ms=new Date(q.date).getTime(),time=timeframe==='1d'?dayIn(ms,instrument.zone):Math.floor(ms/1000);
  // Yahoo may append a live quote timestamp to chart data. A seconds-level
  // observation is not a completed 15m/1h candle and must not be relabelled.
  if(timeframe!=='1d'&&!isYahooCandleStart(ms,timeframe,asset.id))continue;
  if(!Number.isFinite(ms)||ms>now||timeframe==='1d'&&(time>today||time===today&&!dailyClosed)||timeframe!=='1d'&&(time+durations[timeframe])*1000>now)continue;
  if(![q.open,q.high,q.low,q.close].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||q.high<Math.max(q.open,q.close,q.low)||q.low>Math.min(q.open,q.close))continue;
  const volume=asset.id==='forex'||asset.id==='tfex'?(q.volume||1):q.volume;
  if(!Number.isFinite(volume)||volume<0)continue;
  if(byTime.has(time)){byTime.delete(time);duplicates.add(time);continue;}if(duplicates.has(time))continue;
  byTime.set(time,{time,open:Number((q.open*scale).toFixed(2)),high:Number((q.high*scale).toFixed(2)),low:Number((q.low*scale).toFixed(2)),close:Number((q.close*scale).toFixed(2)),volume});
 }
 const bars=[...byTime.values()].sort((a,b)=>a.time<b.time?-1:1).slice(-5000);
 if(!bars.length)throw error('BARS_UNAVAILABLE');
 const last=bars.at(-1),latestDay=timeframe==='1d'?last.time:dayIn(last.time*1000,instrument.zone);
 const age=timeframe==='1d'?now-Date.parse(`${latestDay}T00:00:00Z`):now-(last.time+durations[timeframe])*1000;
 let value={status:'available',instrumentId:asset.instrumentId,symbol:asset.symbol,market:asset.id,source:'Yahoo Finance · Historical',sourceTicker:instrument.ticker,currency:instrument.currency,timeframe,receivedAt:new Date(now).toISOString(),latestDay,latestTime:timeframe==='1d'?null:new Date(last.time*1000).toISOString(),freshness:age<(timeframe==='1d'?5*86400000:2*86400000)?'recent':'stale',bars,availableBars:bars.length,signalEligible:false,chartOnly:true,quote:null,note:'ข้อมูลย้อนหลังสำหรับกราฟ · ไม่ยืนยันความหน่วงเรียลไทม์ และไม่ใช้เป็นเงื่อนไข AutoPick'};
 if(asset.id!=='forex') {value=delayedChartSeries(value,asset,timeframe,now,'yahoo');if(!value)throw error('BARS_UNAVAILABLE');}
 cache.set(`${asset.instrumentId}:${timeframe}`,{value,expires:now+300000});if(cache.size>64)cache.delete(cache.keys().next().value);
 return value;
}
