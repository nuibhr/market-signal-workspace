import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Compile the ACTUAL route modules with only infrastructure dependencies replaced.
// Requests exercise guard ordering, including demo and malformed-body branches.
test('direct portfolio and connector URLs deny guests/members before provider calls or file reads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'canonical-route-'));
 globalThis.__canonicalActor=null;globalThis.__canonicalProviderCalls=0;
 try{
  for(const route of ['equity/portfolio','tfex/portfolio','forex/mt5/connector']){
   const outfile=join(dir,route.replaceAll('/','-')+'.mjs');
   await build({entryPoints:[resolve('src/app/api',route,'route.js')],outfile,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixtures',setup(b){
    b.onResolve({filter:/membership\/(server|store)\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
    b.onResolve({filter:/market-data\/broker-portfolio\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
    b.onResolve({filter:/security\/request-guard\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('server.mjs')?`export const currentMember=async()=>globalThis.__canonicalActor;export const sameOrigin=()=>true;`:
     a.path.endsWith('store.mjs')?`export const isAdmin=m=>m?.role==='owner';`:
     a.path.endsWith('broker-portfolio.mjs')?`export const readBrokerPortfolio=async()=>{globalThis.__canonicalProviderCalls++;throw Error('secret-provider-error')};`:
     `export const rateLimit=async()=>null;export const readJsonBody=r=>r.json();export const requestErrorResponse=()=>Response.json({error:'INVALID_REQUEST'},{status:400});`,loader:'js'}));
   }}]});
   const module=await import(pathToFileURL(outfile));
   for(const actor of [null,{id:'customer',role:'customer'}])for(const method of ['GET','POST'].filter(m=>module[m])){
    globalThis.__canonicalActor=actor;
    for(const suffix of ['?demo=true','?isSandbox=true','?owner=other&format=relay']){
     const response=await module[method](new Request('https://app.invalid/api/'+route+suffix,{method,headers:{origin:'https://app.invalid','content-type':'application/json','x-owner':'true'},...(method==='POST'?{body:'{"isDemo":true,"isSandbox":true,"appSecret":"SECRET"}'}:{})}));
     assert.equal(response.status,actor?403:401);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(!JSON.stringify(await response.json()).includes('SECRET'));
    }
   }
   if(module.POST){globalThis.__canonicalActor={id:'owner-A',role:'owner'};
    const response=await module.POST(new Request('https://app.invalid/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brokerId:'022',accountNo:'owner-B-account',appId:'a',appSecret:'SECRET',appCode:'b'})}));
    assert.equal(response.status,403);
   }
  }
  assert.equal(globalThis.__canonicalProviderCalls,0);
 }finally{delete globalThis.__canonicalActor;delete globalThis.__canonicalProviderCalls;await rm(dir,{recursive:true,force:true});}
});

test('account portfolio submission is owner-only without changing redeem or renewal',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'canonical-account-'));
 globalThis.__canonicalActor=null;globalThis.__canonicalAccountWrites=[];
 try{
  const outfile=join(dir,'account.mjs');
  await build({entryPoints:[resolve('src/app/api/account/route.js')],outfile,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixtures',setup(b){
   b.onResolve({filter:/membership\/(server|store)\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
   b.onResolve({filter:/security\/request-guard\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
   b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('server.mjs')?`export const currentMember=async()=>globalThis.__canonicalActor;export const currentAccount=async()=>({ok:true});export const sameOrigin=()=>true;export const privateHeaders={'Cache-Control':'private, no-store'};export const errorResponse=()=>Response.json({error:'INTERNAL_ERROR'},{status:500});`:
    a.path.endsWith('store.mjs')?`export const isAdmin=m=>m?.role==='owner';export const submitPortfolio=async()=>globalThis.__canonicalAccountWrites.push('portfolio');export const redeemCode=async()=>globalThis.__canonicalAccountWrites.push('redeem');export const requestRenewal=async()=>globalThis.__canonicalAccountWrites.push('renewal');`:
    `export class RequestError extends Error{};export const rateLimit=async()=>null;export const readJsonBody=r=>r.json();export const requestErrorResponse=()=>Response.json({error:'INVALID_REQUEST'},{status:400});`,loader:'js'}));
  }}]});
  const {POST}=await import(pathToFileURL(outfile));
  const request=action=>new Request('https://app.invalid/api/account',{method:'POST',headers:{'content-type':'application/json','x-owner':'true'},body:JSON.stringify({action,broker:'fixture',number:'SECRET_ACCOUNT',role:'owner'})});
  for(const actor of [null,{id:'customer'},{id:'demo',demo:true}]){
   globalThis.__canonicalActor=actor;
   const response=await POST(request('portfolio'));
   assert.equal(response.status,actor?403:401);assert.ok(!JSON.stringify(await response.json()).includes('SECRET_ACCOUNT'));
  }
  assert.deepEqual(globalThis.__canonicalAccountWrites,[]);
  globalThis.__canonicalActor={id:'customer'};
  for(const action of ['redeem','renewal'])assert.equal((await POST(request(action))).status,200);
  assert.deepEqual(globalThis.__canonicalAccountWrites,['redeem','renewal']);
  globalThis.__canonicalActor={id:'owner',role:'owner'};
  assert.equal((await POST(request('portfolio'))).status,200);
  assert.deepEqual(globalThis.__canonicalAccountWrites,['redeem','renewal','portfolio']);
 }finally{delete globalThis.__canonicalActor;delete globalThis.__canonicalAccountWrites;await rm(dir,{recursive:true,force:true});}
});

test('data policy exposes read-only customer capabilities without feed or broker claims',async()=>{
 const {GET}=await import('../../../app/api/data-policy/route.js');
 const response=GET(),data=await response.json();
 assert.equal(data.customerAccess,'read-only');assert.equal(data.realtimeVerified,false);
 assert.deepEqual(data.personalBroker.adapters,[]);
 for(const key of ['customerConnectionEnabled','credentialInputEnabled','csvUploadEnabled','personalRealtimeAcrossAllMarkets'])assert.equal(data.personalBroker[key],false);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
