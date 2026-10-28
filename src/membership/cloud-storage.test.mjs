import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

test('native D1 preserves LINE profile, 14-day trial, monthly renewal, credits and signal outcomes',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'nugaom-membership-d1-'));
  const configPath=join(directory,'wrangler.json');
  writeFileSync(configPath,JSON.stringify({name:'nugaom-membership-fixture',compatibility_date:'2026-10-07',
    d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  assert.equal(result.status,0,'Fixture D1 schema applies');
  process.env.SESSION_SECRET='fixture-session-'.repeat(5);
  process.env.PORTFOLIO_HASH_SECRET='fixture-portfolio-'.repeat(5);
  process.env.ADMIN_LINE_IDS='U'+'a'.repeat(32);
  const {getPlatformProxy}=await import('wrangler');
  const proxy=await getPlatformProxy({configPath,persist:{path:join(directory,'.wrangler/state/v3')}});
  const {withD1Database,storage}=await import('../storage/database.mjs');
  const member=await import('./store.mjs');
  const {membershipFor}=await import('./rights.mjs');
  try{await withD1Database(proxy.env.DB,async()=>{
    const admin=await member.upsertLineMember({lineId:process.env.ADMIN_LINE_IDS,displayName:'Fixture admin'});
    process.env.TRIAL_ENROLLMENT_ENABLED='true';
    const lineOnly=await member.upsertLineMember({lineId:'U'+'d'.repeat(32),displayName:'LINE-only trial fixture'});
    const attempts=await Promise.allSettled([member.startTrial(lineOnly),member.startTrial(lineOnly)]);
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
    const lineTrial=await storage.first('SELECT * FROM members WHERE id=?',lineOnly.id);
    assert.equal(membershipFor(lineTrial).tier,'trial');assert.equal(lineTrial.portfolio_hash,null);
    assert.equal(Date.parse(lineTrial.trial_ends_at)-Date.parse(lineTrial.trial_started_at),14*86400000);
    assert.equal((await storage.first("SELECT COUNT(*) AS n FROM membership_events WHERE member_id=? AND event_type='trial_started'",lineOnly.id)).n,1);
    let customer=await member.upsertLineMember({lineId:'U'+'b'.repeat(32),displayName:'Fixture customer',pictureUrl:'https://example.com/avatar.png'});
    assert.equal(membershipFor(customer).tier,'onboarding');
    customer=await member.submitPortfolio(customer,'FIXTURE','12345678');
    assert.equal(Date.parse(customer.trial_ends_at)-Date.parse(customer.trial_started_at),14*86400000);
    const trialEnd=customer.trial_ends_at;
    customer=await member.submitPortfolio(customer,'FIXTURE','12345678');
    assert.equal(customer.trial_ends_at,trialEnd,'Repeated submission never resets the trial');
    const summary=await member.accountSummary(customer);
    assert.equal(summary.displayName,'Fixture customer');assert.equal(summary.pictureUrl,'https://example.com/avatar.png');
    assert.equal(summary.portfolioLast4,'5678');assert.equal(summary.portfolio_hash,undefined);
    await assert.rejects(member.issueCode(customer,customer.id,'fixture-request-0001'),{message:'FORBIDDEN'});
    await assert.rejects(member.issueCode(admin,customer.id,'fixture-request-0001'),{message:'PORTFOLIO_NOT_VERIFIED'});
    await member.verifyPortfolio(admin,customer.id,'12345678');
    customer=await storage.first('SELECT * FROM members WHERE id=?',customer.id);
    const code=await member.issueCode(admin,customer.id,'fixture-request-0001');
    assert.equal(await member.issueCode(admin,customer.id,'fixture-request-0001'),code,'Admin retry returns the same code');
    const endsAt=await member.redeemCode(customer,code);
    await assert.rejects(member.redeemCode(customer,code),{message:'CODE_UNAVAILABLE'});
    customer=await storage.first('SELECT * FROM members WHERE id=?',customer.id);
    assert.equal(membershipFor(customer).tier,'subscriber');
    const request=await member.requestRenewal(customer);
    assert.equal(await member.requestRenewal(customer),request);
    const extended=await member.approveRenewal(admin,request,'fixture payment reference');
    assert.ok(Date.parse(extended)>Date.parse(endsAt));
    await assert.rejects(member.approveRenewal(admin,request),{message:'REQUEST_UNAVAILABLE'});
    const session=await member.createSession(customer.id);
    assert.equal((await member.sessionMember(session.value)).id,customer.id);
    assert.equal(await member.sessionMember('forged'),null);
    await member.deleteSession(session.value);assert.equal(await member.sessionMember(session.value),null);
    const conversation=randomUUID();
    for(let i=0;i<5;i++){
      const id=randomUUID(),r=await member.reserveAiQuestion(customer,id,'Fixture question',conversation);
      assert.equal(r.chargeType,'free');await member.completeAiQuestion(customer,id,{answer:'fixture'},null,r.reservationToken);
    }
    await assert.rejects(member.reserveAiQuestion(customer,randomUUID(),'Fixture question',conversation),{message:'INSUFFICIENT_AI_CREDITS'});
    await member.grantAiCredits(admin,customer.id,2,'fixture-credit-grant-0001');
    await member.grantAiCredits(admin,customer.id,2,'fixture-credit-grant-0001');
    const paidId=randomUUID(),paid=await member.reserveAiQuestion(customer,paidId,'Fixture question',conversation);
    assert.equal(paid.chargeType,'credit');assert.equal((await member.aiQuota(customer)).credits,1);
    await member.releaseAiQuestion(customer,paidId,paid.reservationToken);
    assert.equal((await member.aiQuota(customer)).credits,2,'Interrupted answer refunds its credit');
    await storage.run('UPDATE members SET trial_ends_at=?,subscription_ends_at=NULL WHERE id=?',new Date(Date.now()-1).toISOString(),customer.id);
    assert.equal(membershipFor(await storage.first('SELECT * FROM members WHERE id=?',customer.id)).tier,'expired');
    const ledger=await import('../auto-pick/store.mjs');
    const {announcementFor}=await import('../auto-pick/announcements.mjs');
    const plan={id:'fixture-plan',side:'LONG',entry:100,stopLoss:98,tp1:104};
    const signal=await ledger.createSignal({market:'thai',symbol:'PTT',sessionDay:'2026-10-09',plan,source:'FIXTURE'});
    assert.equal(signal.status,'WAITING_FOR_ENTRY');
    const open={...signal,status:'OPEN',entryPrice:100.2,enteredAt:new Date().toISOString()};
    await ledger.saveAdvance(open,[{type:'ENTRY',barTime:1791516600,price:100.2}]);
    await ledger.saveAdvance(open,[{type:'ENTRY',barTime:1791516600,price:100.2}]);
    const entered=await ledger.signalForSession('thai','PTT','2026-10-09');
    const closed={...entered,status:'TARGET',exitPrice:104,exitedAt:new Date().toISOString()};
    await ledger.saveAdvance(closed,[{type:'TARGET',barTime:1791517500,price:104}]);
    const recorded=await ledger.signalForSession('thai','PTT','2026-10-09');
    assert.equal(recorded.entryPrice,100.2);assert.equal(recorded.exitPrice,104);
    assert.equal((await storage.first("SELECT COUNT(*) AS n FROM auto_pick_events WHERE event_type='ENTRY'")).n,1);
    assert.equal((await ledger.signalResults({market:'thai'})).total,1);
    assert.match(announcementFor({type:'ENTRY',market:'thai',symbol:'PTT',price:recorded.entryPrice,tp1:104,stopLoss:98}).text,/100.2/);
    const {signalEventPage}=await import('../auto-pick/event-pages.mjs');
    let cursor=(await signalEventPage()).nextCursor;
    for(let index=0;index<120;index++)await ledger.createSignal({market:'thai',symbol:`D1EVENT${index}`,sessionDay:'2026-10-09',
      plan:{...plan,features:{privateFormula:true}},source:'D1 FIXTURE ONLY'});
    const received=[];let page;
    do{page=await signalEventPage({after:cursor});received.push(...page.events);cursor=page.nextCursor;}while(page.hasMore);
    assert.equal(received.length,120);assert.equal(new Set(received.map(item=>item.id)).size,120);
    assert.ok(received.every(item=>!('planJson' in item)&&!('features' in item)));
    assert.equal((await signalEventPage({after:cursor})).events.length,0);
    {
    // A Stripe-paid D1 account uses the same entitlement and atomic quota guard as Node.
    process.env.STRIPE_SECRET_KEY='sk_test_d1_fixture';
    process.env.STRIPE_PRICE_STARTER_MONTHLY='price_starter';process.env.STRIPE_PRICE_PRO_MONTHLY='price_pro';process.env.STRIPE_PRICE_ULTIMATE_MONTHLY='price_ultimate';
    const billing=await import('../billing/store.mjs');
    const paid=await member.upsertLineMember({lineId:'U'+'c'.repeat(32),displayName:'D1 billing fixture'});
    await storage.run('INSERT INTO billing_customers VALUES(?,?,?)',paid.id,'test','cus_d1_fixture');
    const end=Math.floor(Date.now()/1000)+86400;
    const price={id:'price_starter',active:true,livemode:false,currency:'thb',unit_amount:9900,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
    await billing.applyStripeEvent({id:'evt_d1_paid',type:'invoice.paid',created:1,livemode:false,data:{object:{subscription:'sub_d1_fixture'}}},{stripe:{subscriptions:{retrieve:async()=>({id:'sub_d1_fixture',customer:'cus_d1_fixture',status:'active',livemode:false,items:{data:[{price,quantity:1,current_period_end:end}]},latest_invoice:{status:'paid',lines:{data:[{price,period:{end}}]}}})}}});
    assert.equal(membershipFor(await billing.withBilling(paid)).planId,'starter');
    const {adminMemberships}=await import('../admin/operations.mjs');
    assert.ok((await adminMemberships(admin,{filter:'subscriber'})).members.some(row=>row.id===paid.id&&row.planName==='Starter'));
    const beforeScan=(await member.aiQuota(paid)).freeRemaining;
    await signalEventPage({after:cursor});assert.equal((await member.aiQuota(paid)).freeRemaining,beforeScan,'Reading signal notifications does not consume AI questions');
    const day=(await member.aiQuota(paid)).day;
    for(let i=0;i<10;i++)await storage.run("INSERT INTO ai_questions(id,member_id,day_key,charge_type,status,created_at) VALUES(?,?,?,'free','completed',?)",randomUUID(),paid.id,day,new Date().toISOString());
    await assert.rejects(member.reserveAiQuestion(paid,randomUUID(),'Quota reached',randomUUID()),/AI_QUOTA_EXHAUSTED/);
    assert.equal((await member.aiQuota(paid)).freeRemaining,0);
    }

  });}finally{await proxy.dispose();rmSync(directory,{recursive:true,force:true});}
});
