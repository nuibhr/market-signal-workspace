import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
const dir=mkdtempSync(join(tmpdir(),'nugaom-billing-'));
process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
process.env.STRIPE_SECRET_KEY='sk_test_fixture_only';
process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture_only';
process.env.STRIPE_PRICE_STARTER_MONTHLY='price_starter';process.env.STRIPE_PRICE_PRO_MONTHLY='price_pro';process.env.STRIPE_PRICE_ULTIMATE_MONTHLY='price_ultimate';
process.env.APP_ORIGIN='http://localhost:3000';process.env.SESSION_SECRET='fixture-session-secret-at-least-32-characters';
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {membershipFor}=await import('../membership/rights.mjs');
const memberStore=await import('../membership/store.mjs');
const {configuredPlans,validMonthlyPrice}=await import('./plans.mjs');
const {withBilling,applyStripeEvent,checkout,portal,listPlans}=await import('./store.mjs');
const {webhookHandler}=await import('./webhook.mjs');
const signer=new Stripe('sk_test_fixture_only');
const end=Math.floor(Date.now()/1000)+86400*20;
const price=id=>({id:`price_${id}`,active:true,livemode:false,currency:'thb',unit_amount:{starter:9900,pro:29900,ultimate:59900}[id],type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}});
async function fixture(plan='starter'){
 const id=randomUUID(),customer=`cus_${id}`;
 const m=await memberStore.upsertLineMember({lineId:`fixture-${id}`,displayName:'Billing test only'});
 await storage.run('INSERT INTO billing_customers VALUES(?,?,?)',m.id,'test',customer);
 const sub={id:`sub_${id}`,customer,livemode:false,status:'active',cancel_at_period_end:false,items:{data:[{price:price(plan),quantity:1,current_period_end:end}]},latest_invoice:{status:'paid',lines:{data:[{price:price(plan),period:{end}}]}}};
 const stripe={webhooks:signer.webhooks,subscriptions:{retrieve:async()=>sub,list:async()=>({data:[],has_more:false})},prices:{retrieve:async id=>price(id.replace('price_',''))},checkout:{sessions:{create:async()=>({id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fixture'})}},billingPortal:{sessions:{create:async()=>({url:'https://billing.stripe.com/p/session/fixture'})}}};
 const event=(type='invoice.paid',created=Math.floor(Date.now()/1000),eventId=`evt_${randomUUID()}`)=>({id:eventId,created,type,livemode:false,data:{object:type.startsWith('customer.subscription')?sub:{subscription:sub.id}}});
 return {m,sub,stripe,event};
}
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('monthly prices require exact approved THB amounts, mode and interval',async()=>{
 assert.deepEqual(configuredPlans().map(x=>x.aiDailyLimit),[10,50,150]);
 const p=configuredPlans()[0];assert.ok(validMonthlyPrice(price('starter'),p,'test'));
 for(const change of [{unit_amount:19900},{currency:'usd'},{livemode:true},{recurring:{interval:'year',interval_count:1}},{active:false}])assert.equal(validMonthlyPrice({...price('starter'),...change},p,'test'),false);
 assert.throws(()=>configuredPlans({...process.env,STRIPE_PRICE_PRO_MONTHLY:'price_starter'}),/INVALID_BILLING_CONFIG/);
 const f=await fixture();assert.deepEqual((await listPlans({stripe:f.stripe})).map(p=>p.amount),[9900,29900,59900]);
});
test('paid webhook preserves member identity and enables the matching scanner/AI package',async()=>{
 const f=await fixture('pro');await applyStripeEvent(f.event(),{stripe:f.stripe});
 const rights=membershipFor(await withBilling(f.m));
 assert.equal(rights.planName,'Pro');assert.equal(rights.capabilities.manualDailyScan,true);assert.equal(rights.capabilities.autoPickFeed,true);assert.equal(rights.limits.freeAiQuestionsDaily,50);
 const session=await memberStore.createSession(f.m.id);assert.equal((await memberStore.sessionMember(session.value)).id,f.m.id);assert.equal(membershipFor(await memberStore.sessionMember(session.value)).planId,'pro');
 assert.equal(membershipFor(f.m).capabilities.aiQuestions,false,'Unpaid fresh member has no paid capability');
 assert.equal((await storage.first('SELECT subscription_ends_at FROM members WHERE id=?',f.m.id)).subscription_ends_at,null,'Legacy dates are not overwritten');
});
test('duplicates and old events cannot restore canceled access; cancel-at-period-end keeps paid time',async()=>{
 const f=await fixture(),e=f.event();await applyStripeEvent(e,{stripe:f.stripe});assert.equal((await applyStripeEvent(e,{stripe:f.stripe})).duplicate,true);
 f.sub.cancel_at_period_end=true;await applyStripeEvent(f.event('customer.subscription.updated',e.created+1),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).tier,'subscriber');
 f.sub.status='canceled';await applyStripeEvent(f.event('customer.subscription.deleted',e.created+2),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).capabilities.autoPickFeed,false);
 f.sub.status='active';await applyStripeEvent(f.event('customer.subscription.updated',e.created-10),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).capabilities.autoPickFeed,false);
});
test('unpaid invoices and unrelated customer metadata do not grant or upgrade membership',async()=>{
 const f=await fixture();f.sub.latest_invoice.status='open';await applyStripeEvent(f.event(),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).tier,'onboarding');
 f.sub.latest_invoice.status='paid';await applyStripeEvent(f.event('invoice.paid',10000000000),{stripe:f.stripe});
 f.sub.items.data[0].price=price('ultimate'); // An old Starter invoice does not pay for an Ultimate upgrade.
 await applyStripeEvent(f.event('customer.subscription.updated',10000000001),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).planId,'starter');
 f.sub.latest_invoice.lines.data[0].price=price('ultimate');await applyStripeEvent(f.event('invoice.paid',10000000002),{stripe:f.stripe});assert.equal(membershipFor(await withBilling(f.m)).planId,'ultimate');
 f.sub.customer='cus_unknown';f.sub.metadata={member_id:f.m.id};assert.equal((await applyStripeEvent(f.event(),{stripe:f.stripe})).ignored,true);
});
for(const [plan,limit] of [['starter',10],['pro',50],['ultimate',150]])test(`${plan}: atomic ${limit}-question daily cap, failure refund, reset time and no extra credit charge`,async()=>{
 const f=await fixture(plan);await applyStripeEvent(f.event(),{stripe:f.stripe});
 const day=(await memberStore.aiQuota(f.m)).day,conversation=randomUUID();
 await storage.run('INSERT INTO ai_credit_accounts VALUES(?,20)',f.m.id);
 for(let i=0;i<limit-1;i++)await storage.run("INSERT INTO ai_questions(id,member_id,day_key,charge_type,status,created_at) VALUES(?,?,?,'free','completed',?)",randomUUID(),f.m.id,day,new Date().toISOString());
 let quota=await memberStore.aiQuota(f.m);assert.equal(quota.freeRemaining,1);assert.equal(quota.freeLimit,limit);assert.equal(new Date(quota.resetAt).getTime(),Date.parse(`${day}T00:00:00+07:00`)+86400000);assert.equal(quota.allowExtraCredits,false);
 let request=randomUUID(),reservation=await memberStore.reserveAiQuestion(f.m,request,'Fixture question',conversation);
 assert.equal((await memberStore.aiQuota(f.m)).freeRemaining,0);
 await memberStore.releaseAiQuestion(f.m,request,reservation.reservationToken);assert.equal((await memberStore.aiQuota(f.m)).freeRemaining,1);
 const attempts=await Promise.allSettled([0,1].map(()=>{const id=randomUUID();return memberStore.reserveAiQuestion(f.m,id,'Concurrent test',conversation).then(r=>({id,...r}));}));
 const accepted=attempts.filter(r=>r.status==='fulfilled');assert.equal(accepted.length,1);request=accepted[0].value;
 await memberStore.completeAiQuestion(f.m,request.id,{answer:'fixture'},null,request.reservationToken);
 await assert.rejects(memberStore.reserveAiQuestion(f.m,randomUUID(),'Over daily quota',conversation),/AI_QUOTA_EXHAUSTED/);
 quota=await memberStore.aiQuota(f.m);assert.equal(quota.freeRemaining,0);assert.equal(quota.credits,20);assert.equal(quota.freeUsed,limit);
 const before=quota.freeUsed;await portal(f.m,{stripe:f.stripe});assert.equal((await memberStore.aiQuota(f.m)).freeUsed,before,'Billing activity does not consume AI quota');
});
test('checkout reuses the open session, rejects active subscriptions and cannot choose an arbitrary price',async()=>{
 const f=await fixture();let creates=0;f.stripe.checkout.sessions.create=async body=>{creates++;assert.equal(body.mode,'subscription');assert.equal(body.line_items[0].price,'price_starter');assert.equal(body.customer,f.sub.customer);return {id:'cs_test',url:'https://checkout.stripe.com/c/pay/fixture'};};
 const one=await checkout(f.m,'starter',{stripe:f.stripe});assert.equal(one.url,'https://checkout.stripe.com/c/pay/fixture');assert.deepEqual(await checkout(f.m,'starter',{stripe:f.stripe}),one);assert.equal(creates,1);
 await assert.rejects(checkout(f.m,'pro',{stripe:f.stripe}),/CHECKOUT_ALREADY_OPEN/);await assert.rejects(checkout(f.m,'price_attacker',{stripe:f.stripe}),/INVALID_PLAN/);
 f.stripe.subscriptions.list=async()=>({data:[{status:'past_due'}]});await assert.rejects(checkout(f.m,'starter',{stripe:f.stripe}),/SUBSCRIPTION_EXISTS/);
});
test('webhook verifies the exact raw body and signature, rejects tampering and wrong modes',async()=>{
 const f=await fixture(),event=f.event(),body=JSON.stringify(event),secret=process.env.STRIPE_WEBHOOK_SECRET;
 const signature=signer.webhooks.generateTestHeaderString({payload:body,secret});
 const request=(raw,header=signature)=>new Request('http://localhost/api/billing/webhook',{method:'POST',headers:{'stripe-signature':header},body:raw});
 assert.equal((await webhookHandler(request(body),{stripe:f.stripe,secret})).status,200);
 assert.equal((await webhookHandler(request(body+' '),{stripe:f.stripe,secret})).status,400);
 assert.equal((await webhookHandler(request(body,'bad'),{stripe:f.stripe,secret})).status,400);
 assert.equal((await webhookHandler(request('x'.repeat(262145)),{stripe:f.stripe,secret})).status,413);
 await assert.rejects(applyStripeEvent({...f.event(),livemode:true},{stripe:f.stripe}),/INVALID_STRIPE_EVENT/);
});

