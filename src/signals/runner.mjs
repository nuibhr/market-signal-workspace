import { signalUniverse, loadSignalFrame, signalProviderAllowed } from './data.mjs';
import { inspectSignalBars, candidateViews, startReferenceSignal, advanceReferenceSignal } from './model.mjs';
import { activeReferenceSignals, allCostProfiles, claimSignalLease, defaultSignalCosts, insertReferenceSignal,
  observationSchedule, storedObservation, releaseSignalLease, saveObservation, saveReferenceAdvance } from './store.mjs';
import {discoveryIntervalMs,monitorDue} from './cadence.mjs';
import {evaluateMinerviniStage2} from '../analysis/minervini-stage2.mjs';
import {analyzeCandles} from '../analysis/technical.mjs';
import {loadThaiBenchmark,loadThaiProfile} from './thai-context.mjs';
import {publishSharedSeries} from '../market-data/shared-policy.mjs';

async function sourceDeadline(task,milliseconds){
  let timer;
  try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('SOURCE_TIMEOUT'),{code:'SOURCE_TIMEOUT'})),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export function createSignalRunner({ load = loadSignalFrame, clock = Date.now, allowed = signalProviderAllowed,getBenchmark=async()=>null,getProfile=async()=>null,sourceTimeoutMs=20000,contextTimeoutMs=8000 } = {}) {
  return async function runSignalScan(market, { symbols = null, force = Boolean(symbols), budgetMs = 20000, maxSymbols = 12, enabled = true } = {}) {
    if (!['thai','dr','us'].includes(market) || !enabled || !allowed(market)) return { status:'blocked',code:'SIGNAL_SOURCE_NOT_READY' };
    const now = clock(), token = await claimSignalLease(market,now,Math.max(120000,budgetMs+60000));
    if (!token) return { status:'busy',scanned:0 };
    let scanned = 0, published = 0; const errors = [];
    try {
      const universe = signalUniverse(market), known = new Map(universe.map(a=>[a.symbol,a]));
      if (symbols && (!Array.isArray(symbols) || symbols.length>8 || symbols.some(s=>!known.has(s)))) return {status:'blocked',code:'INVALID_SYMBOLS'};
      const active = await activeReferenceSignals(market), schedules = new Map((await observationSchedule(market)).map(s=>[s.symbol,s.next_scan_ms]));
      const activeSymbols = [...new Set(active.filter(s=>monitorDue(s,now)).map(s=>s.symbol))];
      // Oldest monitored symbol first, then never-scanned/due candidates. A
      // persisted next_scan_ms prevents a process restart from resetting to A.
      const due = universe.filter(a=>(schedules.get(a.symbol)??0)<=now).sort((a,b)=>(schedules.get(a.symbol)??0)-(schedules.get(b.symbol)??0)).map(a=>a.symbol);
      const monitored = new Set(activeSymbols);
      const queue = [...new Set(symbols || [...activeSymbols.slice(0,Math.max(1,Math.floor(maxSymbols/2))),...due.filter(s=>!monitored.has(s)),...activeSymbols])];
      const profiles = market==='us'?await allCostProfiles():null;
      const deadline = clock()+budgetMs;
      const benchmark=market==='thai'&&queue.some(s=>force||(schedules.get(s)??0)<=now)?await sourceDeadline(getBenchmark(),contextTimeoutMs).catch(()=>null):null;
      let profileTouched=false;
      for (const symbol of queue) {
        if (scanned>=maxSymbols || clock()>=deadline) break;
        const asset = known.get(symbol); if(!asset)continue;
        const existing = active.filter(s=>s.symbol===symbol);
        const discover=force||(schedules.get(symbol)??0)<=now;
        const track=existing.length&&(force||existing.some(s=>monitorDue(s,now)));
        if(!discover&&!track)continue;
        scanned++;
        try {
          // Discovery replaces the snapshot; avoid reading the old payload
          // across the VPS bridge when only monitoring needs it.
          let snapshot=discover?null:await storedObservation(market,symbol);
          if(discover){
            try{
              const daily = await sourceDeadline(load(asset,'1d'),sourceTimeoutMs), four = await sourceDeadline(load(asset,'4h'),sourceTimeoutMs);
              if(process.env.SCANNER_SCHEDULE_MODE==='daily'){
                await publishSharedSeries(daily,asset,'1d',clock());
                await publishSharedSeries(four,asset,'4h',clock());
              }
              snapshot = inspectSignalBars({...asset,signalSource:`D1: ${daily.source} · 4H: ${four.source}`},daily.bars,four.bars,clock());
              if(market==='thai'){
                const assessment=evaluateMinerviniStage2(daily.bars,{benchmarkBars:benchmark?.bars??[],now:clock(),costs:defaultSignalCosts(asset)});
                const d=analyzeCandles(daily.bars,null,'D1',{timeframe:'1d',now:clock()}),last=daily.bars.at(-1);
                assessment.technical={rsi:d?.rsi14??null,macdHistogram:d?.macdHistogram??null};
                assessment.volumeBreakout=Boolean(assessment.price>Math.max(...daily.bars.slice(-21,-1).map(b=>b.high))&&assessment.rvol>1.5&&d?.macdHistogram>0);
                assessment.pullback=Boolean(assessment.ema20&&last.low<=Math.max(assessment.ema20,assessment.ema50)*1.01&&last.close>=assessment.ema20&&last.close<=Math.max(assessment.ema20,assessment.ema50)*1.03&&last.close>=last.open);
                snapshot.stage2=assessment;
                // At most one profile refresh per bounded scan; never 150
                // company requests from a customer's dashboard GET.
                if(!profileTouched){profileTouched=true;await sourceDeadline(getProfile(symbol),contextTimeoutMs).catch(()=>null);}
              }
            }catch(error){
              const code=['SOURCE_TIMEOUT','DISPLAY_RIGHTS_NOT_CONFIRMED','NO_AVAILABLE_CLOSED_BARS','INSTRUMENT_MISMATCH','HISTORY_UNAVAILABLE','TIMEFRAME_NOT_AVAILABLE'].includes(error.code)?error.code:'SOURCE_UNAVAILABLE';
              snapshot={market,symbol,name:asset.name,status:'UNAVAILABLE',code,checkedAt:new Date(clock()).toISOString()};
              errors.push({symbol,code});
            }
            await saveObservation(snapshot,clock()+discoveryIntervalMs(market));
          }
          // Keep the original structural stop if discovery is unavailable/stale.
          // The stored snapshot's actual candle time is retained for trailing.
          const monitorSnapshot=snapshot&&clock()-Date.parse(snapshot.checkedAt)<=20*60000?snapshot:{status:'UNAVAILABLE'};
          if(track) {
            const fifteen=await sourceDeadline(load(asset,'15m'),sourceTimeoutMs);
            for(const previous of existing) {
              const {signal,events}=advanceReferenceSignal(previous,fifteen.bars,monitorSnapshot,clock());
              await saveReferenceAdvance(previous,signal,events);
              previous.status=signal.status;
            }
          }
          if(!discover||snapshot?.status!=='AVAILABLE')continue;
          const costProfiles=profiles || [{id:'standard',costs:defaultSignalCosts(asset)}];
          for(const profile of costProfiles) for(const view of candidateViews(snapshot,profile.costs)) {
            if(view.state!=='PASS' || existing.some(s=>s.profile===profile.id&&s.mode===view.mode&&['WAITING','OPEN','RUNNER'].includes(s.status)))continue;
            // Do not publish an old confirmed setup after a machine wake.
            if(clock()-(view.latest4hTime+14400)*1000>18*3600000)continue;
            if(await insertReferenceSignal(startReferenceSignal(view,profile.id,clock())))published++;
          }
        } catch(error) {
          const code = ['SOURCE_TIMEOUT','DISPLAY_RIGHTS_NOT_CONFIRMED','NO_AVAILABLE_CLOSED_BARS','INSTRUMENT_MISMATCH','HISTORY_UNAVAILABLE','TIMEFRAME_NOT_AVAILABLE'].includes(error.code)?error.code:'SOURCE_UNAVAILABLE';
          errors.push({symbol,code});
        }
      }
      return {status:errors.length?'partial':'complete',scanned,published,errors};
    } finally { await releaseSignalLease(market,token,clock()); }
  };
}
export const runSignalScan = createSignalRunner({getBenchmark:loadThaiBenchmark,getProfile:loadThaiProfile});
