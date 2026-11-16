import {storage} from '../storage/database.mjs';
import {signalUniverse} from '../signals/data.mjs';
const dayMs=86400000;
export function dailyWindow(now=Date.now(),hour=7){
 if(!Number.isInteger(hour)||hour<0||hour>23)throw Error('INVALID_DAILY_HOUR');
 const shifted=new Date(now+7*3600000-hour*3600000).toISOString().slice(0,10);
 const start=Date.parse(`${shifted}T${String(hour).padStart(2,'0')}:00:00+07:00`);
 return {key:shifted,start,next:start+dayMs};
}
// The global scanner lease fences checkpoint writes. Reserve a batch before I/O:
// after a crash it is reported as interrupted, never silently fetched a second time.
export function createDailyBatch({db=storage,universe=signalUniverse,run,clock=Date.now,hour=7}={}){
 return async market=>{
  const window=dailyWindow(clock(),hour),id=`daily-scan-v1:${market}:${window.key}`;
  const row=await db.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?',id,clock());
  const priorities=['PTT','AOT','CPALL','AAPL80','NVDA','AAPL','SPY','EUR/USD','USD/THB'];
  const rank=s=>priorities.includes(s)?priorities.indexOf(s):-1;
  let state=row?JSON.parse(row.payload_json):{next:0,attempted:0,interrupted:0,startedAt:new Date(clock()).toISOString()};
  const symbols=state.roster||universe(market).map(a=>a.symbol).sort((a,b)=>(rank(a)<0?999:rank(a))-(rank(b)<0?999:rank(b)));
  state.roster=symbols;
  const save=()=>db.run('INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at',id,JSON.stringify(state),window.next+2*dayMs);
  if(state.reserved?.length){state.interrupted+=state.reserved.length;delete state.reserved;await save();}
  if(state.complete||state.next>=symbols.length)return {status:'daily-complete',dailyKey:window.key,nextRunAt:new Date(window.next).toISOString(),scanned:0,attempted:state.attempted,interrupted:state.interrupted};
  const start=state.next,selected=symbols.slice(start,start+8);
  state={...state,next:start+selected.length,reserved:selected};await save();
  const result=await run(market,{symbols:selected,force:true,maxSymbols:8,budgetMs:20000});
  const scanned=Math.max(0,Math.min(selected.length,result.scanned||0));
  state.next=start+scanned;state.attempted+=scanned;delete state.reserved;
  state.complete=state.next>=symbols.length;
  if(state.complete)state.completedAt=new Date(clock()).toISOString();
  await save();
  return {...result,status:state.complete?'daily-complete':result.status,dailyKey:window.key,nextRunAt:new Date(window.next).toISOString(),progress:state.next,total:symbols.length,attempted:state.attempted,interrupted:state.interrupted};
 };
}
