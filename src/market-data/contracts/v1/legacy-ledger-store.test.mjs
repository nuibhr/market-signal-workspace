import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'canonical-ledger-'));
process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {sharedDatabase}=await import('../../../storage/sqlite.mjs');
const {insertReferenceSignal}=await import('../../../signals/store.mjs');
const {SIGNAL_RULE}=await import('../../../signals/model.mjs');
const {tradeResults}=await import('../../../monitor/results-store.mjs');
const {ForexStore}=await import('../../../forex-mt5/store.mjs');
const store=new ForexStore(':memory:');
const deps={env:{FOREX_MT5_ENABLED:'true',FOREX_MT5_DATABASE_PATH:':memory:',STORAGE_PROVIDER:'sqlite'},getStore:()=>store};
test.after(()=>{store.db.close();sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('actual SQL selects capped references before filters and keeps other profiles/owners out',async()=>{
 for(let i=0;i<12;i++)await insertReferenceSignal({id:'record-'+i,ruleVersion:SIGNAL_RULE,market:'thai',symbol:i===11?'HIDDEN':'PTT',profile:'standard',mode:'breakout',status:i%2?'OPEN':'CLOSED',publishedAt:new Date(Date.UTC(2026,9,26,0,0,i)).toISOString(),updatedAt:'2026-10-26T01:00:00Z',context:{latest4hTime:1},plan:{entry:100,stopLoss:99},fills:[],netR:null});
 const customerProjection={cap:3,symbols:['PTT'],ownerConnection:null};
 const base=await tradeResults('customer',{market:'thai',customerProjection},deps);
 assert.deepEqual(base.signals.map(r=>r.id),['record-10','record-9','record-8']);
 for(const query of [{status:'OPEN'},{scope:'closed'},{page:99},{tradeKey:'swing:record-0'},{strategy:'orb'}]){
  const value=await tradeResults('customer',{market:'thai',customerProjection,...query},deps);
  assert.ok(value.signals.every(r=>base.signals.some(b=>b.key===r.key)));assert.ok(value.total<=3);
  assert.equal(value.summary.winRate,null);assert.equal(value.selectedKey,null);
 }
 const alien={id:'foreign',market:'forex',symbol:'EUR/USD',status:'OPEN',publishedAt:1};
 store.db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run('mt5:member:other:OtherBroker',alien.id,JSON.stringify(alien));
 const forex=await tradeResults('customer',{market:'forex',customerProjection:{cap:8,symbols:['EUR/USD'],ownerConnection:null}},deps);
 assert.equal(forex.signals.length,0);
});
