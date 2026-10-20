import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cleanBars,features,setupAt,entryPlan,exitOnBar,replayDaytrade,summarize} from './engine.mjs';
import {cfdUniverse,nativeUniverse,CORE_FOREX,usListing,listingRegion} from './universe.mjs';
import {initializeDaytrade,ingestBars,dashboard,seriesFor,scanJobs} from './store.mjs';
import {ForexStore} from '../forex-mt5/store.mjs';
import {createDaytradeHandlers} from './handlers.mjs';
import {createNativeScanner} from './native-worker.mjs';
import {nativeTradingDay} from './calendar.mjs';
const base=Date.parse('2026-10-12T01:00:00Z')/1000;
const asset={id:'fx',instrumentId:'gold',symbol:'XAUUSD',name:'Gold',market:'forex',source:'mt5',point:0.01,trade_mode:4,category:'metals',canonical_symbol:'XAUUSD',broker_symbol:'XAUUSD'};
const rows=(count=120)=>Array.from({length:count},(_,i)=>{const close=100+i*.12;return {time:base+i*900,open:close-.05,high:close+.1,low:close-.4,close,volume:1};});
const memory=()=>{const db=new DatabaseSync(':memory:');initializeDaytrade(db);return db;};
test('official special holiday is distinguished from a broken source and suppresses Thai daytrade setups',()=>{
  assert.equal(nativeTradingDay(Date.parse('2026-10-16T08:00:00Z')/1000).closedReason,'EXCHANGE_HOLIDAY');
  assert.equal(nativeTradingDay(Date.parse('2026-10-15T08:00:00Z')/1000).closedReason,null);
  assert.equal(nativeTradingDay(Date.parse('2027-01-05T08:00:00Z')/1000).calendarVerified,false);
  const bars=rows(70).map((b,i)=>({...b,time:Date.parse('2026-10-16T08:00:00Z')/1000-(69-i)*900}));
  assert.equal(setupAt({...asset,market:'thai'},bars,69),null);
});

