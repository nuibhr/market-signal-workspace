import { signalUniverse, loadSignalFrame, signalProviderAllowed } from './data.mjs';
import { inspectSignalBars, candidateViews, startReferenceSignal, advanceReferenceSignal } from './model.mjs';
import { activeReferenceSignals, allCostProfiles, claimSignalLease, defaultSignalCosts, insertReferenceSignal,
  observationSchedule, releaseSignalLease, saveObservation, saveReferenceAdvance } from './store.mjs';

export function createSignalRunner({ load = loadSignalFrame, clock = Date.now, allowed = signalProviderAllowed } = {}) {
  return async function runSignalScan(market, { symbols = null, budgetMs = 20000, maxSymbols = 12, enabled = true } = {}) {
    if (!['thai','dr','us'].includes(market) || !enabled || !allowed(market)) return { status:'blocked',code:'SIGNAL_SOURCE_NOT_READY' };
    const now = clock(), token = await claimSignalLease(market,now,Math.max(120000,budgetMs+60000));
    if (!token) return { status:'busy',scanned:0 };
    let scanned = 0, published = 0; const errors = [];
    try {
      const universe = signalUniverse(market), known = new Map(universe.map(a=>[a.symbol,a]));
      if (symbols && (!Array.isArray(symbols) || symbols.length>8 || symbols.some(s=>!known.has(s)))) return {status:'blocked',code:'INVALID_SYMBOLS'};
      const active = await activeReferenceSignals(market), schedules = new Map((await observationSchedule(market)).map(s=>[s.symbol,s.next_scan_ms]));
      const activeSymbols = [...new Set(active.map(s=>s.symbol))].sort((a,b)=>(schedules.get(a)??0)-(schedules.get(b)??0));
      // Oldest monitored symbol first, then never-scanned/due candidates. A
      // persisted next_scan_ms prevents a process restart from resetting to A.
      const due = universe.filter(a=>(schedules.get(a.symbol)??0)<=now).sort((a,b)=>(schedules.get(a.symbol)??0)-(schedules.get(b.symbol)??0)).map(a=>a.symbol);
      const monitored = new Set(activeSymbols);
      const queue = [...new Set(symbols || [...activeSymbols.slice(0,Math.max(1,Math.floor(maxSymbols/2))),...due.filter(s=>!monitored.has(s)),...activeSymbols])];
      const profiles = market==='us'?await allCostProfiles():null;
      const deadline = clock()+budgetMs;
      for (const symbol of queue) {
        if (scanned>=maxSymbols || clock()>=deadline) break;
        const asset = known.get(symbol); if(!asset)continue;
        scanned++;
        try {
          const daily = await load(asset,'1d'), four = await load(asset,'4h');
          const snapshot = inspectSignalBars({...asset,signalSource:`D1: ${daily.source} · 4H: ${four.source}`},daily.bars,four.bars,clock());
          await saveObservation(snapshot,clock()+5*60000);
          const existing = active.filter(s=>s.symbol===symbol);
          if(existing.length) {
            const fifteen=await load(asset,'15m');
            for(const previous of existing) {
              const {signal,events}=advanceReferenceSignal(previous,fifteen.bars,snapshot,clock());
              await saveReferenceAdvance(previous,signal,events);
              previous.status=signal.status;
            }
          }
          const costProfiles=profiles || [{id:'standard',costs:defaultSignalCosts(asset)}];
          for(const profile of costProfiles) for(const view of candidateViews(snapshot,profile.costs)) {
            if(view.state!=='PASS' || existing.some(s=>s.profile===profile.id&&s.mode===view.mode&&['WAITING','OPEN','RUNNER'].includes(s.status)))continue;
            // Do not publish an old confirmed setup after a machine wake.
            if(clock()-(view.latest4hTime+14400)*1000>18*3600000)continue;
            if(await insertReferenceSignal(startReferenceSignal(view,profile.id,clock())))published++;
          }
        } catch(error) {
          const code = ['DISPLAY_RIGHTS_NOT_CONFIRMED','NO_AVAILABLE_CLOSED_BARS','INSTRUMENT_MISMATCH','HISTORY_UNAVAILABLE','TIMEFRAME_NOT_AVAILABLE'].includes(error.code)?error.code:'SOURCE_UNAVAILABLE';
          await saveObservation({market,symbol,name:asset.name,status:'UNAVAILABLE',code,checkedAt:new Date(clock()).toISOString()},clock()+5*60000);
          errors.push({symbol,code});
        }
      }
      return {status:errors.length?'partial':'complete',scanned,published,errors};
    } finally { await releaseSignalLease(market,token,clock()); }
  };
}
export const runSignalScan = createSignalRunner();
