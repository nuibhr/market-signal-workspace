import fs from 'node:fs/promises';
import path from 'node:path';
import YahooFinance from 'yahoo-finance2';
import {getYahooUsDailyBars} from '../src/market-data/us-eod.mjs';
import {US_WATCHLIST} from '../src/markets/us-watchlist.mjs';

// Manual catalog maintenance. Only publish a complete list after real OHLCV checks.
const dir=path.resolve('data/us-etfs');
await fs.mkdir(dir,{recursive:true,mode:0o700});
const asOf=(await getYahooUsDailyBars('AAPL')).latestDay;
const now=Date.parse(`${asOf}T23:59:59Z`), start=new Date(`${asOf}T00:00:00Z`);start.setUTCMonth(start.getUTCMonth()-3);
const from=start.toISOString().slice(0,10), silent=()=>{}, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const yahoo=new YahooFinance({versionCheck:false,suppressNotices:['yahooSurvey'],queue:{concurrency:1},
  logger:{info:silent,warn:silent,error:silent,debug:silent,dir:silent},fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(15000)})});
const save=async(file,data)=>{const target=path.join(dir,file),temp=`${target}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,target);};
const read=async file=>{try{return JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));}catch{return null;}};
const base=US_WATCHLIST.filter(x=>x.kind==='etf').map(x=>x.symbol==='SPLG'?{...x,symbol:'SPYM',previousSymbol:'SPLG'}:x);
const pool=new Map();
for(const [file,nasdaq] of [['nasdaqlisted',true],['otherlisted',false]]){
  const r=await fetch(`https://www.nasdaqtrader.com/dynamic/symdir/${file}.txt`,{signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('DIRECTORY_UNAVAILABLE');
  const text=await r.text();if(!text.startsWith(nasdaq?'Symbol|':'ACT Symbol|'))throw Error('INVALID_DIRECTORY');
  const lines=text.trim().split(/\r?\n/),headers=lines.shift().split('|');
  for(const line of lines){const row=Object.fromEntries(line.split('|').map((v,i)=>[headers[i],v]));
    if(row.ETF!=='Y'||row['Test Issue']!=='N')continue;
    const symbol=nasdaq?row.Symbol:row['ACT Symbol'],name=row['Security Name'];
    if(!/^[A-Z][A-Z0-9-]{0,11}$/.test(symbol))continue;
    // Expansion favors ordinary funds; exclude leveraged/inverse and ETNs by directory name.
    if(/\b(ultra|ultrapro|ultrashort|bull|bear|inverse|leveraged|2x|3x|daily|etn|notes)\b/i.test(name))continue;
    pool.set(symbol,{symbol,name,exchange:nasdaq?'NASDAQ':'US'});
  }
}
let quotes=await read(`quotes-${asOf}.json`);
if(!quotes){quotes=[];const symbols=[...pool.keys()];
  for(let i=0;i<symbols.length;i+=100){const batch=symbols.slice(i,i+100);const response=await yahoo.quote(batch,{}, {validateResult:false});
    for(const q of response){if(!batch.includes(q.symbol)||q.quoteType!=='ETF'||q.currency!=='USD'||!['NMS','NGM','NCM','NYQ','ASE','PCX','BTS'].includes(q.exchange)||!(q.regularMarketPrice>0)||!(q.averageDailyVolume3Month>0))continue;
      quotes.push({...pool.get(q.symbol),name:q.longName||q.shortName||pool.get(q.symbol).name,preliminaryDollarVolume:q.regularMarketPrice*q.averageDailyVolume3Month});}
    if(i%500===0)console.log(JSON.stringify({phase:'etf-quotes',processed:Math.min(i+100,symbols.length),total:symbols.length}));await sleep(700);
  }
  quotes.sort((a,b)=>b.preliminaryDollarVolume-a.preliminaryDollarVolume);await save(`quotes-${asOf}.json`,quotes);
}
const baseMap=new Map(base.map(x=>[x.symbol,x]));
const candidates=[...new Map([...base,...quotes.slice(0,150).map(x=>({...baseMap.get(x.symbol),...x}))].map(x=>[x.symbol,x])).values()],accepted=[],excluded=[];
for(const item of candidates){
  let series=await read(`${item.symbol}-${asOf}.json`);
  try{if(!series){series=await getYahooUsDailyBars(item.symbol,{now,assetKind:'etf'});await save(`${item.symbol}-${asOf}.json`,series);}}
  catch(error){if(error.code==='RATE_LIMITED')throw Error('RATE_LIMITED');excluded.push({symbol:item.symbol,code:error.code||'SOURCE_UNAVAILABLE'});continue;}
  const bars=series.bars.filter(b=>b.time>=from&&b.time<=asOf);
  if(series.symbol!==item.symbol||series.instrumentType!=='ETF'||series.latestDay!==asOf||series.bars.length<60||bars.length<50||!bars.some(b=>b.volume>0)){excluded.push({symbol:item.symbol,code:'INCOMPLETE_OR_STALE_HISTORY'});continue;}
  accepted.push({...item,kind:'etf',theme:item.theme||'ETF สภาพคล่องสูง',averageDollarVolume:Math.round(bars.reduce((s,b)=>s+b.close*b.volume,0)/bars.length),periodBars:bars.length,latestDay:asOf,scannerBars:series.bars.length});
  if((accepted.length+excluded.length)%25===0)console.log(JSON.stringify({phase:'etf-history',processed:accepted.length+excluded.length,total:candidates.length,available:accepted.length}));
}
accepted.sort((a,b)=>b.averageDollarVolume-a.averageDollarVolume);
const kept=base.map(b=>accepted.find(x=>x.symbol===b.symbol)).filter(Boolean),keptSet=new Set(kept.map(x=>x.symbol));
const additions=accepted.filter(x=>!keptSet.has(x.symbol)).slice(0,100-kept.length);
const etfs=[...kept,...additions].sort((a,b)=>b.averageDollarVolume-a.averageDollarVolume).map((x,i)=>({...x,popularityRank:i+1}));
const metadata={asOf,from,count:etfs.length,previousCount:base.length,retainedCount:kept.length,addedCount:additions.length,verifiedCandidates:accepted.length,excludedCount:excluded.length,
  criterion:'Preserve verified existing funds; expand by trailing three-month mean daily close × volume among the top 150 liquid ordinary ETF candidates',source:'Nasdaq Trader ETF directory + Yahoo Finance USD ETF quotes + closed daily OHLCV',signalMode:'TECHNICAL_REVIEW_ONLY',updatedAt:new Date().toISOString()};
await save('report.json',{metadata,etfs,excluded});
if(etfs.length!==100)throw Error('LESS_THAN_100_VERIFIED_ETFS');
const target=path.resolve('src/markets/us-etfs.mjs');
await fs.writeFile(`${target}.tmp`,'// Generated by scripts/build-us-etfs.mjs. Chart coverage does not mean an AutoPick entry.\n'+`export const US_ETF_METADATA = ${JSON.stringify(metadata,null,2)};\nexport const US_VERIFIED_ETFS = ${JSON.stringify(etfs,null,2)};\n`);
await fs.rename(`${target}.tmp`,target);console.log(JSON.stringify({phase:'complete',...metadata,top:etfs.slice(0,8).map(x=>x.symbol)}));