test('US classification needs exchange or broker region; USD alone and foreign ticker collisions are excluded',()=>{
  assert.equal(usListing({category:'share_cfds',currency_profit:'USD',broker_symbol:'AAL'}),false);
  assert.equal(usListing({category:'share_cfds',broker_path:'Shares\\UK',exchange:'LSE'}),false);
  assert.equal(usListing({category:'share_cfds',broker_path:'Shares\\US'}),true);
  assert.equal(usListing({category:'etfs',exchange:'NASDAQ'}),true);
  assert.equal(usListing({category:'share_cfds',exchange:'ASX'}),false);
  assert.equal(usListing({category:'indices',exchange:'NYSE'}),false);
});
test('real broker regional folders override venue aliases; US 24h and official ETF MICs are included',()=>{
  assert.equal(usListing({category:'share_cfds',broker_path:'Stocks\\UK\\10\\AAL',exchange:'NASDAQ'}),false);
  assert.equal(usListing({category:'share_cfds',broker_path:'Stocks\\US.24H\\IBM.24H'}),true);
  assert.equal(usListing({category:'etfs',broker_path:'ETF\\ETF-C\\GLD',exchange:'ARCX'}),true);
  assert.equal(usListing({category:'etfs',broker_path:'ETF\\ETF-C\\SMH',broker_symbol:'SMH',exchange:'NMQ'}),true);
  assert.equal(usListing({category:'etfs',broker_path:'ETF\\ETF-C\\UNKNOWN',broker_symbol:'UNKNOWN',exchange:'NMQ'}),false);
  assert.equal(listingRegion({category:'etfs',exchange:'HKG'}),'OTHER');
  assert.equal(listingRegion({category:'etfs',exchange:'UNKNOWN'}),'UNKNOWN');
});
test('Forex desk exposes exactly the nine core assets without mutating a full broker snapshot',()=>{
  const all=[...CORE_FOREX,'GBPJPY'].map(s=>({...asset,id:s,broker_symbol:s,canonical_symbol:s}));
  assert.equal(cfdUniverse(all,'forex').length,9);assert.equal(all.length,10);
  assert.equal(cfdUniverse([{...asset,category:'share_cfds'}],'forex').length,0);
  assert.equal(cfdUniverse([{...asset,canonical_symbol:null,broker_symbol:'XAUUSD.a',currency_base:'XAU',currency_profit:'USD'}],'forex').length,0);
  for(const market of ['thai','dr','tfex'])assert.ok(nativeUniverse(market).length>0);
});
test('closed-bar normalization drops open/future, invalid OHLC and ambiguous duplicate timestamps',()=>{
  const a=rows(5),now=(a.at(-1).time+400)*1000;
  const result=cleanBars([...a,a[1],{...a[2],time:base-900,high:1}],now);
  assert.deepEqual(result.map(b=>b.time),[a[0].time,a[2].time,a[3].time]);
});
test('one trend setup has structural stop at least 1.5 ATR and a single 2R target',()=>{
  const a=rows(70),setup=setupAt(asset,a,69);
  assert.equal(setup.side,'LONG');assert.ok(setup.trigger-setup.stop>=1.5*setup.atr);
  const plan=entryPlan(asset,setup,a.at(-1).close,{spread:.02,slippageBps:2,feeBps:3});
  assert.ok(plan);assert.ok(plan.target-plan.entry>=2*plan.risk-1e-8);
  assert.equal(entryPlan(asset,setup,setup.trigger+setup.atr*5),null);
});
test('stocks and DR never manufacture short trades; CFD short obeys broker trade mode',()=>{
  const falling=rows(70).map(b=>({...b,open:220-b.open,close:220-b.close,high:220-b.low,low:220-b.high}));
  assert.equal(setupAt({...asset,market:'dr'},falling,69),null);
  assert.equal(setupAt({...asset,trade_mode:1},falling,69),null);
  assert.equal(setupAt({...asset,trade_mode:1},rows(70),69)?.side,'LONG');
  assert.equal(setupAt({...asset,trade_mode:2},falling,69)?.side,'SHORT');
  assert.equal(setupAt({...asset,trade_mode:2},rows(70),69),null);
  assert.equal(setupAt({...asset,trade_mode:3},rows(70),69),null);
  const longSetup=setupAt(asset,rows(70),69);
  assert.equal(entryPlan({...asset,trade_mode:2},longSetup,rows(70).at(-1).close),null);
  assert.equal(entryPlan({...asset,trade_mode:3},longSetup,rows(70).at(-1).close),null);
  assert.equal(setupAt(asset,falling,69)?.side,'SHORT');
  assert.equal(setupAt({...asset,trade_mode:0},rows(70),69),null);
});
test('SL/TP ambiguity, missing bars and gaps are explicit and never counted as a convenient win',()=>{
  const trade={side:'LONG',plan:{entry:100,stop:98,target:104,risk:2,spread:0,slippageBps:0,feeBps:0},heldBars:1,sessionKey:'2026-10-12',offsetMinutes:0};
  const b={time:base+900,open:100,high:105,low:97,close:101};
  assert.equal(exitOnBar(asset,trade,b,base).status,'REVIEW');
  assert.equal(exitOnBar(asset,trade,{...b,time:base+1800},base).reason,'DATA_GAP');
  const gap=exitOnBar(asset,trade,{...b,open:96},base);
  assert.equal(gap.reason,'SL_GAP');assert.equal(gap.netR,-2);
  const unchanged=structuredClone(trade);
  assert.equal(exitOnBar(asset,trade,{...b,high:103,low:99},base),null);
  assert.deepEqual(trade,unchanged); // No early breakeven or target movement.
});
test('short exits use ask-side spread once, including target trigger checks',()=>{
  const trade={side:'SHORT',plan:{entry:100,stop:102,target:96,risk:2,spread:.2,slippageBps:0,feeBps:0},heldBars:1,sessionKey:'2026-10-12',offsetMinutes:0};
  const b={time:base+900,open:100,high:101,low:95.9,close:97};
  assert.equal(exitOnBar(asset,trade,b,base),null); // bid touched, ask did not.
  assert.equal(exitOnBar(asset,trade,{...b,low:95.7},base).netR,2);
});
test('empty volume buckets cannot confirm a setup or manufacture an exit',()=>{
  const bars=rows(70);bars.at(-1).volume=0;
  assert.equal(setupAt(asset,bars,69),null);
  const trade={side:'LONG',plan:{entry:100,stop:98,target:104,risk:2,spread:0,slippageBps:0,feeBps:0},heldBars:1,sessionKey:'2026-10-12',offsetMinutes:0};
  assert.equal(exitOnBar(asset,trade,{time:base+900,open:100,high:105,low:97,close:100,volume:0},base),null);
});
test('replay enters a later bar and extending history cannot change completed earlier results',()=>{
  const first=rows(90),full=rows(120);
  const short=replayDaytrade(asset,first,{now:(first.at(-1).time+900)*1000});
  const long=replayDaytrade(asset,full,{now:(full.at(-1).time+900)*1000});
  assert.ok(short.trades.length>0);
  for(const trade of short.trades){
    assert.ok(trade.entryTime>=trade.signalTime+900);
    assert.deepEqual(long.trades.find(t=>t.id===trade.id),trade);
  }
  assert.equal(new Set(long.trades.map(t=>t.id)).size,long.trades.length);
});
test('statistics exclude REVIEW and open trades, report drawdown in R',()=>{
  const s=summarize([{status:'CLOSED',netR:2,exitTime:1},{status:'REVIEW',netR:99},{status:'CLOSED',netR:-1,exitTime:2},{status:'OPEN',netR:5}]);
  assert.equal(s.closed,2);assert.equal(s.winRate,50);assert.equal(s.netR,1);assert.equal(s.profitFactor,2);assert.equal(s.maxDrawdownR,1);
});
test('collector caches all series beyond eight chart slots, merges history and preserves first closed observation',()=>{
  const db=memory(),a=rows(90),now=(a.at(-1).time+900)*1000;
  for(let i=0;i<12;i++)ingestBars(db,'owner',{...asset,symbol:`s${i}`},a,{now,spread:.02});
  ingestBars(db,'owner',{...asset,symbol:'s0'},[{...a[0],close:a[0].close+.01}],{now,spread:.02});
  assert.equal(db.prepare('SELECT count(*) n FROM daytrade_bars').get().n,12);
  assert.equal(seriesFor(db,'owner','s0').bars[0].close,a[0].close);
  assert.equal(seriesFor(db,'other','s0'),null);db.close();
});
test('historical bootstrap cannot backfill the forward ledger; repeated polls cannot create extra plans',()=>{
  const db=memory(),a=rows(70),late=(a.at(-1).time+900+3600)*1000;
  ingestBars(db,'x',asset,a,{now:late,spread:.02});
  assert.equal(db.prepare('SELECT count(*) n FROM daytrade_forward').get().n,0);
  const recent=rows(71),now=(recent.at(-1).time+900+5)*1000;
  ingestBars(db,'x',asset,recent,{now,spread:.02});
  const count=db.prepare('SELECT count(*) n FROM daytrade_forward').get().n;
  assert.equal(count,1);
  for(let i=0;i<5;i++)ingestBars(db,'x',asset,recent,{now:now+i*1000,spread:.02});
  assert.equal(db.prepare('SELECT count(*) n FROM daytrade_forward').get().n,count);
  const trade=JSON.parse(db.prepare('SELECT body FROM daytrade_forward').get().body);
  assert.equal(trade.status,'WAITING');assert.equal(trade.origin,'forward');db.close();
});
test('batch collector rotates all symbols fairly and keeps queues scoped to a connection',()=>{
  const db=memory(),instruments=Array.from({length:19},(_,i)=>({...asset,id:`s${i}`,broker_symbol:`s${i}`,category:'share_cfds',broker_path:'Shares\\US'}));
  const connection={id:'one',snapshot:JSON.stringify({instruments})};
  const seen=new Set();for(let i=0;i<3;i++)for(const s of scanJobs(db,connection,1000000+i*1000).split(','))if(s)seen.add(Buffer.from(s,'hex').toString());
  assert.equal(seen.size,19);assert.equal(scanJobs(db,{id:'two',snapshot:JSON.stringify({instruments:[asset]})},1000000),Buffer.from('XAUUSD').toString('hex'));db.close();
});
test('close-only CFD is unavailable for new scans, never an endlessly queued or ready setup',()=>{
  const db=memory(),connection={id:'restricted',owner:'member:one',server:'VantageMarkets-Demo',expires:Date.now()+100000,last_seen:Date.now(),snapshot:JSON.stringify({instruments:[{...asset,trade_mode:3}]})};
  assert.equal(scanJobs(db,connection,1000000),'');
  const row=dashboard(db,connection,'forex').universe[0];
  assert.equal(row.status,'UNAVAILABLE');assert.equal(row.code,'BROKER_CLOSE_ONLY');assert.equal(row.side,null);
  db.prepare('INSERT INTO daytrade_cursor VALUES(?,?,?)').run('mt5:member:one:VantageMarkets-Demo',asset.symbol,JSON.stringify({active:{side:'LONG'}}));
  assert.equal(scanJobs(db,connection,1000001),Buffer.from(asset.symbol).toString('hex'));
  db.close();
});
test('core forex retries after three minutes ahead of a large unvisited US queue',()=>{
  const db=memory(),instruments=[asset,...Array.from({length:100},(_,i)=>({...asset,id:`s${i}`,broker_symbol:`s${i}`,category:'share_cfds',broker_path:'Shares\\US'}))];
  const connection={id:'core',snapshot:JSON.stringify({instruments})},decode=now=>scanJobs(db,connection,now).split(',').map(s=>Buffer.from(s,'hex').toString());
  assert.equal(decode(1000000)[0],'XAUUSD');
  assert.equal(decode(1001000).includes('XAUUSD'),false);
  assert.equal(decode(1180001)[0],'XAUUSD');
  db.close();
});
test('forward entry waits for a bar that begins after publication, survives repeated polls, and persists a closed outcome',()=>{
  const db=memory(),a=rows(70),published=(a.at(-1).time+905)*1000;
  ingestBars(db,'x',asset,a,{now:published,spread:.02,slippageBps:0});
  const read=()=>JSON.parse(db.prepare('SELECT body FROM daytrade_forward ORDER BY id LIMIT 1').get().body);
  assert.equal(read().status,'WAITING');
  const b=rows(71);ingestBars(db,'x',asset,b,{now:(b.at(-1).time+905)*1000,spread:.02,slippageBps:0});
  assert.equal(read().status,'WAITING'); // This bar had already opened when published.
  const c=rows(72);ingestBars(db,'x',asset,c,{now:(c.at(-1).time+905)*1000,spread:.02,slippageBps:0});
  assert.equal(read().status,'OPEN');assert.ok(read().entryTime*1000>published);
  const d=rows(73);d[d.length-1]={...d.at(-1),high:read().plan.target+1,low:read().plan.entry};
  ingestBars(db,'x',asset,d,{now:(d.at(-1).time+905)*1000,spread:.02,slippageBps:0});
  assert.equal(read().status,'CLOSED');assert.ok(read().netR>=2);db.close();
});
test('API rejects anonymous users, isolates MT5 owners and preserves existing membership signal rights',async()=>{
  const store=new ForexStore(),config={enabled:true,servers:['VantageMarkets-Demo']};
  const member={id:'one',portfolio_status:'verified',trial_ends_at:new Date(Date.now()+86400000).toISOString()};
  store.pair('member:one','VantageMarkets-Demo',config);
  store.db.prepare('UPDATE forex_connections SET snapshot=?').run(JSON.stringify({instruments:[asset]}));
  const env={FOREX_MT5_ENABLED:'true',FOREX_MT5_VANTAGE_SERVERS:'VantageMarkets-Demo'};
  const req=new Request('https://example.com/api/daytrade?market=forex');
  const api=m=>createDaytradeHandlers({currentMember:async()=>m,getStore:()=>store,env});
  assert.equal((await api(null).GET(req)).status,401);
  const own=await (await api(member).GET(req)).json();assert.equal(own.coverage.total,1);assert.equal(own.signalAccess,true);
  const other=await (await api({...member,id:'two'}).GET(req)).json();assert.equal(other.coverage.total,0);
  store.db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run('mt5:member:one:VantageMarkets-Demo','monitor-fixture',JSON.stringify({id:'monitor-fixture',symbol:'XAUUSD',market:'forex',publishedAt:Date.now(),status:'OPEN',entryTime:Date.now()/1000,trigger:100,side:'LONG',plan:{entry:100,stop:95,target:110}}));
  const enriched=await (await api(member).GET(req)).json();assert.equal(enriched.universe[0].monitorPlan.entry,100);assert.equal(enriched.monitorEvents.length,2);assert.equal(enriched.selected.symbol,'XAUUSD');
  const compact=await (await api(member).GET(new Request('https://example.com/api/daytrade?market=forex&compact=1'))).json();assert.equal(compact.selected,null);assert.equal(compact.monitorEvents.length,2);assert.equal(compact.universe[0].monitorPlan.entry,100);
  const recordReq=new Request('https://example.com/api/daytrade?market=forex&compact=1&record=monitor-fixture');
  assert.equal((await (await api(member).GET(recordReq)).json()).record.id,'monitor-fixture');
  assert.equal((await (await api({...member,id:'two'}).GET(recordReq)).json()).record,null);
  assert.equal((await (await api({id:'one'}).GET(recordReq)).json()).record,null);
  const noRights=await (await api({id:'one'}).GET(req)).json();assert.equal(noRights.signalAccess,false);assert.equal(noRights.selected.replay,null);assert.deepEqual(noRights.monitorEvents,[]);assert.deepEqual(noRights.activeForward,[]);assert.equal(noRights.universe[0].monitorPlan,null);assert.equal(noRights.universe[0].side,null);assert.equal(noRights.universe[0].ranking,null);
  assert.equal((await api(member).GET(new Request('https://example.com/api/daytrade?market=bad'))).status,400);
  store.db.close();
});
test('record lookup reaches beyond the displayed 200 rows and shares the full authoritative statistics',()=>{
  const db=memory(),scope='native:thai',symbol=nativeUniverse('thai')[0].symbol;
  for(let i=0;i<205;i++)db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run(scope,`record-${i}`,JSON.stringify({id:`record-${i}`,market:'thai',symbol,publishedAt:100000+i,trigger:100,status:'CLOSED',entryTime:100+i,plan:{entry:100,stop:95,target:110},exit:110,exitTime:1000+i,netR:2,reason:'TP'}));
  const feed=dashboard(db,null,'thai',{compact:true,recordId:'record-0'});
  assert.equal(feed.forward.length,200);assert.ok(!feed.forward.some(t=>t.id==='record-0'));assert.equal(feed.record.id,'record-0');assert.equal(feed.summary.closed,205);assert.equal(feed.summary.netR,410);
  assert.equal(dashboard(db,null,'dr',{compact:true,recordId:'record-0'}).record,null);db.close();
});
test('all active records remain in the monitoring queue beyond the 200-row recent-history window',()=>{
  const db=memory(),scope='native:thai',symbol=nativeUniverse('thai')[0].symbol;
  db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run(scope,'old-open',JSON.stringify({id:'old-open',symbol,market:'thai',status:'OPEN',publishedAt:1,plan:{entry:100,stop:95,target:110}}));
  for(let i=0;i<205;i++)db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run(scope,`closed-${i}`,JSON.stringify({id:`closed-${i}`,symbol,market:'thai',status:'CLOSED',publishedAt:1000+i,netR:1}));
  const feed=dashboard(db,null,'thai',{compact:true});assert.equal(feed.forward.length,200);assert.equal(feed.activeForward.length,1);assert.equal(feed.activeForward[0].id,'old-open');assert.equal(feed.summary.closed,205);db.close();
});
test('native worker filters incomplete/delayed bars, records failures and never falls back to Yahoo',async()=>{
  const db=memory(),a=rows(90),now=(a.at(-1).time+1000)*1000;
  const client={configuration:{configured:true},getCandles:async()=>({source:'fixture-native',bars:a})};
  const step=createNativeScanner({db,now:()=>now,clients:{SET:client,TFEX:client},env:{NODE_ENV:'production',SETTRADE_DISPLAY_RIGHTS_CONFIRMED:'true',TFEX_DISPLAY_RIGHTS_CONFIRMED:'true'}});
  await step();const series=JSON.parse(db.prepare('SELECT body FROM daytrade_bars').get().body);
  assert.ok(series.bars.at(-1).time<a.at(-1).time);assert.equal(series.source,'fixture-native');
  const blocked=createNativeScanner({db,now:()=>now,clients:{SET:client,TFEX:client},env:{NODE_ENV:'production'}});await blocked();
  assert.equal(JSON.parse(db.prepare('SELECT body FROM daytrade_coverage').get().body).code,'DISPLAY_RIGHTS_NOT_CONFIRMED');db.close();
});