test('admin directory, subscriber filter and detail agree with the Stripe entitlement',async()=>{
 const f=await fixture('pro');await applyStripeEvent(f.event(),{stripe:f.stripe});
 process.env.ADMIN_LINE_IDS='fixture-admin-line';
 const admin=await memberStore.upsertLineMember({lineId:'fixture-admin-line',displayName:'Fixture admin'});
 const {adminMemberships,adminMemberDetail}=await import('../admin/operations.mjs');
 const directory=await adminMemberships(admin,{filter:'subscriber',q:'Billing test only'});
 assert.ok(directory.members.some(m=>m.id===f.m.id&&m.planName==='Pro'));assert.ok(directory.summary.subscribers>0);
 const detail=await adminMemberDetail(admin,f.m.id);assert.equal(detail.member.planId,'pro');assert.equal(detail.quota.freeLimit,50);
});

test('Stripe community entitlement follows the same current package and expiry',async()=>{
 const f=await fixture('starter');await applyStripeEvent(f.event(),{stripe:f.stripe});
 const {communityAccess,mutateCommunity}=await import('../community/store.mjs');
 assert.equal((await communityAccess(f.m)).rooms,true);
 await mutateCommunity(f.m,{action:'send',operationId:randomUUID(),kind:'room',channelId:'lounge',body:'Stripe fixture message'});
 await storage.run('UPDATE billing_subscriptions SET paid_until=? WHERE member_id=?',new Date(Date.now()-1000).toISOString(),f.m.id);
 assert.equal((await communityAccess(f.m)).rooms,false);
 await assert.rejects(mutateCommunity(f.m,{action:'send',operationId:randomUUID(),kind:'room',channelId:'lounge',body:'Expired fixture message'}),/MEMBERSHIP_REQUIRED/);
});
