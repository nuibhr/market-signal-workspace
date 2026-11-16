import test from 'node:test';import assert from 'node:assert/strict';import {createTelegramHandlers} from './handlers.mjs';
const request=(body,origin='https://app.invalid',type='application/json')=>new Request('https://app.invalid/api/alerts/telegram',{method:'POST',headers:{Origin:origin,'Content-Type':type},body:typeof body==='string'?body:JSON.stringify(body)});
function setup(member={id:'admin'},admin=true,extra={}){
 const calls=[];const invites=[];const kicks=[];const unbans=[];
 const handler=createTelegramHandlers({
   currentMember:async()=>member,
   isAdmin:m=>Boolean(m)&&admin,
   sameOrigin:r=>r.headers.get('Origin')==='https://app.invalid',
   rateLimit:async()=>null,
   env:{APP_ORIGIN:'https://app.invalid',TELEGRAM_BOT_TOKEN:'fixture-token',TELEGRAM_CHAT_ID:'fixture-channel'},
   send:async data=>{calls.push(data);return {messageId:7}},
   verify:async()=>({valid:true}),
   createInvite:async data=>{invites.push(data);return {inviteLink:'https://t.me/+mockInvite123',name:data.name,memberLimit:data.memberLimit}},
   kickMember:async data=>{kicks.push(data);return {kicked:true,userId:data.userId}},
   unbanMember:async data=>{unbans.push(data);return {unbanned:true,userId:data.userId}},
   ...extra
 });
 return {handler,calls,invites,kicks,unbans};
}
test('public, cross-origin and non-admin requests never send using the server bot',async()=>{
 for(const [member,admin,origin]of [[null,false,'https://app.invalid'],[{id:'member'},false,'https://app.invalid'],[{id:'admin'},true,'https://other.invalid']]){
  const{handler,calls}=setup(member,admin);assert.ok((await handler.POST(request({action:'test'},origin))).status>=400);assert.equal(calls.length,0);
 }
});
test('malformed JSON, unsupported content type, oversized messages and destination overrides never dispatch',async()=>{
 const{handler,calls}=setup();
 for(const r of [request('{bad'),request({action:'test'},'https://app.invalid','text/plain'),request({action:'custom',text:'x'.repeat(13000)}),request({action:'test',chatId:'other'}),request({action:'unknown'})])assert.ok((await handler.POST(r)).status>=400);
 assert.equal(calls.length,0);
});
test('authorized connection test sends only the requested test through the configured channel',async()=>{
 const{handler,calls}=setup();const r=await handler.POST(request({action:'test'}));assert.equal(r.status,200);assert.equal(calls[0].chatId,'fixture-channel');assert.ok(calls[0].text.includes('ทดสอบ'));assert.equal(calls[0].text.includes('2720'),false);
});

test('create-invite action generates 1-time invite link for admin or active subscriber', async () => {
  const { handler, invites } = setup({ id: 'admin', display_name: 'Admin Boss' }, true);
  const res = await handler.POST(request({ action: 'create-invite' }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.inviteLink, 'https://t.me/+mockInvite123');
  assert.equal(invites.length, 1);
  assert.equal(invites[0].memberLimit, 1);
  assert.ok(invites[0].name.includes('VIP · Admin Boss'));
});

test('create-invite rejects expired members with MEMBERSHIP_REQUIRED 403', async () => {
  const expiredMember = { id: 'user-expired', trial_ends_at: '2020-01-01T00:00:00Z' };
  const { handler, invites } = setup(expiredMember, false);
  const res = await handler.POST(request({ action: 'create-invite' }));
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'MEMBERSHIP_REQUIRED');
  assert.equal(invites.length, 0);
});

