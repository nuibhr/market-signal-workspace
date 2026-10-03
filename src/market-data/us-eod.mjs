import YahooFinance from 'yahoo-finance2';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getFmpDailyBars, newYorkParts } from './fmp-us.mjs';

// Closed daily candles can support EOD signals. This adapter never claims a live quote.
const silent = () => {}, pending = new Map();
const yahoo = new YahooFinance({versionCheck:false,suppressNotices:['yahooSurvey'],queue:{concurrency:2},
  logger:{info:silent,warn:silent,error:silent,debug:silent,dir:silent},
  fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})});
let nextRequestAt = 0, fmpRetryAt = 0, yahooRetryAt = 0;
const fail = code => Object.assign(new Error(code),{code});
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function usEodRights() {
  const dev = process.env.NODE_ENV !== 'production';
  return {fmp:dev||process.env.FMP_DISPLAY_RIGHTS_CONFIRMED==='true',
    yahoo:dev||process.env.YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED==='true'};
}
function validSeries(data, symbol, day, allowCurrent, instrumentType) {
  return data?.symbol===symbol&&data.source==='Yahoo Finance · EOD historical'&&data.timeframe==='1d'
    &&(data.instrumentType===instrumentType||instrumentType==='EQUITY'&&data.instrumentType===undefined)
    &&Array.isArray(data.bars)&&data.bars.length>0&&data.bars.length<=300&&data.latestDay===data.bars.at(-1)?.time
    &&data.bars.every((bar,i,bars)=>typeof bar.time==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(bar.time)
      &&bar.time<=day&&(allowCurrent||bar.time!==day)&&(!i||bar.time>bars[i-1].time)
      &&[bar.open,bar.high,bar.low,bar.close].every(positive)&&Number.isFinite(bar.volume)&&bar.volume>=0
      &&bar.high>=Math.max(bar.open,bar.close,bar.low)&&bar.low<=Math.min(bar.open,bar.close));
}
export async function getYahooUsDailyBars(symbol, {now=Date.now(), assetKind='stock'}={}) {
  if(!/^[A-Z][A-Z0-9-]{0,11}$/.test(symbol))throw fail('INVALID_SYMBOL');
  if(!['stock','etf'].includes(assetKind))throw fail('INSTRUMENT_MISMATCH');
  const instrumentType=assetKind==='etf'?'ETF':'EQUITY';
  if(!usEodRights().yahoo)throw fail('DISPLAY_RIGHTS_NOT_CONFIRMED');
  const clock=newYorkParts(now),allowCurrent=!['Sat','Sun'].includes(clock.weekday)&&clock.minutes>=990;
  let closedThrough=clock.day;
  if(!allowCurrent){let date=new Date(Date.parse(`${clock.day}T12:00:00Z`)-86400000);
    while([0,6].includes(date.getUTCDay()))date=new Date(date.getTime()-86400000);
    closedThrough=date.toISOString().slice(0,10);}
  const key=`yahoo-eod-v1:${symbol}:${closedThrough}:true${assetKind==='etf'?':ETF':''}`,file=resolve(process.cwd(),'data','us-yahoo-eod',createHash('sha256').update(key).digest('hex')+'.json');
  if(pending.has(key))return pending.get(key);
  const job=(async()=>{
    try {
      if((await stat(file)).size<100000){const cached=JSON.parse(await readFile(file,'utf8'));
        if(cached.key===key&&cached.expiresAt>Date.now()&&validSeries(cached.data,symbol,clock.day,allowCurrent,instrumentType))return cached.data;}
    }catch{}
    if(Date.now()<yahooRetryAt)throw fail('RATE_LIMITED');
    const scheduled=Math.max(Date.now(),nextRequestAt);nextRequestAt=scheduled+600;
    if(scheduled>Date.now())await new Promise(resolve=>setTimeout(resolve,scheduled-Date.now()));
    if(Date.now()<yahooRetryAt)throw fail('RATE_LIMITED');
    let response;
    try{response=await yahoo.chart(symbol,{period1:new Date(now-550*86400000),period2:new Date(now),interval:'1d'},{validateResult:false});}
    catch(error){if(error?.status===429||error?.statusCode===429){yahooRetryAt=Date.now()+900000;throw fail('RATE_LIMITED');}throw fail('SOURCE_UNAVAILABLE');}
    if(response.meta?.symbol!==symbol||response.meta?.currency!=='USD'||response.meta?.instrumentType!==instrumentType
      ||!['NMS','NGM','NCM','NYQ','ASE','PCX','BTS'].includes(response.meta?.exchangeName))throw fail('INSTRUMENT_MISMATCH');
    const byDay=new Map(),duplicates=new Set();
    for(const quote of response.quotes??[]){
      const ms=new Date(quote.date).getTime();if(!Number.isFinite(ms)||ms>now)continue;
      const day=newYorkParts(ms).day;
      if(day>clock.day||day===clock.day&&!allowCurrent)continue;
      const bar={time:day,open:quote.open,high:quote.high,low:quote.low,close:quote.close,volume:quote.volume};
      if(![bar.open,bar.high,bar.low,bar.close].every(positive)||!Number.isFinite(bar.volume)||bar.volume<0
        ||bar.high<Math.max(bar.open,bar.close,bar.low)||bar.low>Math.min(bar.open,bar.close))continue;
      if(byDay.has(day)){byDay.delete(day);duplicates.add(day);continue;}if(!duplicates.has(day))byDay.set(day,bar);
    }
    const bars=[...byDay.values()].sort((a,b)=>a.time.localeCompare(b.time)).slice(-300);
    if(!bars.length)throw fail('BARS_UNAVAILABLE');
    const data={symbol,instrumentType,source:'Yahoo Finance · EOD historical',timeframe:'1d',live:false,
      receivedAt:new Date().toISOString(),latestDay:bars.at(-1).time,bars};
    try{await mkdir(resolve(process.cwd(),'data','us-yahoo-eod'),{recursive:true,mode:0o700});
      const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify({key,data,expiresAt:Date.now()+(allowCurrent?6*3600000:300000)}),{mode:0o600});await rename(temp,file);}catch{}
    return data;
  })().finally(()=>pending.delete(key));
  pending.set(key,job);return job;
}
export async function getUsDailyBars(symbol, options={}) {
  if(!['stock','etf'].includes(options.assetKind??'stock'))throw fail('INSTRUMENT_MISMATCH');
  const rights=usEodRights();
  if(rights.fmp&&process.env.FMP_API_KEY?.trim()&&Date.now()>=fmpRetryAt){
    try{return await getFmpDailyBars(symbol,options);}
    catch(error){
      // Avoid using hundreds of calls on an exhausted/restricted provider.
      if(error.code==='RATE_LIMITED')fmpRetryAt=Date.now()+24*3600000;
      else if(error.code==='PLAN_REQUIRED')fmpRetryAt=Date.now()+30*60000;
      if(!rights.yahoo)throw error;
    }
  }
  return getYahooUsDailyBars(symbol,options);
}
