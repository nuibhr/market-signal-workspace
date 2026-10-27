import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalHandler} from './handlers.mjs';
import {createOwnerForexHandlers} from '../../../forex-mt5/owner-handlers.mjs';
import {ForexStore} from '../../../forex-mt5/store.mjs';
import {ownerGuard} from './http.mjs';
const now=Date.parse('2026-10-26T12:00:00Z');
const req=(url,body,headers={})=>new Request('http://localhost:3000'+url,{method:body?'POST':'GET',headers:{origin:'http://localhost:3000','content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
test('real Request/Response handler rejects unknown markets before loader and ignores client tier/cap',async()=>{
 let loaded=0;
 const GET=createCanonicalHandler({clock:()=>now,currentMember:async()=>null,membershipFor:()=>({tier:'guest'}),loadInputs:async market=>{loaded++;return Array.from({length:20},(_,i)=>({market,symbol:'S'+i,instrumentId:'F:'+i,providerId:'unknown',dataMode:'EOD',dataKind:'SCANNER_CANDIDATE',providerState:'UNAVAILABLE'}));}});
 const invalid=await GET(req('/api/market-data/v1?market=garbage'));assert.equal(invalid.status,400);assert.equal(loaded,0);
 const response=await GET(req('/api/market-data/v1?market=thai&tier=ULTIMATE&cap=100&diagnostic=1&all=1'));
 assert.equal(response.headers.get('cache-control'),'private, no-store');const data=await response.json();assert.equal(data.records.length,1);assert.equal(data.entitlement.tier,'GUEST');
});
test('compatibility rebuilds stats and removes hidden rows, payloads and aggregate data',async()=>{
 const GET=createCanonicalHandler({market:'thai',legacyView:'thai',currentMember:async()=>({id:'fixture'}),membershipFor:()=>({tier:'subscriber',planId:'starter'}),loadInputs:async()=>Array.from({length:20},(_,i)=>({market:'thai',symbol:'S'+i,instrumentId:'F:'+i,dataKind:'SCANNER_CANDIDATE',providerState:'UNAVAILABLE',secret:'SECRET',data:{price:999}}))});
 const body=await (await GET(req('/api/thai-screener'))).json();assert.equal(body.rows.length,3);assert.equal(body.stats.expected,3);assert.ok(!JSON.stringify(body).includes('SECRET'));assert.ok(!JSON.stringify(body).includes('999'));assert.equal(body.stats.index,null);
 const canonical=await(await GET(req('/api/thai-screener?format=canonical'))).json();assert.equal(canonical.schemaVersion,'nugaom.market-data.v1');
});
test('owner guard denies guest and ordinary member before any protected operation',async()=>{
 for(const member of [null,{id:'member',role:'customer'}]){
  const guard=ownerGuard({currentMember:async()=>member,isOwner:m=>m.role==='owner'});
  const denied=await guard(req('/api/tfex/portfolio?demo=true',null,{'x-role':'owner'}));assert.equal(denied.status,member?403:401);assert.ok(!JSON.stringify(await denied.json()).includes('accountNo'));
 }
});
test('owner MT5 route excludes legacy tokens, checks current role, isolates owners, expiry and revoke',async()=>{
 const store=new ForexStore(),env={NODE_ENV:'development',FOREX_MT5_ENABLED:'true',FOREX_MT5_VANTAGE_SERVERS:'VantageMarkets-Demo',FOREX_MT5_DATABASE_PATH:':memory:'};
 let actor=null,roleAllowed=true;
 const handlers=createOwnerForexHandlers({env,getStore:()=>store,currentMember:async()=>actor,isOwner:m=>m.role==='owner',loadOwner:async id=>({id,role:roleAllowed?'owner':'customer'}),cookieStore:async()=>({get:()=>null}),isLoginConfigured:()=>true});
 try{
  assert.equal((await handlers.GET(req('/api/forex/mt5'))).status,401);
  actor={id:'customer',role:'customer'};
  assert.equal((await handlers.POST(req('/api/forex/mt5',{action:'pair',server:'VantageMarkets-Demo'}))).status,403);
  const legacy=store.pair('member:customer','VantageMarkets-Demo',{servers:['VantageMarkets-Demo']});
  assert.equal((await handlers.POST(req('/api/forex/mt5',{kind:'feed'},{authorization:'Bearer '+legacy.token}))).status,401);
  actor={id:'A',role:'owner'};
  const pairing=await handlers.POST(req('/api/forex/mt5',{action:'pair',server:'VantageMarkets-Demo'}));assert.equal(pairing.status,201);
  const token=(await pairing.json()).token;assert.equal(store.serviceOwner(token),'A');
  assert.equal((await handlers.POST(req('/api/forex/mt5',{action:'pair',server:'VantageMarkets-Demo'},{authorization:'Bearer '+token}))).status,403);
  actor={id:'B',role:'owner'};
  assert.equal((await (await handlers.GET(req('/api/forex/mt5?owner=A'))).json()).snapshot,null);
  await handlers.POST(req('/api/forex/mt5',{action:'revoke'}));assert.equal(store.serviceOwner(token),'A');
  roleAllowed=false;
  assert.equal((await handlers.POST(req('/api/forex/mt5',{kind:'feed'},{authorization:'Bearer '+token}))).status,403);
  roleAllowed=true;actor={id:'A',role:'owner'};
  await handlers.POST(req('/api/forex/mt5',{action:'revoke'}));assert.equal(store.serviceOwner(token),null);
  const expired=store.pair('owner:A','VantageMarkets-Demo',{servers:['VantageMarkets-Demo']},now-8*86400000);assert.equal(store.serviceOwner(expired.token,now),null);
  const audit=JSON.stringify(store.db.prepare('SELECT * FROM forex_owner_audit').all());assert.ok(audit.includes('pair'));assert.ok(audit.includes('revoke'));assert.ok(!audit.includes(token));
 }finally{store.db.close();}
});
test('legacy Thai empty-state arrays and Radar rows remain safe for existing renderers',async()=>{
 const common={market:'thai',currentMember:async()=>({}),membershipFor:()=>({tier:'trial'}),loadInputs:async()=>[{market:'thai',symbol:'S0',instrumentId:'SET:S0',dataKind:'SCANNER_CANDIDATE',providerState:'UNAVAILABLE'}]};
 const thai=await(await createCanonicalHandler({...common,legacyView:'thai'})(req('/api/thai-screener'))).json();
 assert.deepEqual(thai.rows[0].criteria.map(x=>x.id),[]);assert.equal(thai.rows[0].score,null);assert.equal(thai.rows[0].price,null);
 const radar=await(await createCanonicalHandler({...common,legacyView:'radar'})(req('/api/dr-strategy/feed?market=thai'))).json();
 assert.deepEqual(radar.scoredThaiStocks,[]);assert.equal(radar.unavailable.length,1);
});