test('kick-member allows admin to kick user without permanent ban', async () => {
  const { handler, kicks } = setup({ id: 'admin' }, true);
  const res = await handler.POST(request({ action: 'kick-member', userId: '55667788' }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.kicked, true);
  assert.equal(data.userId, '55667788');
  assert.equal(kicks.length, 1);
  assert.equal(kicks[0].userId, '55667788');
});

test('kick-member rejects non-admin with FORBIDDEN 403 and invalid user ID with 400', async () => {
  const { handler: nonAdminHandler, kicks } = setup({ id: 'regular-user' }, false);
  const res1 = await nonAdminHandler.POST(request({ action: 'kick-member', userId: '55667788' }));
  assert.equal(res1.status, 403);
  assert.equal(kicks.length, 0);

  const { handler: adminHandler } = setup({ id: 'admin' }, true);
  const res2 = await adminHandler.POST(request({ action: 'kick-member', userId: 'invalid<script>' }));
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.equal(data2.error, 'INVALID_TELEGRAM_USER_ID');
});

test('auto-kick-expired batch kicks list of expired user IDs', async () => {
  const { handler, kicks } = setup({ id: 'admin' }, true);
  const res = await handler.POST(request({ action: 'auto-kick-expired', userIds: ['1001', '1002', '1003'] }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.kickedCount, 3);
  assert.deepEqual(data.kicked, ['1001', '1002', '1003']);
  assert.equal(kicks.length, 3);
});

test('create-invite join-request mode issues tracking invite and fromDb auto-kick scans DB', async () => {
  let issued = null;
  let autoKicked = false;
  let webhookSet = null;
  const { handler } = setup({ id: 'admin', display_name: 'Admin' }, true, {
    issueJoinInvite: async (args) => {
      issued = args;
      return { inviteLink: 'https://t.me/+joinReqTrack', name: args.name, requiresApproval: true };
    },
    runAutoKickExpired: async () => {
      autoKicked = true;
      return { ok: true, checkedCount: 2, expiredCount: 1, kickedCount: 1, kicked: ['202'], failed: [] };
    },
    setWebhook: async (args) => {
      webhookSet = args;
      return { success: true };
    },
  });

  const resInvite = await handler.POST(request({ action: 'create-invite', mode: 'join-request' }));
  assert.equal(resInvite.status, 200);
  const inviteData = await resInvite.json();
  assert.equal(inviteData.requiresApproval, true);
  assert.equal(inviteData.inviteLink, 'https://t.me/+joinReqTrack');
  assert.equal(issued.member.id, 'admin');

  const resKick = await handler.POST(request({ action: 'auto-kick-expired', fromDb: true }));
  assert.equal(resKick.status, 200);
  assert.equal(autoKicked, true);
  assert.equal((await resKick.json()).kickedCount, 1);

  const resHook = await handler.POST(request({ action: 'register-webhook' }));
  assert.equal(resHook.status, 200);
  assert.equal(webhookSet.url, 'https://app.invalid/api/alerts/telegram/webhook');
});

test('market-playbook dispatches categorized playbook with category badge, hashtags and topic thread support', async () => {
  const { handler, calls } = setup({ id: 'admin' }, true);
  const res = await handler.POST(request({
    action: 'market-playbook',
    category: 'dr',
    round: 'morning_0930',
    topicThreadId: 88,
    picks: [
      { symbol: 'NVDA80', name: 'NVIDIA DR', entry: 23.8, target: 26.2, stop: 22.9, note: 'Premium +0.4%' },
    ],
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.category, 'dr');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messageThreadId, 88);
  assert.ok(calls[0].text.includes('[🌐 โพย DR80 หุ้นโลก]'));
  assert.ok(calls[0].text.includes('09:30 น.'));
  assert.ok(calls[0].text.includes('#DR80'));
});

test('create-invite rejects Trial & BASIC (starter) with 403 and allows PRO VIP; admin runs broker inactivity kick', async () => {
  const prevStarter = process.env.STRIPE_PRICE_STARTER_MONTHLY;
  const prevPro = process.env.STRIPE_PRICE_PRO_MONTHLY;
  process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro';
  try {
  const future = '2099-01-01T00:00:00Z';
  const trialSetup = setup({ id: 'trial-user', trial_ends_at: future }, false);
  assert.equal((await trialSetup.handler.POST(request({ action: 'create-invite' }))).status, 403);
  assert.equal(trialSetup.invites.length, 0);

  const starterSetup = setup({ id: 'starter-user', billing: { plan_id: 'starter', status: 'active', paid_until: future } }, false);
  assert.equal((await starterSetup.handler.POST(request({ action: 'create-invite' }))).status, 403);
  assert.equal(starterSetup.invites.length, 0);

  const proSetup = setup({ id: 'pro-user', display_name: 'Pro Member', billing: { plan_id: 'pro', status: 'active', paid_until: future } }, false, {
    issueJoinInvite: async ({ member }) => ({ inviteLink: `https://t.me/+${member.id}`, name: member.display_name, requiresApproval: true }),
  });
  const proRes = await proSetup.handler.POST(request({ action: 'create-invite', mode: 'join-request' }));
  assert.equal(proRes.status, 200);
  assert.equal((await proRes.json()).inviteLink, 'https://t.me/+pro-user');

  let receivedDryRun = null;
  const adminSetup = setup({ id: 'admin' }, true, {
    runAutoKickInactiveBroker: async ({ inactivityDays, dryRun }) => {
      receivedDryRun = { inactivityDays, dryRun };
      return { ok: true, dryRun, matchedCount: 2, revokedCount: dryRun ? 0 : 2, kickedCount: dryRun ? 0 : 2 };
    },
  });
  const kickRes = await adminSetup.handler.POST(request({ action: 'auto-kick-inactive-broker', inactivityDays: 14, dryRun: true }));
  assert.equal(kickRes.status, 200);
  assert.deepEqual(receivedDryRun, { inactivityDays: 14, dryRun: true });
  assert.equal((await kickRes.json()).matchedCount, 2);
  } finally {
    if (prevStarter === undefined) delete process.env.STRIPE_PRICE_STARTER_MONTHLY; else process.env.STRIPE_PRICE_STARTER_MONTHLY = prevStarter;
    if (prevPro === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY; else process.env.STRIPE_PRICE_PRO_MONTHLY = prevPro;
  }
});
