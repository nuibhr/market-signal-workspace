import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ForexStore} from './store.mjs';
import {createForexHandlers} from './handlers.mjs';
import {receiverConfiguration,developmentTransport} from './runtime-policy.mjs';
import {localFiles,localFileDirectory} from './local-files.mjs';

const temporary=mkdtempSync(join(tmpdir(),'nugaom-forex-merge-'));
process.env.DATABASE_PATH=join(temporary,'member-fixture.sqlite');
process.env.SESSION_SECRET='fixture-session-'.repeat(5);
process.env.PORTFOLIO_HASH_SECRET='fixture-portfolio-'.repeat(5);
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {upsertLineMember,createSession,sessionMember,deleteSession}=await import('../membership/store.mjs');
const origin='http://localhost:3000';
const baseEnv={NODE_ENV:'development',FOREX_MT5_ENABLED:'true',FOREX_MT5_VANTAGE_SERVERS:'VantageMarkets-Demo',FOREX_MT5_DATABASE_PATH:':memory:'};
const cookie=(request,name)=>request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
async function member() {
  const row=await upsertLineMember({lineId:'U'+randomBytes(16).toString('hex'),displayName:'Fixture Forex member'});
  const session=await createSession(row.id);
  return {row,session,cookie:`nugaom_session=${session.value}`};
}
function fixture(extra={}) {
  const store=new ForexStore();
  const env={...baseEnv,...extra};
  const handlers=createForexHandlers({env,getStore:()=>store,isLoginConfigured:()=>true,
    currentMember:request=>sessionMember(cookie(request,'nugaom_session')),
    cookieStore:request=>({get:name=>({value:cookie(request,name)})}),
  });
  return {store,handlers,env,close:()=>store.db.close()};
}
function request(actor,body,headers={},url=origin+'/api/forex/mt5') {
  return new Request(url,{method:body===undefined?'GET':'POST',headers:{...(actor?{cookie:actor.cookie}:{}),...(body===undefined?{}:{origin,'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
async function result(response,status=200) {
  assert.equal(response.status,status);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  return response.json();
}
function packet() {
  return {schema_version:1,broker_id:'vantage',server:'VantageMarkets-Demo',company:'Vantage Global Limited',
    sent_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),sequence:1,kind:'universe',sync_id:1,part:0,parts:1,
    instruments:[{broker_symbol:'EURUSD.a',canonical_symbol:null,category:'fx',description:'Fixture Euro / USD',
      digits:5,point:0.00001,contract_size:100000,volume_min:0.01,volume_max:50,volume_step:0.01,
      currency_base:'EUR',currency_profit:'USD',currency_margin:'EUR',trade_mode:4,session:null}]};
}

test('unified member sessions pair on local Node without enabling an anonymous pilot login',async()=>{
  const f=fixture(),actor=await member();
  try {
    const anonymous=await result(await f.handlers.GET(request(null)));
    assert.equal(anonymous.authorized,false);assert.equal(anonymous.capabilities.local,false);
    assert.equal(anonymous.capabilities.endpoint,origin+'/api/forex/mt5');
    await result(await f.handlers.POST(request(null,{action:'pair',server:'VantageMarkets-Demo'})),401);
    await result(await f.handlers.POST(request(null,{action:'local-session'})),403);
    const pairing=await result(await f.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo'})),201);
    assert.match(pairing.token,/^[A-Za-z0-9_-]{43}$/);
    assert.ok(f.store.connection(`member:${actor.row.id}`));
    assert.equal((await result(await f.handlers.GET(request(actor)))).authorized,true);
    assert.equal(await sessionMember(actor.session.value).then(m=>m.id),actor.row.id,'Forex pairing does not replace the LINE session');
  } finally {f.close();}
});

test('connector → API → member view isolates snapshots, loses access on logout and supports revocation',async()=>{
  const f=fixture(),owner=await member(),other=await member();
  try {
    const pairing=await result(await f.handlers.POST(request(owner,{action:'pair',server:'VantageMarkets-Demo'})),201);
    await result(await f.handlers.POST(request(null,packet(),{Authorization:`Bearer ${pairing.token}`})));
    const visible=await result(await f.handlers.GET(request(owner)));
    assert.equal(visible.snapshot.instruments.length,1);assert.equal(visible.snapshot.instruments[0].broker_symbol,'EURUSD.a');
    for(const key of ['line_id','portfolio_hash','token_hash','nugaom_session'])assert.ok(!JSON.stringify(visible).includes(key));
    assert.ok(!JSON.stringify(visible).includes(pairing.token));
    assert.equal((await result(await f.handlers.GET(request(other)))).snapshot,null);
    assert.equal((await result(await f.handlers.GET(request(null)))).snapshot,null);
    await deleteSession(owner.session.value);
    assert.equal((await result(await f.handlers.GET(request(owner)))).snapshot,null);
    await result(await f.handlers.POST(request(owner,{action:'revoke'})),401);
    const restored=await createSession(owner.row.id);owner.cookie=`nugaom_session=${restored.value}`;
    await result(await f.handlers.POST(request(owner,{action:'revoke'})));
    assert.equal((await result(await f.handlers.GET(request(owner)))).snapshot,null);
    await result(await f.handlers.POST(request(null,packet(),{Authorization:`Bearer ${pairing.token}`})),401);
  } finally {f.close();}
});

test('a signed-in member takes precedence over a legacy localhost pilot cookie',async()=>{
  const f=fixture({FOREX_MT5_LOCAL_MODE:'true'}),actor=await member();
  try {
    const pilot=f.store.localSession(),pilotOwner=f.store.localOwner(pilot);
    f.store.pair(pilotOwner,'VantageMarkets-Demo',receiverConfiguration(f.env));
    actor.cookie+=`; forex_local_session=${pilot}`;
    const view=await result(await f.handlers.GET(request(actor)));
    assert.equal(view.status,'disconnected');
    await result(await f.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo'})),201);
    assert.ok(f.store.connection(`member:${actor.row.id}`));assert.ok(f.store.connection(pilotOwner));
  } finally {f.close();}
});

test('cross-origin, unsupported server, injected fields and oversized streams are rejected',async()=>{
  const f=fixture(),actor=await member();
  try {
    await result(await f.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo'},{origin:'https://other.fixture.invalid'})),403);
    await result(await f.handlers.POST(request(actor,{action:'pair',server:'Other-Demo'})),403);
    await result(await f.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo',owner:'another-member'})),400);
    await result(await f.handlers.POST(request(actor,'x'.repeat(512001))),413);
    await result(await f.handlers.POST(request(actor,'[]')),400);
    assert.equal(f.store.connection(`member:${actor.row.id}`),undefined);
  } finally {f.close();}
});

test('member file pairing on the Mac sandbox requires LINE and remains unavailable in production',async()=>{
  const path=join(temporary,'mt5-files');
  const f=fixture({FOREX_MT5_MEMBER_LOCAL_FILES:'true',FOREX_MT5_LOCAL_FILES_PATH:path}),actor=await member();
  try {
    assert.equal(localFileDirectory(f.env),path);
    assert.equal(localFileDirectory({...f.env,NODE_ENV:'production'}),null);
    const view=await result(await f.handlers.GET(request(null)));
    assert.equal(view.capabilities.localFiles,true);assert.equal(view.capabilities.local,false);
    await result(await f.handlers.POST(request(null,{action:'local-file',server:'VantageMarkets-Demo'})),401);
    const pairing=await result(await f.handlers.POST(request(actor,{action:'local-file',server:'VantageMarkets-Demo'})),201);
    assert.match(pairing.channel,/^[a-f0-9]{32}$/);assert.equal(pairing.token,undefined);
    assert.ok(localFiles.state(`member:${actor.row.id}`));
    const ownerView=await result(await f.handlers.GET(request(actor)));
    assert.equal(ownerView.local_file.channel,pairing.channel);
    assert.equal((await result(await f.handlers.GET(request(await member())))).local_file,null);
    await result(await f.handlers.POST(request(actor,{action:'revoke'})));
    assert.equal(localFiles.state(`member:${actor.row.id}`),null);
  } finally {localFiles.stop(`member:${actor.row.id}`);f.close();}
});

test('production requires HTTPS and can never authorize a development pilot session',async()=>{
  const f=fixture({NODE_ENV:'production',FOREX_MT5_LOCAL_MODE:'true'}),actor=await member();
  try {
    await result(await f.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo'})),403);
    await result(await f.handlers.POST(request(null,{action:'local-session'})),403);
    assert.equal(developmentTransport(request(actor),f.env),false);
    const production=fixture({NODE_ENV:'production',APP_ORIGIN:'https://nugaom.fixture.invalid'});
    try {
      await result(await production.handlers.POST(request(actor,{action:'pair',server:'VantageMarkets-Demo'},{origin:'https://nugaom.fixture.invalid'},'https://nugaom.fixture.invalid/api/forex/mt5')),201);
    } finally {production.close();}
  } finally {f.close();}
});

test('D1/Cloudflare and a membership database path fail closed before opening a Forex store',async()=>{
  for(const extra of [{STORAGE_PROVIDER:'d1'},{NUGAOM_CLOUD_BUILD:'true'},{AUTO_PICK_RUNTIME:'cloudflare'},
    {DATABASE_PATH:'/var/lib/nugaom/shared.sqlite',FOREX_MT5_DATABASE_PATH:'/var/lib/nugaom/./shared.sqlite'}]) {
    const env={...baseEnv,...extra};let opened=0;
    const handlers=createForexHandlers({env,currentMember:()=>null,cookieStore:()=>null,isLoginConfigured:()=>true,getStore:()=>{opened++;throw Error('must not open');}});
    const view=await result(await handlers.GET(request(null)));
    assert.equal(view.capabilities.enabled,false);assert.equal(view.snapshot,null);
    assert.ok(view.capabilities.disabledReason);
    await result(await handlers.POST(request(null,{action:'pair',server:'VantageMarkets-Demo'})),503);
    assert.equal(opened,0);
  }
});

test.after(()=>{sharedDatabase().close();rmSync(temporary,{recursive:true,force:true});});
