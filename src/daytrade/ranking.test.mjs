import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {features,setupAt} from './engine.mjs';
import {rankSetup,topOpportunities} from './ranking.mjs';
import {dashboard,initializeDaytrade,ingestBars} from './store.mjs';
import {monitorRow} from '../monitor/view.mjs';
import {instrumentIdentity} from '../markets/instrument-identity.mjs';
const base=Date.parse('2026-10-12T01:00:00Z')/1000;
const bars=Array.from({length:70},(_,i)=>{const close=100+i*.12;return {time:base+i*900,open:close-.05,high:close+.1,low:close-.4,close,volume:1};});
const asset={id:'gold',instrumentId:'gold',symbol:'XAUUSD',broker_symbol:'XAUUSD',canonical_symbol:'XAUUSD',description:'Gold',name:'Gold',market:'forex',category:'metals',point:.01,trade_mode:4};
const now=(bars.at(-1).time+900)*1000;
test('score uses real qualified closed bars, symmetric for short, with auditable sum and no mutations',()=>{
 const original=JSON.stringify(bars),v=features(bars),setup=setupAt(asset,bars,69,v),score=rankSetup(bars,v,setup);
 assert.ok(score.score>=1&&score.score<=100);assert.equal(score.score,score.factors.reduce((n,f)=>n+f.points,0));assert.equal(score.evaluatedAt,now);
 const down=bars.map(b=>({...b,open:220-b.open,close:220-b.close,high:220-b.low,low:220-b.high})),dv=features(down);
 const short=rankSetup(down,dv,setupAt(asset,down,69,dv));assert.equal(short.side,'SHORT');assert.equal(short.score,score.score);
 assert.equal(rankSetup(bars,v,null),null);assert.equal(rankSetup(bars.slice(0,20),v,setup),null);assert.equal(JSON.stringify(bars),original);
});
test('top five are market-scoped, sorted, deduplicated; unqualified, stale, invalid or old scores never fill slots',()=>{
 const row={market:'us',symbol:'AAPL',latestBar:bars.at(-1).time,met:true,abnormal:false,side:'LONG',ranking:{version:'daytrade-quality-v1',score:80,side:'LONG',evaluatedAt:now}};
 const eligible=Array.from({length:8},(_,i)=>({...row,symbol:`STOCK${i}`,ranking:{...row.ranking,score:70+i}}));
 const invalid=[{...row,symbol:'STALE',abnormal:true},{...row,symbol:'WAIT',met:false},{...row,market:'thai'}, {...row,ranking:{...row.ranking,evaluatedAt:now-900000}},{...row,ranking:null},{...row,ranking:{...row.ranking,score:101}},{...row,side:null}];
 assert.deepEqual(topOpportunities([...invalid,...eligible,eligible[7]],'us').map(r=>r.symbol),['STOCK7','STOCK6','STOCK5','STOCK4','STOCK3']);
 assert.deepEqual(topOpportunities(invalid.filter(r=>r.market==='us'),'us'),[]);assert.equal(topOpportunities([row],'us').length,1);
});
test('actual dashboard ranks fresh engine setups read-only and drops stale/disconnected rankings',()=>{
 const db=new DatabaseSync(':memory:');initializeDaytrade(db);
 const connection={owner:'fixture',server:'fixture',expires:now+3600000,last_seen:now,snapshot:JSON.stringify({instruments:[asset]}),quotes:'{}'};
 ingestBars(db,'mt5:fixture:fixture',asset,bars,{now,spread:.01});
 const before=db.prepare('SELECT * FROM daytrade_forward').all();
 const data=dashboard(db,connection,'forex',{now,compact:true}),row=data.universe[0];
 assert.ok(row.ranking);assert.equal(topOpportunities([monitorRow(row,'forex',data.connection,now)],'forex').length,1);
 assert.equal(dashboard(db,connection,'forex',{now:now+31*60000}).universe[0].ranking,null);
 assert.equal(dashboard(db,{...connection,last_seen:now-31000},'forex',{now}).universe[0].ranking,null);
 assert.deepEqual(db.prepare('SELECT * FROM daytrade_forward').all(),before);db.close();
});
test('listing identities preserve broker labels and do not invent ambiguous company mappings',()=>{
 assert.match(instrumentIdentity({market:'thai',symbol:'PTT'}).url,/PTT.BK.png$/);
 assert.match(instrumentIdentity({market:'dr',symbol:'NVDA80'}).url,/NVDA.png$/);
 assert.equal(instrumentIdentity({market:'dr',symbol:'UNKNOWN80'}).url,null);
 assert.match(instrumentIdentity({market:'us',symbol:'NTES.24H'}).url,/NTES.png$/);
 assert.match(instrumentIdentity({market:'us',symbol:'BRK.B'}).url,/BRK-B.png$/);
 assert.equal(instrumentIdentity({market:'us',symbol:'AAPL.a'}).url,null);
 assert.equal(instrumentIdentity({market:'us',symbol:'../../secret?key=1'}).url,null);
 assert.equal(instrumentIdentity({market:'forex',symbol:'XAU/USD'}).label,'Au');
 assert.equal(instrumentIdentity({market:'tfex',symbol:'GOZ26'}).url,null);
});
test('authenticated API exposes a real ranking only under existing signal entitlement',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {ForexStore}=await import('../forex-mt5/store.mjs');
 const {createDaytradeHandlers}=await import('./handlers.mjs');
 const store=new ForexStore();
 try{
  store.pair('member:score-test','VantageMarkets-Demo',{enabled:true,servers:['VantageMarkets-Demo']});
  store.db.prepare('UPDATE forex_connections SET snapshot=?,last_seen=?').run(JSON.stringify({instruments:[asset]}),now);
  ingestBars(store.db,'mt5:member:score-test:VantageMarkets-Demo',asset,bars,{now,spread:.01});
  const request=new Request('https://example.test/api/daytrade?market=forex&compact=1');
  const api=member=>createDaytradeHandlers({currentMember:async()=>member,getStore:()=>store,env:{FOREX_MT5_ENABLED:'true',FOREX_MT5_VANTAGE_SERVERS:'VantageMarkets-Demo'}}).GET(request);
  const allowed=await (await api({id:'score-test',portfolio_status:'verified',trial_ends_at:new Date(now+86400000).toISOString()})).json();
  assert.ok(allowed.universe[0].ranking?.score>0);assert.equal(allowed.selected,null);
  const denied=await (await api({id:'score-test'})).json();assert.equal(denied.signalAccess,false);assert.equal(denied.universe[0].ranking,null);assert.equal(denied.universe[0].side,null);
 }finally{store.db.close();}
});
