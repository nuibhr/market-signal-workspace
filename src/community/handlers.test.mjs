import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';

const temporary=mkdtempSync(join(tmpdir(),'nugaom-community-http-'));
process.env.DATABASE_PATH=join(temporary,'fixture.sqlite');
process.env.SESSION_SECRET='fixture-session-'.repeat(5);
process.env.PORTFOLIO_HASH_SECRET='fixture-portfolio-'.repeat(5);
process.env.ADMIN_LINE_IDS='U'+'a'.repeat(32);
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {upsertLineMember,createSession,sessionMember,deleteSession}=await import('../membership/store.mjs');
const {rateLimit}=await import('../security/request-guard.mjs');
const {createCommunityHandlers}=await import('./handlers.mjs');
const {createCommunityWriter}=await import('./writer.mjs');
const origin='https://community.fixture.invalid';
const handlers=createCommunityHandlers({
  currentMember:request=>sessionMember(request.headers.get('cookie')?.match(/(?:^|;\s*)nugaom_session=([^;]+)/)?.[1]),
  sameOrigin:request=>request.headers.get('origin')===origin,
});
async function fixture({active=false,admin=false}={}) {
  const member=await upsertLineMember({lineId:admin?process.env.ADMIN_LINE_IDS:'U'+randomBytes(16).toString('hex'),displayName:'Fixture member'});
  if(active)await storage.run("UPDATE members SET trial_ends_at=?,portfolio_status='verified' WHERE id=?",new Date(Date.now()+86400000).toISOString(),member.id);
  const session=await createSession(member.id);
  return {member,session,cookie:`nugaom_session=${session.value}`};
}
function request(actor,path='',body,headers={}) {
  return new Request(`${origin}/api/community${path}`,{method:body===undefined?'GET':'POST',headers:{origin,...(actor?{cookie:actor.cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify({operationId:randomUUID(),...body})})});
}
async function result(response,status) {
  assert.equal(response.status,status);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  return response.json();
}
const get=(actor,path='')=>handlers.GET(request(actor,path));
const post=(actor,body,headers)=>handlers.POST(request(actor,'',body,headers));
const roomBody={action:'send',kind:'room',channelId:'lounge',body:'Fixture hello'};

test('HTTP guards reject missing/revoked sessions, cross-origin writes and malformed requests',async()=>{
  assert.equal((await result(await get(null),401)).error,'LOGIN_REQUIRED');
  assert.equal((await result(await post(null,roomBody),401)).error,'LOGIN_REQUIRED');
  const actor=await fixture({active:true});
  assert.equal((await result(await post(actor,roomBody,{origin:'https://other.fixture.invalid'}),403)).error,'INVALID_ORIGIN');
  assert.equal((await result(await post(actor,'[]'),400)).error,'INVALID_JSON');
  assert.equal((await result(await post(actor,'x'.repeat(10001)),413)).error,'PAYLOAD_TOO_LARGE');
  assert.equal((await result(await post(actor,roomBody,{'Content-Type':'text/plain'}),415)).error,'CONTENT_TYPE_REQUIRED');
  assert.equal((await result(await get(actor,'?view=unknown'),400)).error,'INVALID_VIEW');
  await deleteSession(actor.session.value);
  assert.equal((await result(await get(actor),401)).error,'LOGIN_REQUIRED');
});

test('HTTP member flow stores one message, reads receipts and immediately applies membership expiry',async()=>{
  const author=await fixture({active:true}),reader=await fixture({active:true});
  const body={...roomBody,operationId:randomUUID()};
  await result(await post(author,body),200);await result(await post(author,body),200);
  const channel=await result(await get(reader,'?view=channel&kind=room&id=lounge'),200);
  assert.equal(channel.messages.filter(message=>message.id===body.operationId).length,1);
  assert.equal(channel.messages[0].body,body.body);
  for(const key of ['line_id','portfolio_hash','sender_id','session'])assert.ok(!JSON.stringify(channel).includes(key));
  await result(await post(reader,{action:'read',kind:'room',channelId:'lounge',lastSeq:channel.messages[0].seq}),200);
  assert.equal((await result(await get(reader),200)).rooms.find(room=>room.id==='lounge').unread,0);
  await storage.run('UPDATE members SET trial_ends_at=? WHERE id=?',new Date(Date.now()-1000).toISOString(),author.member.id);
  assert.equal((await result(await post(author,roomBody),403)).error,'MEMBERSHIP_REQUIRED');
  assert.equal((await result(await get(author,'?view=channel&kind=room&id=lounge'),403)).error,'MEMBERSHIP_REQUIRED');
  const thread=await result(await post(author,{action:'create-thread',team:'marketing',subject:'Fixture account support',body:'Please help'}),200);
  await result(await get(author,`?view=channel&kind=thread&id=${thread.threadId}`),200);
  assert.equal((await result(await get(reader,`?view=channel&kind=thread&id=${thread.threadId}`),404)).error,'CHANNEL_NOT_FOUND');
});

test('HTTP team flow enforces role assignment, transfer, revoked access and closed-thread writes',async()=>{
  const admin=await fixture({admin:true}),owner=await fixture(),marketing=await fixture(),analyst=await fixture();
  await result(await post(admin,{action:'role',memberId:marketing.member.id,role:'marketing',enabled:true}),200);
  await result(await post(admin,{action:'role',memberId:analyst.member.id,role:'analyst',enabled:true}),200);
  const thread=await result(await post(owner,{action:'create-thread',team:'marketing',subject:'Fixture private support',body:'Please help'}),200);
  const path=`?view=channel&kind=thread&id=${thread.threadId}`;
  const detail=await result(await get(marketing,path),200);
  assert.equal((await result(await get(analyst,path),404)).error,'CHANNEL_NOT_FOUND');
  await result(await post(marketing,{action:'transfer',threadId:thread.threadId,version:detail.channel.version,team:'analyst'}),200);
  await result(await get(marketing,path),404);
  const moved=await result(await get(analyst,path),200);
  await result(await post(analyst,{action:'thread-state',threadId:thread.threadId,version:moved.channel.version,status:'closed'}),200);
  assert.equal((await result(await post(owner,{action:'send',kind:'thread',channelId:thread.threadId,body:'Closed fixture'}),409)).error,'THREAD_CLOSED');
  await result(await post(admin,{action:'role',memberId:analyst.member.id,role:'analyst',enabled:false}),200);
  await result(await get(analyst,path),404);await result(await get(analyst,'?team=1'),403);
  await result(await get(marketing,'?view=admin'),403);
});

test('client → HTTP handler → SQLite survives lost confirmation followed by a real rate limit without duplicate data',async()=>{
  const actor=await fixture({active:true});
  let attempt=0,confirmed=0,now=Date.now();
  const requests=[];
  const writer=createCommunityWriter({now:()=>now,onConfirmed:()=>confirmed++,fetcher:async(_url,options)=>{
    requests.push(JSON.parse(options.body));
    const response=await handlers.POST(request(actor,'',options.body));
    if(++attempt===1){assert.equal(response.status,200);throw Error('Committed response lost');}
    return response;
  }});
  await writer.write({...roomBody,channelId:'dr'});
  for(let count=0;count<15;count++)await rateLimit('community-write',actor.member.id,15);
  await writer.retry();
  assert.equal(writer.snapshot().error,'RATE_LIMITED');assert.equal(writer.snapshot().uncertain,true);
  assert.equal((await writer.write({...roomBody,channelId:'dr'})).status,'ignored');
  now=writer.snapshot().retryAt;
  // Only this test database is reset to simulate the rate-limit window expiring.
  await storage.run('DELETE FROM request_limits');
  await writer.retry();
  assert.equal(confirmed,1);assert.equal(new Set(requests.map(body=>body.operationId)).size,1);
  const channel=await result(await get(actor,'?view=channel&kind=room&id=dr'),200);
  assert.equal(channel.total,1);assert.equal(channel.messages[0].id,requests[0].operationId);
  assert.equal((await storage.first('SELECT COUNT(*) AS n FROM community_operations WHERE id=?',requests[0].operationId)).n,1);
});

test.after(()=>{sharedDatabase().close();rmSync(temporary,{recursive:true,force:true});});
