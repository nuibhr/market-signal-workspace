import YahooFinance from 'yahoo-finance2';
import {newYorkParts} from './fmp-us.mjs';
const yahoo=new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(12000)}),queue:{concurrency:2}});
const cache=new Map(),pending=new Map();
const error=code=>Object.assign(new Error(code),{code});
const durations={'15m':900,'1h':3600};
const dayIn=(ms,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function yahooInstrument(asset){
 if(['thai','dr'].includes(asset.id))return {ticker:`${asset.symbol}.BK`,currency:'THB',zone:'Asia/Bangkok',exchange:'SET'};
 if(asset.id==='us')return {ticker:asset.symbol,currency:'USD',zone:'America/New_York'};
 if(asset.id==='forex'&&/^[A-Z]{3}\/[A-Z]{3}$/.test(asset.symbol)&&!asset.symbol.startsWith('XAU')&&!asset.symbol.startsWith('XAG'))return {ticker:`${asset.symbol.replace('/','')}=X`,currency:asset.symbol.split('/')[1],zone:'UTC',exchange:'CCY'};
 return null;
}
export async function getYahooHistory(asset,timeframe='1d'){
 const instrument=yahooInstrument(asset);
 if(!instrument)throw error('INSTRUMENT_NOT_SUPPORTED');
 if(!['15m','1h','1d'].includes(timeframe))throw error('TIMEFRAME_NOT_AVAILABLE');
 const key=`${asset.instrumentId}:${timeframe}`,hit=cache.get(key);
 if(hit?.expires>Date.now())return hit.value;
 if(pending.has(key))return pending.get(key);
 const job=load(asset,instrument,timeframe).finally(()=>pending.delete(key));pending.set(key,job);return job;
}
async function load(asset,instrument,timeframe){
 const now=Date.now(),days=timeframe==='1d'?1100:timeframe==='15m'?59:700;
 let result;
 try{result=await yahoo.chart(instrument.ticker,{period1:new Date(now-days*86400000),interval:timeframe});}catch{throw error('HISTORY_UNAVAILABLE');}
 if(result.meta?.symbol!==instrument.ticker||result.meta?.currency!==instrument.currency||instrument.exchange&&result.meta?.exchangeName!==instrument.exchange)throw error('INSTRUMENT_MISMATCH');
 const today=dayIn(now,instrument.zone),usClock=newYorkParts(now);
 const dailyClosed=asset.id==='us'&&!['Sat','Sun'].includes(usClock.weekday)&&usClock.minutes>=990;
 const byTime=new Map(),duplicates=new Set();
 for(const q of result.quotes??[]){
  const ms=new Date(q.date).getTime(),time=timeframe==='1d'?dayIn(ms,instrument.zone):Math.floor(ms/1000);
  if(!Number.isFinite(ms)||ms>now||timeframe==='1d'&&(time>today||time===today&&!dailyClosed)||timeframe!=='1d'&&(time+durations[timeframe])*1000>now)continue;
  if(![q.open,q.high,q.low,q.close].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||q.high<Math.max(q.open,q.close,q.low)||q.low>Math.min(q.open,q.close))continue;
  const volume=asset.id==='forex'?0:q.volume;
  if(!Number.isFinite(volume)||volume<0)continue;
  if(byTime.has(time)){byTime.delete(time);duplicates.add(time);continue;}if(duplicates.has(time))continue;
  byTime.set(time,{time,open:q.open,high:q.high,low:q.low,close:q.close,volume});
 }
 const bars=[...byTime.values()].sort((a,b)=>a.time<b.time?-1:1).slice(-5000);
 if(!bars.length)throw error('BARS_UNAVAILABLE');
 const last=bars.at(-1),latestDay=timeframe==='1d'?last.time:dayIn(last.time*1000,instrument.zone);
 const age=timeframe==='1d'?now-Date.parse(`${latestDay}T00:00:00Z`):now-(last.time+durations[timeframe])*1000;
 const value={status:'available',instrumentId:asset.instrumentId,symbol:asset.symbol,market:asset.id,source:'Yahoo Finance · Historical',sourceTicker:instrument.ticker,currency:instrument.currency,timeframe,receivedAt:new Date().toISOString(),latestDay,latestTime:timeframe==='1d'?null:new Date(last.time*1000).toISOString(),freshness:age<(timeframe==='1d'?5*86400000:2*86400000)?'recent':'stale',bars,availableBars:bars.length,signalEligible:false,chartOnly:true,quote:null,note:'ข้อมูลย้อนหลังสำหรับกราฟ · ไม่ยืนยันความหน่วงเรียลไทม์ และไม่ใช้เป็นเงื่อนไข AutoPick'};
 cache.set(`${asset.instrumentId}:${timeframe}`,{value,expires:now+300000});if(cache.size>64)cache.delete(cache.keys().next().value);
 return value;
}
