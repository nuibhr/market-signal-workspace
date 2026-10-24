import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {scannerBridge,SCANNER_LEASE_MS} from './bridge.mjs';
import {createScannerClient} from './client.mjs';
import {encodeScannerQuery,decodeScannerQuery} from './queries.mjs';

test('scanner protocol refuses arbitrary SQL, private cache keys and invalid bindings',()=>{
  assert.throws(()=>encodeScannerQuery({sql:'SELECT * FROM members'}),/SCANNER_QUERY_NOT_ALLOWED/);
  assert.throws(()=>decodeScannerQuery({id:'__proto__',params:[]}),/INVALID_SCANNER_QUERY/);
  assert.throws(()=>decodeScannerQuery({id:'cache.get',params:['private-member',0]}),/INVALID_SCANNER_CACHE/);
  assert.throws(()=>decodeScannerQuery({id:'market.release',params:['wrong-count']}),/INVALID_SCANNER_QUERY/);
  assert.throws(()=>createScannerClient({url:'http://example.com/v1/scanner',secret:'x'.repeat(32),instance:'fixture'}),/INVALID_SCANNER_CONFIGURATION/);
});

test('native D1 bridge keeps one VPS owner, rolls back stale writes, and runs the actual signal repository',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'nugaom-scanner-bridge-'));
  const configPath=join(directory,'wrangler.json');
  writeFileSync(configPath,JSON.stringify({name:'scanner-bridge-fixture',compatibility_date:'2026-10-07',
    d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
  const migrated=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  assert.equal(migrated.status,0,'Native D1 migrations apply');
  const {getPlatformProxy}=await import('wrangler');
  const proxy=await getPlatformProxy({configPath,persist:{path:join(directory,'.wrangler/state/v3')}});
  let now=Date.parse('2026-10-15T05:30:00Z');
  const secret='private-fixture-key-'.repeat(3),url='https://scanner.example/v1/scanner';
  const env={DB:proxy.env.DB,SCANNER_BRIDGE_SECRET:secret,SCANNER_BRIDGE_ENABLED:'true'};
  const fetcher=(url,options)=>scannerBridge(new Request(url,options),env,{clock:()=>now});
  const old=createScannerClient({url,secret,instance:'old-vps',fetcher});
  const next=createScannerClient({url,secret,instance:'new-vps',fetcher});
  const {withScannerDatabase}=await import('../storage/database.mjs');
  const store=await import('../signals/store.mjs');
  try{
    assert.equal((await scannerBridge(new Request(url,{method:'POST'}),env)).status,401);
    assert.equal((await old.status()).owner,null,'Preflight never takes the lease');
    await old.heartbeat();
    await assert.rejects(next.heartbeat(),/SCANNER_LEASE_BUSY/);
    assert.equal((await old.status()).owner,'old-vps');
    // A fresh run exercises the catalogue through the real repositories,
    // including profile reads, observations, market leases and cache writes.
    await withScannerDatabase(old.storage,async()=>{
      const token=await store.claimSignalLease('thai',now);
      assert.ok(token);assert.equal(await store.claimSignalLease('thai',now),null);
      await store.saveObservation({market:'thai',symbol:'PTT',status:'UNAVAILABLE',checkedAt:new Date(now).toISOString()},now+600000);
      assert.equal((await store.storedObservation('thai','PTT')).status,'UNAVAILABLE');
      assert.equal((await store.observationSchedule('thai')).length,1);
      assert.deepEqual(await store.allCostProfiles(),[]);
      assert.deepEqual(await store.activeReferenceSignals('thai'),[]);
      const signal={id:'fixture-signal',market:'thai',symbol:'PTT',mode:'breakout',profile:'standard',status:'WAITING',publishedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),plan:{entry:100},context:{latest4hTime:now/1000-14400}};
      assert.equal(await store.insertReferenceSignal(signal),true);
      assert.equal(await store.insertReferenceSignal(signal),false,'Duplicate publish is idempotent');
      const previous=(await store.activeReferenceSignals('thai'))[0];
      await store.saveReferenceAdvance(previous,{...previous,status:'OPEN'},[{type:'ENTRY',createdAt:new Date(now).toISOString(),price:100}]);
      assert.equal((await store.activeReferenceSignals('thai'))[0].revision,1);
      await store.releaseSignalLease('thai',token,now);
    });
    const {createSignalRunner}=await import('../signals/runner.mjs');
    const result=await withScannerDatabase(old.storage,()=>createSignalRunner({clock:()=>now,allowed:()=>true,load:async()=>{throw Error('fixture-source-unavailable');}})('dr',{maxSymbols:1}));
    assert.equal(result.status,'partial');assert.equal(result.scanned,1);
    // Invalid queries are rejected before touching the ownership lease.
    assert.equal((await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({action:'query',holder:randomUUID(),instance:'attacker',queries:[{id:'members',params:[]}]})})).status,400);
    // After expiry a different VPS takes over. Old writes must fail in the
    // same D1 transaction and must not extend or overwrite the new lease.
    now+=SCANNER_LEASE_MS+1;await next.heartbeat();
    await assert.rejects(withScannerDatabase(old.storage,()=>store.saveObservation({market:'thai',symbol:'STALE',checkedAt:new Date(now).toISOString()},now)),/SCANNER_LEASE_BUSY/);
    assert.equal((await next.status()).owner,'new-vps');
    assert.equal(await proxy.env.DB.prepare("SELECT * FROM signal_desk_observations WHERE symbol='STALE'").first(),null);
    await old.release();assert.equal((await next.status()).owner,'new-vps','Old process cannot release the new lease');
    await next.release();
    await assert.rejects(next.storage.all('SELECT symbol,next_scan_ms FROM signal_desk_observations WHERE market=?','thai'),/SCANNER_LEASE_BUSY/,'Buffered work cannot reacquire ownership after graceful stop');
    await old.heartbeat();assert.equal((await old.status()).owner,'old-vps','Graceful handoff has no fixed two-minute delay');
    now+=SCANNER_LEASE_MS+1;
    await assert.rejects(old.storage.all('SELECT symbol,next_scan_ms FROM signal_desk_observations WHERE market=?','thai'),/SCANNER_LEASE_BUSY/,'An expired query cannot reacquire a lease');
    await old.release();
  }finally{await proxy.dispose();rmSync(directory,{recursive:true,force:true});}
});
