import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {projectTrade,legacyStrategy,combineResults} from './results.mjs';
const dir=mkdtempSync(join(tmpdir(),'ledger-results-'));process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {ForexStore}=await import('../forex-mt5/store.mjs');
const {tradeResults}=await import('./results-store.mjs');
const {createSignal,saveAdvance,signalResults}=await import('../auto-pick/store.mjs');
const {insertReferenceSignal}=await import('../signals/store.mjs');
const {SIGNAL_RULE}=await import('../signals/model.mjs');
const store=new ForexStore(':memory:');
const env={FOREX_MT5_ENABLED:'true',FOREX_MT5_DATABASE_PATH:':memory:',STORAGE_PROVIDER:'sqlite'};
const deps={env,getStore:()=>store};
const start='2026-10-20T03:00:00.000Z',end='2026-10-20T04:00:00.000Z';
test.after(()=>{store.db.close();sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
const swing=id=>({id,ruleVersion:SIGNAL_RULE,market:'thai',symbol:'PTT',mode:'breakout',profile:'standard',status:'CLOSED',publishedAt:start,updatedAt:end,enteredAt:start,exitedAt:end,entryPrice:100,netR:1,fills:[{fraction:1,price:103}],context:{latest4hTime:1},plan:{entry:100,entryBasis:100,netRiskPerUnit:3,stopLoss:97,minimumTarget:106}});
test('resolved partial fills and net R determine outcomes without rounding trades into wins',()=>{
 const record=projectTrade({...swing('one'),netR:-0.01,fills:[{price:106,fraction:.5},{price:94,fraction:.5}]},'swing');
 assert.equal(record.outcome.rMultiple,-0.01);assert.ok(record.outcome.returnPercent<0);assert.equal(record.exitPrice,100);
 assert.equal(projectTrade({...swing('bad'),exitedAt:null},'swing').status,'REVIEW');
 assert.equal(legacyStrategy({setupType:'OPENING_RANGE_BREAKOUT'}),'orb');
});
test('real source ledgers remain separate and filters share the same statistics',async()=>{
 await insertReferenceSignal(swing('swing-one'));
 const legacy=await createSignal({market:'thai',symbol:'ORB',sessionDay:'2026-10-20',plan:{side:'LONG',entry:100,stopLoss:98,tp1:104,setupType:'OPENING_RANGE_BREAKOUT'},source:'fixture'});
 await saveAdvance({...legacy,status:'TARGET',entryPrice:100,exitPrice:104,enteredAt:start,exitedAt:end},[]);
 const day={id:'day-one',origin:'forward',market:'thai',symbol:'PTT',status:'CLOSED',side:'LONG',publishedAt:Date.parse(start),entryTime:Date.parse(start)/1000,exitTime:Date.parse(end)/1000,exit:98,netR:-1,plan:{entry:100,stop:98,target:104,risk:2}};
 store.db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run('native:thai',day.id,JSON.stringify(day));
 for(const [strategy,closed,wins] of [['swing',1,1],['orb',1,1],['scalp',1,0],['all',3,2]]){
  const feed=await tradeResults('fixture',{market:'thai',strategy,scope:'closed'},deps);
  assert.equal(feed.total,closed,strategy);assert.equal(feed.summary.closed,closed);assert.equal(feed.summary.wins,wins);
  if(strategy!=='all')assert.ok(feed.signals.every(r=>r.strategy===strategy));
 }
 const old=await signalResults({market:'thai',strategy:'swing'});assert.equal(old.total,0);assert.equal(old.summary.closed,0);
 const orb=await signalResults({market:'thai',strategy:'orb'});assert.equal(orb.total,1);assert.equal(orb.summary.closed,1);
});
test('server pagination retains old history and excludes other members CFD and US cost profiles',async()=>{
 for(let i=0;i<9;i++)await insertReferenceSignal({...swing(`more-${i}`),publishedAt:new Date(Date.parse(start)+i*1000).toISOString()});
 await insertReferenceSignal({...swing('private-profile'),market:'us',profile:'not-authorized'});
 const alien={id:'private-cfd',market:'forex',symbol:'EURUSD',status:'OPEN',publishedAt:1};
 store.db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run('mt5:member:someone-else:OtherBroker',alien.id,JSON.stringify(alien));
 const a=await tradeResults('fixture',{strategy:'swing',scope:'history',page:1},deps),b=await tradeResults('fixture',{strategy:'swing',scope:'history',page:2},deps);
 assert.equal(a.total,10);assert.equal(a.signals.length,7);assert.equal(b.signals.length,3);
 assert.ok(b.signals.every(r=>!a.signals.some(x=>x.key===r.key)));
 assert.equal((await tradeResults('fixture',{strategy:'scalp',market:'forex'},deps)).total,0);
 const cloud=await tradeResults('fixture',{strategy:'all'},{env:{STORAGE_PROVIDER:'d1',FOREX_MT5_ENABLED:'true'},getStore:()=>{throw Error('must not open SQLite');}});
 assert.ok(cloud.sources.some(s=>s.status==='NODE_RECEIVER_REQUIRED'));assert.ok(cloud.signals.length>0);
});
test('the combined results use the existing D1 schema without opening the Node ledger',async()=>{
 const {writeFileSync}=await import('node:fs');
 const {resolve}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const {withD1Database}=await import('../storage/database.mjs');
 const configPath=join(dir,'wrangler.json');
 writeFileSync(configPath,JSON.stringify({name:'result-fixture',compatibility_date:'2026-10-07',d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
 const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(migration.status,0,migration.stderr.slice(-300));
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:join(dir,'.wrangler/state/v3')}});
 try{await withD1Database(proxy.env.DB,async()=>{
  await insertReferenceSignal(swing('d1-swing'));
  const feed=await tradeResults('fixture',{market:'thai',strategy:'swing',scope:'closed'},{env:{STORAGE_PROVIDER:'d1'},getStore:()=>{throw Error('no Node storage on D1');}});
  assert.equal(feed.summary.closed,1);assert.equal(feed.signals[0].ledger,'swing');assert.equal(feed.signals[0].events.length,1);
 });}finally{await proxy.dispose();}
});
