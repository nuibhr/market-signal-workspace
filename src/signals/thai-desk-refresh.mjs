import {storage} from '../storage/database.mjs';
import {signalUniverse,loadSignalFrame} from './data.mjs';
import {loadThaiBenchmark,loadThaiProfile} from './thai-context.mjs';
import {evaluateMinerviniStage2} from '../analysis/minervini-stage2.mjs';
import {analyzeCandles} from '../analysis/technical.mjs';
import {defaultSignalCosts} from './store.mjs';
export const THAI_DESK_PREFIX='thai-desk-observation:';
export function createThaiDeskRefresh({db=storage,load=loadSignalFrame,benchmark=loadThaiBenchmark,profile=loadThaiProfile,clock=Date.now}={}){
 const pending=new Map();
 return async function refresh(symbols){
  const assets=new Map(signalUniverse('thai').map(a=>[a.symbol,a]));
  if(!Array.isArray(symbols)||!symbols.length||symbols.length>8||symbols.some(s=>!assets.has(s)))throw Object.assign(Error('INVALID_SYMBOLS'),{code:'INVALID_SYMBOLS'});
  const unique=[...new Set(symbols)],now=clock();
  const cached=await db.all("SELECT id,payload_json FROM provider_cache WHERE id LIKE 'thai-desk-observation:%' AND expires_at>?",now);
  const hits=new Map(cached.map(r=>[r.id.slice(THAI_DESK_PREFIX.length),JSON.parse(r.payload_json)]));
  const needed=unique.filter(s=>!hits.has(s));
  async function profiles(){for(let i=0;i<unique.length;i+=2)await Promise.all(unique.slice(i,i+2).map(symbol=>profile(symbol).catch(()=>null)));}
  if(!needed.length){await profiles();return {requested:unique.length,loaded:0,cached:unique.length};}
  const index=await benchmark().catch(()=>({bars:[]}));
  let loaded=0;
  async function one(symbol){
   if(pending.has(symbol))return pending.get(symbol);
   const task=(async()=>{
    let snapshot;
    try{
     const asset=assets.get(symbol),daily=await load(asset,'1d');
     if(daily.symbol!==symbol||![asset.instrumentId,'SET:'+symbol].includes(daily.instrumentId)||daily.timeframe!=='1d')throw Object.assign(Error('INSTRUMENT_MISMATCH'),{code:'INSTRUMENT_MISMATCH'});
     const assessment=evaluateMinerviniStage2(daily.bars,{benchmarkBars:index?.bars??[],now:clock(),costs:defaultSignalCosts(asset)});
     const d=analyzeCandles(daily.bars,null,'D1',{timeframe:'1d',now:clock()}),last=daily.bars.at(-1);
     assessment.technical={rsi:d?.rsi14??null,macdHistogram:d?.macdHistogram??null};
     assessment.volumeBreakout=Boolean(assessment.price>Math.max(...daily.bars.slice(-21,-1).map(b=>b.high))&&assessment.rvol>1.5&&d?.macdHistogram>0);
     assessment.pullback=Boolean(assessment.ema20&&last.low<=Math.max(assessment.ema20,assessment.ema50)*1.01&&last.close>=assessment.ema20&&last.close<=Math.max(assessment.ema20,assessment.ema50)*1.03&&last.close>=last.open);
     snapshot={market:'thai',symbol,status:'UNAVAILABLE',code:'ASSESSMENT_ONLY',checkedAt:new Date(clock()).toISOString(),source:daily.source,stage2:assessment};
     loaded++;
    }catch(error){snapshot={market:'thai',symbol,status:'UNAVAILABLE',code:error.code||'SOURCE_UNAVAILABLE',checkedAt:new Date(clock()).toISOString()};}
    // Separate price/assessment cache: never publishes or modifies a signal/ledger.
    await db.run('INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at',THAI_DESK_PREFIX+symbol,JSON.stringify(snapshot),clock()+(snapshot.stage2?600000:60000));
   })().finally(()=>pending.delete(symbol));
   pending.set(symbol,task);return task;
  }
  for(let i=0;i<needed.length;i+=2)await Promise.all(needed.slice(i,i+2).map(one));
  // Bounded visible-page metadata uses its own provider/rights checks and cache.
  await profiles();
  return {requested:unique.length,loaded,cached:unique.length-needed.length};
 };
}
export const refreshThaiDesk=createThaiDeskRefresh();
