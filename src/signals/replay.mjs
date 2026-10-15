import { loadSignalFrame } from './data.mjs';
import { inspectSignalBars, candidateViews, startReferenceSignal, advanceReferenceSignal, summarizeSignals, closedAvailable } from './model.mjs';

// Replay the exact forward reference rules over observed bars. This reports
// available history, never asserts full exchange-calendar coverage or 3 years.
export function replaySignalBars(asset, daily, four, execution, costs) {
  const variants = [];
  for (const mode of ['breakout','pullback']) {
    let active=null, snapshot={status:'UNAVAILABLE'}, last4h=null; const records=[], seen=new Set();
    for(const bar of execution) {
      const now=(bar.time+1800)*1000, availableFour=closedAvailable(four,'4h',asset.id,now);
      if(availableFour.at(-1)?.time!==last4h) {
        last4h=availableFour.at(-1)?.time;
        snapshot=inspectSignalBars(asset,daily,availableFour,now);
      }
      if(active) {
        const result=advanceReferenceSignal(active,[bar],snapshot,now); active=result.signal;
        if(!['WAITING','OPEN','RUNNER'].includes(active.status)){ records.push(active);active=null; }
      }
      if(!active && snapshot.status==='AVAILABLE') {
        const view=candidateViews(snapshot,costs).find(v=>v.mode===mode);
        const key=`${mode}:${snapshot.latest4hTime}`;
        if(view.state==='PASS'&&!seen.has(key)) { active=startReferenceSignal(view,'replay',now); seen.add(key); }
      }
    }
    const all=active?[...records,active]:records;
    variants.push({mode,statistics:summarizeSignals(all),records:all});
  }
  return {status:'observed-bars-replay',strategyValidated:false,ruleVersion:'swing-standard-forward-v1',symbol:asset.symbol,market:asset.id,
    period:{from:execution.length?new Date(execution[0].time*1000).toISOString():null,to:execution.length?new Date((execution.at(-1).time+900)*1000).toISOString():null},
    counts:{daily:daily.length,fourHour:four.length,execution:execution.length},variants,costs,
    limitations:['Observed bars only; full exchange calendar/adjustment coverage unverified','Missing regular-session bars and unresolved TP/Stop order remain REVIEW',
      'LONG reference signals; no broker fills, dividends, FX cash flow or portfolio', 'Historical sample is not out-of-sample proof']};
}
export async function loadSignalReplay(asset,costs) {
  const daily=await loadSignalFrame(asset,'1d'), four=await loadSignalFrame(asset,'4h'), execution=await loadSignalFrame(asset,'15m');
  return {...replaySignalBars(asset,daily.bars,four.bars,execution.bars,costs),sources:{daily:daily.source,fourHour:four.source,execution:execution.source}};
}
