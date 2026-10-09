import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('cloud batches persist, coalesce, retry, reclaim expired leases and deduplicate ledger events',async context=>{
  const directory=mkdtempSync(join(tmpdir(),'nugaom-cloud-jobs-'));
  process.env.DATABASE_PATH=join(directory,'test.sqlite');
  const start=Date.parse('2026-10-07T10:30:00+07:00');
  context.mock.timers.enable({apis:['Date'],now:start});
  const {createCloudScanner}=await import('./cloud-jobs.mjs');
  const {storage}=await import('../storage/database.mjs');
  const {sharedDatabase}=await import('../storage/sqlite.mjs');
  const {createSignal,saveAdvance,claimRun,recordScanProgress}=await import('./store.mjs');
  let open=true,calls=0,fail=false;
  const sent=[],queue={async sendBatch(messages){sent.push(...messages.map(m=>m.body.id));}};
  const scanner=createCloudScanner({
    readiness:()=>({markets:[{id:'thai',status:'active'}]}),
    windowFor:()=>({key:'2026-10-07',monitor:open,candidate:true,symbols:['PTT','ADVANC']}),
    runMarket:{thai:async(_now,task)=>{
      calls++;if(fail)throw Error('NETWORK_INTERRUPTED');
      const plan={id:'fixture',side:'LONG',entry:100,stopLoss:98,tp1:104};
      const signal=await createSignal({market:'thai',symbol:task.symbols[0],sessionDay:'2026-10-07',plan,source:'FIXTURE'});
      if(signal)await saveAdvance({...signal,status:'OPEN',entryPrice:100.2,enteredAt:new Date().toISOString()},[{type:'ENTRY',barTime:1791342900,price:100.2}]);
      for(const symbol of task.symbols)await recordScanProgress('thai','2026-10-07',symbol,'done');
      return {status:'complete'};
    }},
  });
  try{
    assert.equal((await scanner.scheduleScans(queue,start)).dispatched,1);
    const first=sent[0];
    assert.equal((await scanner.scheduleScans(queue,start+300000)).dispatched,0);
    assert.equal((await storage.first('SELECT COUNT(*) AS n FROM scanner_jobs')).n,1);
    const delivered=await Promise.all([scanner.consumeScan(first,start),scanner.consumeScan(first,start)]);
    assert.equal(delivered.filter(r=>r.status==='done').length,1);assert.equal(calls,1);
    assert.equal((await scanner.consumeScan(first,start)).status,'ignored');
    assert.equal((await storage.first("SELECT COUNT(*) AS n FROM auto_pick_events WHERE event_type='ENTRY'")).n,1);
    context.mock.timers.setTime(start+600000);
    assert.equal((await scanner.scheduleScans(queue,Date.now())).dispatched,1);
    const second=sent.at(-1);fail=true;
    assert.equal((await storage.first('SELECT priority FROM scanner_jobs WHERE id=?',second)).priority,0);
    assert.equal((await scanner.consumeScan(second,Date.now())).status,'retry');
    assert.equal((await storage.first('SELECT state FROM scanner_jobs WHERE id=?',second)).state,'retry');
    assert.equal((await scanner.consumeScan(second,Date.now())).status,'ignored');
    context.mock.timers.setTime(start+660001);fail=false;
    assert.equal((await scanner.consumeScan(second,Date.now())).status,'done');
    assert.equal((await storage.first('SELECT attempts FROM scanner_jobs WHERE id=?',second)).attempts,2);
    assert.equal((await storage.first("SELECT COUNT(*) AS n FROM auto_pick_events WHERE event_type='ENTRY'")).n,1);
    context.mock.timers.setTime(start+900000);
    await scanner.scheduleScans(queue,Date.now());const third=sent.at(-1);
    await storage.run("UPDATE scanner_jobs SET state='running',lease_until=?,lease_token='lost-worker' WHERE id=?",Date.now()-1,third);
    assert.equal((await scanner.consumeScan(third,Date.now())).status,'done');
    const run=await claimRun('thai','crashed-run');
    await storage.run('UPDATE auto_pick_runs SET started_at=? WHERE id=?',new Date(Date.now()-180001).toISOString(),run);
    assert.equal(await claimRun('thai','crashed-run',{retryFailed:true,staleMs:180000}),run);
    context.mock.timers.setTime(start+1200000);
    await scanner.scheduleScans(queue,Date.now());const fourth=sent.at(-1);open=false;
    assert.equal((await scanner.consumeScan(fourth,Date.now())).status,'cancelled');
    assert.equal((await storage.first('SELECT state FROM scanner_jobs WHERE id=?',fourth)).state,'cancelled');
    await storage.run(`INSERT INTO scanner_jobs(id,market,session_key,slot,payload_json,available_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`,'a'.repeat(64),'thai','2026-10-06','old',JSON.stringify({symbols:['PTT']}),0,new Date(start).toISOString(),new Date(start).toISOString());
    await scanner.scheduleScans(queue,Date.now());
    assert.equal((await storage.first('SELECT state FROM scanner_jobs WHERE id=?','a'.repeat(64))).state,'cancelled');
  }finally{sharedDatabase().close();context.mock.timers.reset();rmSync(directory,{recursive:true,force:true});}
});
