import { cleanBars, features, setupAt, entryPlan, exitOnBar, replayDaytrade, RULE, SETTINGS, summarize } from './engine.mjs';
import { cfdUniverse, nativeUniverse } from './universe.mjs';

const cfdScope = connection => `mt5:${connection.owner}:${connection.server}`;

export function initializeDaytrade(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS daytrade_bars(scope TEXT NOT NULL,symbol TEXT NOT NULL,body TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(scope,symbol));
    CREATE TABLE IF NOT EXISTS daytrade_coverage(scope TEXT NOT NULL,symbol TEXT NOT NULL,body TEXT NOT NULL,checked INTEGER NOT NULL,PRIMARY KEY(scope,symbol));
    CREATE TABLE IF NOT EXISTS daytrade_forward(scope TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(scope,id));
    CREATE TABLE IF NOT EXISTS daytrade_cursor(scope TEXT NOT NULL,symbol TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(scope,symbol));
    CREATE TABLE IF NOT EXISTS daytrade_jobs(connection_id TEXT NOT NULL,symbol TEXT NOT NULL,attempt INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(connection_id,symbol));`);
}
export function seriesFor(db,scope,symbol) {
  const row=db.prepare('SELECT body,updated FROM daytrade_bars WHERE scope=? AND symbol=?').get(scope,symbol);
  return row?{...JSON.parse(row.body),updated:row.updated}:null;
}
export function recordFailure(db,scope,asset,code,now=Date.now()) {
  db.prepare('INSERT INTO daytrade_coverage VALUES(?,?,?,?) ON CONFLICT(scope,symbol) DO UPDATE SET body=excluded.body,checked=excluded.checked')
    .run(scope,asset.symbol,JSON.stringify({symbol:asset.symbol,market:asset.market,status:'UNAVAILABLE',code}),now);
}
export function ingestBars(db,scope,asset,incoming,{now=Date.now(),offsetMinutes=0,source='Vantage MT5',spread=null,feeBps=0,slippageBps=2,delaySeconds=0}={}) {
  const prior=seriesFor(db,scope,asset.symbol), incomingBars=cleanBars(incoming,now);
  const merged=new Map((prior?.bars||[]).map(b=>[b.time,b]));
  // Keep the first observed closed candle immutable for reproducible ledgers.
  for(const b of incomingBars)if(!merged.has(b.time))merged.set(b.time,b);
  const bars=[...merged.values()].sort((a,b)=>a.time-b.time).slice(-3000);
  const costs={spread:spread??0,feeBps,slippageBps};
  const body={bars,source,offsetMinutes,costs,spreadKnown:spread!==null,volumeSource:asset.volumeSource,delaySeconds};
  db.prepare('INSERT INTO daytrade_bars VALUES(?,?,?,?) ON CONFLICT(scope,symbol) DO UPDATE SET body=excluded.body,updated=excluded.updated')
    .run(scope,asset.symbol,JSON.stringify(body),now);
  const coverage={symbol:asset.symbol,market:asset.market,status:bars.length>=SETTINGS.warmup?'READY':'WARMUP',code:bars.length>=SETTINGS.warmup?null:'NEED_60_CLOSED_15M_BARS',bars:bars.length,source};
  db.prepare('INSERT INTO daytrade_coverage VALUES(?,?,?,?) ON CONFLICT(scope,symbol) DO UPDATE SET body=excluded.body,checked=excluded.checked')
    .run(scope,asset.symbol,JSON.stringify(coverage),now);
  advanceForward(db,scope,asset,bars,{now,offsetMinutes,costs,spreadKnown:spread!==null,delaySeconds});
  return coverage;
}
function advanceForward(db,scope,asset,bars,{now,offsetMinutes,costs,spreadKnown,delaySeconds}) {
  const found=db.prepare('SELECT body FROM daytrade_cursor WHERE scope=? AND symbol=?').get(scope,asset.symbol);
  const state=found?JSON.parse(found.body):{last:null,pending:null,active:null,cooldown:0};
  const previousLast=state.last;
  const save=trade=>db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?) ON CONFLICT(scope,id) DO UPDATE SET body=excluded.body')
    .run(scope,trade.id,JSON.stringify(trade));
  for(const b of bars.filter(b=>state.last!==null&&b.time>state.last)) {
    if(state.pending&&!state.active&&b.time>=state.pending.publishedAt/1000){
      const p=state.pending;
      if(b.time>=p.publishedAt/1000&&b.time<=p.availableAt+1800){
        const plan=entryPlan(asset,p,b.open,costs);
        if(plan){state.active={...p,plan,status:'OPEN',entryTime:b.time,heldBars:0,lastBar:null,origin:'forward',costBasis:'configured-assumptions'};save(state.active);}
      }
      if(!state.active)save({...p,status:'EXPIRED'});
      state.pending=null;
    }
    if(state.active){
      state.active.heldBars++;
      const outcome=exitOnBar(asset,state.active,b,state.active.lastBar);
      state.active.lastBar=b.time;
      if(outcome){save({...state.active,...outcome});state.active=null;state.cooldown=SETTINGS.cooldownBars;}
      else save(state.active);
    }
    state.last=b.time;
  }
  // Bootstrap imports never create historical forward trades. Only a newly
  // observed, recent close may publish a plan for a future bar.
  const last=bars.at(-1);
  if(last&&last.time!==state.last){state.last=last.time;}
  if(last&&last.time!==previousLast&&!state.active&&!state.pending&&now-(last.time+900+delaySeconds)*1000<900000&&spreadKnown){
    if(state.cooldown>0)state.cooldown--;
    else {
      const setup=setupAt(asset,bars,bars.length-1,features(bars),offsetMinutes);
      if(setup){
        setup.availableAt+=delaySeconds;
        const id=`${RULE}:${asset.instrumentId}:${setup.signalTime}`;
        if(!db.prepare('SELECT 1 FROM daytrade_forward WHERE scope=? AND id=?').get(scope,id)){
          state.pending={...setup,id,symbol:asset.symbol,market:asset.market,publishedAt:now,origin:'forward',status:'WAITING'};
          save(state.pending);
        }
      }
    }
  }
  // A plan that never reached a later eligible bar remains explicitly expired.
  if(state.pending&&now>(state.pending.availableAt+2700)*1000){save({...state.pending,status:'EXPIRED'});state.pending=null;}
  db.prepare('INSERT INTO daytrade_cursor VALUES(?,?,?) ON CONFLICT(scope,symbol) DO UPDATE SET body=excluded.body')
    .run(scope,asset.symbol,JSON.stringify(state));
}
export function scanJobs(db,connection,now=Date.now()) {
  if(!connection.snapshot)return '';
  const instruments=JSON.parse(connection.snapshot).instruments;
  const assets=[...cfdUniverse(instruments,'forex'),...cfdUniverse(instruments,'us')];
  const symbols=new Set(assets.filter(a=>[2,4].includes(a.trade_mode)).map(a=>a.symbol));
  const add=db.prepare('INSERT OR IGNORE INTO daytrade_jobs(connection_id,symbol,attempt) VALUES(?,?,0)');
  for(const symbol of symbols)add.run(connection.id,symbol);
  for(const row of db.prepare('SELECT symbol FROM daytrade_jobs WHERE connection_id=?').all(connection.id))if(!symbols.has(row.symbol))
    db.prepare('DELETE FROM daytrade_jobs WHERE connection_id=? AND symbol=?').run(connection.id,row.symbol);
  const jobs=db.prepare('SELECT symbol FROM daytrade_jobs WHERE connection_id=? AND attempt<? ORDER BY attempt,symbol LIMIT 8').all(connection.id,now-180000);
  for(const j of jobs)db.prepare('UPDATE daytrade_jobs SET attempt=? WHERE connection_id=? AND symbol=?').run(now,connection.id,j.symbol);
  return jobs.map(j=>Buffer.from(j.symbol).toString('hex')).join(',');
}
export function ingestScanCharts(db,row,charts,quotes,now) {
  const instruments=JSON.parse(row.snapshot||'{"instruments":[]}').instruments;
  const assets=[...cfdUniverse(instruments,'forex'),...cfdUniverse(instruments,'us')];
  for(const chart of charts){
    const asset=assets.find(a=>a.symbol===chart.broker_symbol);
    if(!asset||chart.timeframe!=='15m')continue;
    const q=quotes.find(q=>q.broker_symbol===asset.symbol);
    ingestBars(db,cfdScope(row),asset,chart.bars,{now,offsetMinutes:chart.utc_offset_minutes,
      spread:q&&now-q.time*1000<30000?q.ask-q.bid:null});
  }
}
export function dashboard(db,connection,market,{symbol,now=Date.now()}={}) {
  const cfd=['us','forex'].includes(market),scope=cfd?(connection?cfdScope(connection):null):`native:${market}`;
  const instruments=connection?.snapshot?JSON.parse(connection.snapshot).instruments:[];
  const assets=cfd?cfdUniverse(instruments,market):nativeUniverse(market);
  const rows=assets.map(asset=>{
    const row=db.prepare('SELECT body,checked FROM daytrade_coverage WHERE scope=? AND symbol=?').get(scope||'',asset.symbol);
    const data=row?JSON.parse(row.body):{status:'QUEUED',code:'WAITING_COLLECTOR',bars:0};
    const series=seriesFor(db,scope||'',asset.symbol);
    const last=series?.bars.at(-1),latest=last&&setupAt(asset,series.bars,series.bars.length-1,undefined,series.offsetMinutes);
    const stale=last&&now-(last.time+900)*1000>30*60000;
    return {symbol:asset.symbol,name:asset.name,kind:asset.instrumentType,...data,checkedAt:row?.checked??null,
      latestBar:last?.time??null,price:last?.close??null,stale:Boolean(stale),
      side:!stale&&data.status==='READY'?latest?.side??null:null,volumeSource:asset.volumeSource,
      spreadKnown:series?.spreadKnown??false};
  });
  const chosen=assets.find(a=>a.symbol===symbol)||assets[0],series=chosen&&seriesFor(db,scope,chosen.symbol);
  const replay=chosen&&series?replayDaytrade(chosen,series.bars,{now,offsetMinutes:series.offsetMinutes,costs:series.costs}):null;
  const symbols=new Set(assets.map(a=>a.symbol));
  const forward=scope?db.prepare('SELECT body FROM daytrade_forward WHERE scope=?').all(scope).map(r=>JSON.parse(r.body)).filter(t=>symbols.has(t.symbol)).sort((a,b)=>b.publishedAt-a.publishedAt):[];
  return {market,rule:RULE,settings:SETTINGS,source:cfd?'Vantage MT5':market==='tfex'?'TFEX Open API':'Settrade Market API',
    connection:cfd?connection?(connection.expires<=now?'expired':now-connection.last_seen>30000?'stale':'connected'):'required':'server',
    universe:rows,coverage:{total:rows.length,ready:rows.filter(r=>r.status==='READY').length,warmup:rows.filter(r=>r.status==='WARMUP').length,
      queued:rows.filter(r=>r.status==='QUEUED').length,unavailable:rows.filter(r=>r.status==='UNAVAILABLE').length,fresh:rows.filter(r=>r.status==='READY'&&!r.stale).length},
    mappingPending:cfd&&market==='us'?instruments.filter(i=>['share_cfds','etfs'].includes(i.category)&&!usListingSafe(i)).length:0,
    selected:chosen?{symbol:chosen.symbol,name:chosen.name,digits:chosen.digits??2,point:chosen.point,bars:series?.bars??[],
      updated:series?.updated??null,spreadKnown:series?.spreadKnown??false,costs:series?.costs??null,
      replay,forward:forward.filter(t=>t.symbol===chosen.symbol)}:null,
    forward:forward.slice(0,200),summary:summarize(forward),volumeStatus:market==='us'?'FMP_INTRADAY_PENDING':'PRICE_ONLY',
    generatedAt:new Date(now).toISOString()};
}
function usListingSafe(i){return cfdUniverse([i],'us').length>0;}
