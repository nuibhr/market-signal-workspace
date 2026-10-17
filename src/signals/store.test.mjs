import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,writeFileSync,readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'nugaom-signals-'));process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {storage,withD1Database}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {candidateViews,startReferenceSignal,advanceReferenceSignal}=await import('./model.mjs');
const {thaiResearchCosts}=await import('../analysis/swing-standard.mjs');
const {SIGNAL_DESK_SCHEMA}=await import('./schema.mjs');
const {insertReferenceSignal,activeReferenceSignals,saveReferenceAdvance,signalDeskFeed,claimSignalLease,releaseSignalLease,saveUsCosts,usCostProfile,saveObservation}=await import('./store.mjs');
const epoch=Date.parse('2026-10-15T03:00:00Z')/1000;
const snapshot={market:'thai',symbol:'PTT',instrumentId:'SET100:PTT',name:'PTT',status:'AVAILABLE',price:100,swingLow:98,atr:1,resistanceLevels:[],relativeVolume:1.2,trendD1:'up',matched:{breakout:true,pullback:false},latest4hTime:epoch-15300,checkedAt:new Date(epoch*1000).toISOString()};
const begin=(market='thai',profile='standard')=>startReferenceSignal(candidateViews({...snapshot,market,symbol:market==='us'?'NVDA':'PTT',instrumentId:market==='us'?'US_STOCKS:NVDA':snapshot.instrumentId},thaiResearchCosts())[0],profile,epoch*1000);
const bar={time:epoch,open:100,high:101,low:99,close:100,volume:10000};
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
async function member(id){await storage.run('INSERT INTO members(id,line_id,display_name,created_at,updated_at) VALUES(?,?,?,?,?)',id,id,'Signal fixture','2026-10-15','2026-10-15');}
test('same additive schema applies to SQLite and native D1; no holdings or account table is introduced',()=>{
 assert.equal(readFileSync('deploy/cloudflare/migrations/0010_signal_desk.sql','utf8'),SIGNAL_DESK_SCHEMA);
 assert.ok(!SIGNAL_DESK_SCHEMA.includes('quantity'));assert.ok(!SIGNAL_DESK_SCHEMA.includes('balance'));
});
test('leases serialize work per market and expire safely; a stale owner cannot release the next owner',async()=>{
 const a=await claimSignalLease('thai',1000,100);assert.ok(a);assert.equal(await claimSignalLease('thai',1050,100),null);
 const b=await claimSignalLease('thai',1101,100);assert.ok(b);await releaseSignalLease('thai',a,1102);
 assert.equal(await claimSignalLease('thai',1103,100),null);await releaseSignalLease('thai',b,1104);
});
test('publication is idempotent; optimistic revision and immutable events survive a lost acknowledgement',async()=>{
 const signal=begin();await insertReferenceSignal(signal);await insertReferenceSignal(signal);
 let active=(await activeReferenceSignals('thai')).find(s=>s.id===signal.id);assert.equal(active.revision,0);
 const advanced=advanceReferenceSignal(active,[bar],snapshot,(epoch+1800)*1000);
 await saveReferenceAdvance(active,advanced.signal,advanced.events);await saveReferenceAdvance(active,advanced.signal,advanced.events);
 active=(await activeReferenceSignals('thai')).find(s=>s.id===signal.id);assert.equal(active.status,'OPEN');assert.equal(active.revision,1);
 const events=await storage.all('SELECT type FROM signal_desk_events WHERE signal_id=? ORDER BY seq',signal.id);assert.deepEqual(events.map(e=>e.type),['PICK_READY','ENTRY']);
 await assert.rejects(storage.run('DELETE FROM signal_desk_events WHERE signal_id=?',signal.id));
});
test('US costs are explicit, per member and immutable per signal profile; another profile is not disclosed',async()=>{
 await member('fixture-a');await member('fixture-b');assert.equal(await usCostProfile('fixture-a'),null);
 await assert.rejects(saveUsCosts('fixture-a',{commissionPercent:0}));
 const a=await saveUsCosts('fixture-a',{commissionPercent:0.1,marketFeePercent:0,commissionVatPercent:0,slippagePercent:0.2});
 const b=await saveUsCosts('fixture-b',{commissionPercent:0.2,marketFeePercent:0,commissionVatPercent:0,slippagePercent:0.3});
 assert.notEqual(a.id,b.id);await insertReferenceSignal(begin('us',a.id));
 assert.equal((await signalDeskFeed('fixture-a',{market:'us'})).signals.length,1);
 assert.equal((await signalDeskFeed('fixture-b',{market:'us'})).signals.length,0);
  const recordId=begin('us',a.id).id;
  const ownRecord=await signalDeskFeed('fixture-a',{market:'us',recordId});assert.equal(ownRecord.record.id,recordId);assert.equal(ownRecord.recordEvents.length,1);assert.equal(ownRecord.recordEvents[0].signalId,recordId);assert.equal(ownRecord.recordEvents[0].ledger,'swing');
  const otherRecord=await signalDeskFeed('fixture-b',{market:'us',recordId});assert.equal(otherRecord.record,null);assert.deepEqual(otherRecord.recordEvents,[]);assert.equal(otherRecord.recordStatistics,null);
 const saved=(await activeReferenceSignals('us'))[0];await saveUsCosts('fixture-a',{commissionPercent:0.3,marketFeePercent:0,commissionVatPercent:0,slippagePercent:0.4});
 assert.deepEqual((await activeReferenceSignals('us'))[0].plan,saved.plan);
 assert.equal((await signalDeskFeed('fixture-a',{market:'us'})).signals.length,1,'old-cost active signals remain visible after changing costs');
  assert.equal((await signalDeskFeed('fixture-a',{market:'us',recordId})).record.id,recordId,'an authorized older cost profile still links to its own record');
 assert.equal((await signalDeskFeed('fixture-b',{market:'us'})).signals.length,0);
});
test('Swing alert timeline and statistics track one committed partial / full lifecycle, not event counts',async()=>{
  const initial={...begin(),id:'stats-correlation-fixture'};await insertReferenceSignal(initial);
  const load=()=>signalDeskFeed('fixture-a',{market:'thai',recordId:initial.id});
  let previous=(await activeReferenceSignals('thai')).find(s=>s.id===initial.id);
  const entry=advanceReferenceSignal(previous,[bar],snapshot,(epoch+1800)*1000);await saveReferenceAdvance(previous,entry.signal,entry.events);
  let data=await load();assert.equal(data.record.status,'OPEN');assert.equal(data.recordStatistics.closed,0);
  previous=(await activeReferenceSignals('thai')).find(s=>s.id===initial.id);const tp=previous.plan.minimumTarget;
  const partial=advanceReferenceSignal(previous,[{...bar,time:epoch+900,open:tp+1,high:tp+2,low:102,close:tp+1}],snapshot,(epoch+2700)*1000);
  await saveReferenceAdvance(previous,partial.signal,partial.events);data=await load();assert.equal(data.record.status,'RUNNER');assert.equal(data.recordStatistics.closed,0);
  previous=(await activeReferenceSignals('thai')).find(s=>s.id===initial.id);
  const closed=advanceReferenceSignal(previous,[{...bar,time:epoch+1800,open:101,high:102,low:99,close:100}],snapshot,(epoch+3600)*1000);
  await saveReferenceAdvance(previous,closed.signal,closed.events);await saveReferenceAdvance(previous,closed.signal,closed.events);
  data=await load();assert.equal(data.record.status,'CLOSED');assert.equal(data.recordStatistics.closed,1);assert.equal(data.recordStatistics.expectancyR,data.record.netR);
  assert.ok(data.recordEvents.every(e=>e.signalId===initial.id));assert.equal(data.recordEvents.filter(e=>e.type==='ENTRY').length,1);assert.equal(data.recordEvents.filter(e=>e.type==='TARGET').length,1);assert.ok(data.recordEvents.length>data.recordStatistics.closed);
});
test('first subscription starts at high-water cursor, subsequent pages deliver committed events without exposing a member ID as data',async()=>{
 const first=await signalDeskFeed('fixture-a',{market:'thai'});assert.deepEqual(first.events,[]);
 const waiting={...begin(),id:'second-reference',symbol:'SCB'};await insertReferenceSignal(waiting);
 const next=await signalDeskFeed('fixture-a',{market:'thai',after:String(first.nextCursor)});
 assert.equal(next.events.length,1);assert.equal(next.events[0].symbol,'SCB');assert.ok(next.nextCursor>first.nextCursor);
 await saveObservation(snapshot,epoch*1000+300000);const filtered=await signalDeskFeed('fixture-a',{market:'thai',favorites:['PTT']});
 assert.equal(filtered.rows.length,2);assert.ok(filtered.rows.every(r=>r.symbol==='PTT'));
});
test('native D1 migration and signal/event transaction preserve identical lifecycle behaviour',async()=>{
 const configPath=join(dir,'wrangler.json');writeFileSync(configPath,JSON.stringify({name:'signal-fixture',compatibility_date:'2026-10-07',d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
 const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});assert.equal(migration.status,0,migration.stderr.slice(-300));
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:join(dir,'.wrangler/state/v3')}});
 try{await withD1Database(proxy.env.DB,async()=>{
  const s=begin();await insertReferenceSignal(s);const previous=(await activeReferenceSignals('thai'))[0];const result=advanceReferenceSignal(previous,[bar],snapshot,(epoch+1800)*1000);
  await saveReferenceAdvance(previous,result.signal,result.events);await saveReferenceAdvance(previous,result.signal,result.events);
  const rows=await storage.all('SELECT * FROM signal_desk_events');assert.equal(rows.length,2);assert.equal((await activeReferenceSignals('thai'))[0].status,'OPEN');
  await assert.rejects(storage.run('UPDATE signal_desk_events SET type=?','STOP'));
 });}finally{await proxy.dispose();}
});
