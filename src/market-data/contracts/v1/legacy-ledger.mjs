import {summarizeRecordedTrades} from '../../../auto-pick/signal-performance.mjs';
import {RESULT_SCOPE_STATES,resultStatus} from '../../../monitor/results.mjs';
// Historical prices are references, not a current signal or a verified return.
// Select identities once, before filters, details, pagination and statistics.
export function projectLedger(parts,{market,cap,symbols,query={}}){
 const allowed=new Set(symbols);
 const unique=new Map(parts.flatMap(p=>p.rows).filter(r=>r.market===market&&allowed.has(r.symbol)).map(r=>[r.key,r]));
 const chosen=[...unique.values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)||a.key.localeCompare(b.key)).slice(0,cap);
 const rows=chosen.map(r=>({id:r.id,key:r.key,ledger:r.ledger,strategy:r.strategy,market:r.market,symbol:r.symbol,status:r.status,
  publishedAt:r.publishedAt??null,enteredAt:r.enteredAt??null,exitedAt:r.exitedAt??null,entryPrice:r.entryPrice??null,exitPrice:r.exitPrice??null,
  // Current levels and unverified outcome metrics must not escape via a ledger.
  plan:null,outcome:null,costBasis:r.costBasis,signalEligible:false,performanceEligible:false,isLiveFeed:false,events:[]}));
 const filtered=rows.filter(r=>(!query.strategy||query.strategy==='all'||r.strategy===query.strategy)&&(!query.status||query.status==='all'||r.status===query.status)&&
  (query.scope==='closed'?['CLOSED','STOP'].includes(r.status):!RESULT_SCOPE_STATES[query.scope]||RESULT_SCOPE_STATES[query.scope].map(resultStatus).includes(r.status)));
 const counts={};for(const row of filtered)counts[row.status]=(counts[row.status]??0)+1;
 const selected=Number(query.page??1)>1?[]:filtered;
 return {status:filtered.length?'available':'unavailable',market,signals:selected,total:filtered.length,page:1,pageSize:Math.max(1,cap),scope:query.scope??'history',counts,
  selectedKey:selected.some(r=>r.key===query.tradeKey)?query.tradeKey:null,
  summary:{...summarizeRecordedTrades([]),windowSize:cap,entered:filtered.filter(r=>r.enteredAt).length,performanceEligible:false},recentTrades:[],
  sources:[...new Set(filtered.map(r=>r.ledger))].map(ledger=>({ledger,status:'available'})),
  window:{limit:cap,market,basis:'entitled-reference-history',statusIndependent:false},isLiveFeed:false};
}
