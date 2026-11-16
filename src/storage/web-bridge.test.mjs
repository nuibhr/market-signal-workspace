import test from 'node:test';import assert from 'node:assert/strict';
import {webBridge,webStatement} from './web-bridge.mjs';
import {createWebBridgeClient} from './web-client.mjs';
import gateway,{proxyRequest} from '../../deploy/cloudflare/vps-proxy.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
const secret='fixture-'.repeat(8),url='https://data.example/';
test('web gateway denies missing credentials, schema changes and invalid bindings',async()=>{
 assert.equal((await webBridge(new Request(url,{method:'POST'}),{WEB_BRIDGE_SECRET:secret})).status,401);
 for(const sql of ['DROP TABLE members','SELECT 1; DELETE FROM members','PRAGMA foreign_keys=OFF','SELECT * FROM sqlite_master','SELECT 1 -- x'])assert.throws(()=>webStatement({sql,params:[]}));
 assert.throws(()=>webStatement({sql:'SELECT ?',params:[{}]}));
 assert.deepEqual(webStatement({sql:'SELECT 1',params:[]}),{sql:'SELECT 1',params:[]});
});
test('web client preserves batched D1 results and never retries uncertain writes',async()=>{
 let calls=0,received;
 const client=createWebBridgeClient({url,secret,fetcher:async(u,options)=>{
  calls++;received={url:u.toString(),headers:options.headers,body:JSON.parse(options.body)};
  return Response.json({results:[{results:[{id:'member-fixture'}],changes:1}]});
 }});
 assert.equal((await client.storage.first('SELECT id FROM members WHERE id=?','member-fixture')).id,'member-fixture');
 assert.equal(received.url,url+'v1/storage');assert.equal(received.headers.Authorization,`Bearer ${secret}`);
 assert.deepEqual(received.body.queries[0].params,['member-fixture']);
 const broken=createWebBridgeClient({url,secret,fetcher:async()=>{calls++;throw Error('private-provider-data');}});
 await assert.rejects(broken.storage.run('UPDATE members SET display_name=? WHERE id=?','Fixture','member-fixture'),/WEB_BRIDGE_UNREACHABLE/);
 assert.equal(calls,2,'Exactly one attempt per operation');
});
test('pure edge proxy overwrites forged forwarding headers and preserves cookies and redirects',async()=>{
 let seen;
 const r=await proxyRequest(new Request('https://web.example/api/auth/line/callback?code=fixture',{headers:{cookie:'session=fixture','x-nugaom-origin-secret':'forged','x-forwarded-host':'attacker.example','cf-connecting-ip':'192.0.2.1'}}),{VPS_ORIGIN:'https://origin.example',VPS_ORIGIN_SECRET:secret},async(url,options)=>{
  seen={url:url.toString(),...options};return new Response(null,{status:302,headers:{Location:'https://web.example/account','Set-Cookie':'session=new-fixture; Secure; HttpOnly'}});
 });
 assert.equal(seen.url,'https://origin.example/api/auth/line/callback?code=fixture');assert.equal(seen.headers.get('x-forwarded-host'),'web.example');assert.equal(seen.headers.get('x-nugaom-origin-secret'),secret);assert.equal(seen.headers.get('cookie'),'session=fixture');assert.equal(seen.redirect,'manual');
 assert.equal(r.status,302);assert.match(r.headers.get('set-cookie'),/HttpOnly/);
});
test('native D1 gateway commits bound writes and rolls back an entire failing batch',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'web-d1-')),configPath=join(dir,'wrangler.json');
 writeFileSync(configPath,JSON.stringify({name:'web-d1-fixture',compatibility_date:'2026-10-07',d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
 const migrated=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});assert.equal(migrated.status,0,'D1 migrations apply');
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:join(dir,'.wrangler/state/v3')}});
 try{
  const env={DB:proxy.env.DB,WEB_BRIDGE_SECRET:secret};
  const client=createWebBridgeClient({url,secret,fetcher:(u,opts)=>webBridge(new Request(u,opts),env)});
  await client.storage.run('INSERT INTO provider_cache VALUES(?,?,?)','web-fixture','{"value":35}',123);
  assert.equal((await client.storage.first('SELECT payload_json FROM provider_cache WHERE id=?','web-fixture')).payload_json,'{"value":35}');
  await assert.rejects(client.storage.batch([{sql:'INSERT INTO provider_cache VALUES(?,?,?)',params:['rollback-fixture','{}',123]},{sql:'INSERT INTO provider_cache VALUES(?,?,?)',params:['web-fixture','duplicate-private-payload',123]}]),/WEB_STORAGE_UNAVAILABLE/);
  assert.equal(await client.storage.first('SELECT id FROM provider_cache WHERE id=?','rollback-fixture'),null,'First mutation rolls back when the second fails');
 }finally{await proxy.dispose();rmSync(dir,{recursive:true,force:true});}
});
test('Worker entry accepts the runtime execution context without treating it as a fetch function',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return new Response('fixture-origin');};
  const r=await gateway.fetch(new Request('https://web.example/'),{VPS_ORIGIN:'https://origin.example',VPS_ORIGIN_SECRET:secret},{waitUntil(){}});
  assert.equal(r.status,200);assert.equal(await r.text(),'fixture-origin');assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});
test('network retries are limited to SELECT; INSERT RETURNING and AI remain single attempts',async()=>{
 let calls=0;
 const read=createWebBridgeClient({url,secret,fetcher:async()=>{if(++calls===1)throw Error('transient');return Response.json({results:[{results:[{healthy:1}],changes:0}]});}});
 assert.equal((await read.storage.first('SELECT 1 AS healthy')).healthy,1);assert.equal(calls,2);
 calls=0;const write=createWebBridgeClient({url,secret,fetcher:async()=>{calls++;throw Error('uncertain');}});
 await assert.rejects(write.storage.first('INSERT INTO request_limits VALUES(?,1,?) RETURNING hits','fixture',123));assert.equal(calls,1);
});
