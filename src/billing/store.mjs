import {randomUUID,createHash} from 'node:crypto';
import {storage,operation as op} from '../storage/database.mjs';
import {configuredPlans,stripeMode,validMonthlyPrice} from './plans.mjs';
import {stripeClient,billingOrigin,stripeRedirect} from './client.mjs';
import {demoEnabled,isDemoIdentity} from '../membership/demo-policy.mjs';
const idOf=v=>typeof v==='string'?v:v?.id;
export async function withBilling(member){
  if(!member)return null;
  if(isDemoIdentity(member)){
    const access=demoEnabled()?await storage.first('SELECT role,expires_at FROM demo_access WHERE member_id=? AND expires_at>?',member.id,new Date().toISOString()):null;
    return {...member,billing:null,demo:access?{role:access.role,expiresAt:access.expires_at}:null};
  }
  let mode;try{mode=stripeMode();}catch{return {...member,billing:null};}
  const rows=await storage.all('SELECT * FROM billing_subscriptions WHERE member_id=? AND mode=? ORDER BY paid_until DESC',member.id,mode);
  const now=Date.now();
  const billing=rows.find(r=>['active','past_due'].includes(r.status)&&Date.parse(r.paid_until)>now)??rows[0]??null;
  return {...member,billing};
}
export async function billingSummary(member){
  let mode;try{mode=stripeMode();}catch{return {configured:false,mode:null,subscription:null,hasCustomer:false};}
  const b=member?.billing;
  let configured=false;try{configured=Boolean(configuredPlans().length===3&&process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')&&process.env.APP_ORIGIN);}catch{}
  return {configured,mode,
    hasCustomer:Boolean(member&&await storage.first('SELECT customer_id FROM billing_customers WHERE member_id=? AND mode=?',member.id,mode)),
    subscription:b?{planId:b.plan_id,status:b.status,paidUntil:b.paid_until,cancelAtPeriodEnd:Boolean(b.cancel_at_period_end)}:null};
}
export async function listPlans({stripe=stripeClient()}={}){
  const mode=stripeMode(),plans=configuredPlans();
  if(plans.length!==3||!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))throw Error('STRIPE_NOT_CONFIGURED');
  billingOrigin();
  return Promise.all(plans.map(async plan=>{
    const price=await stripe.prices.retrieve(plan.priceId);
    if(!validMonthlyPrice(price,plan,mode))throw Error('INVALID_STRIPE_PRICE');
    return {id:plan.id,name:plan.name,amount:price.unit_amount,currency:'thb',interval:'month',aiDailyLimit:plan.aiDailyLimit,dailyScanSymbols:plan.dailyScanSymbols,features:plan.features,ready:true};
  }));
}
async function ensureCustomer(member,stripe,mode){
  let row=await storage.first('SELECT customer_id FROM billing_customers WHERE member_id=? AND mode=?',member.id,mode);
  if(row)return row.customer_id;
  const key=createHash('sha256').update(`${mode}:${member.id}`).digest('hex');
  const customer=await stripe.customers.create({metadata:{member_id:member.id}},{idempotencyKey:`nugaom-customer-${key}`});
  await storage.run('INSERT OR IGNORE INTO billing_customers(member_id,mode,customer_id) VALUES(?,?,?)',member.id,mode,customer.id);
  row=await storage.first('SELECT customer_id FROM billing_customers WHERE member_id=? AND mode=?',member.id,mode);
  return row.customer_id;
}
export async function checkout(member,planId,{stripe=stripeClient(),now=Math.floor(Date.now()/1000)}={}){
  if(!member)throw Error('LOGIN_REQUIRED');
  if(isDemoIdentity(member)&&(!member.demo||stripeMode()!=='test'))throw Error('DEMO_BILLING_TEST_ONLY');
  const plan=configuredPlans().find(p=>p.id===planId);
  if(!plan)throw Error('INVALID_PLAN');
  await listPlans({stripe});
  const mode=stripeMode(),customer=await ensureCustomer(member,stripe,mode);
  const subscriptions=await stripe.subscriptions.list({customer,status:'all',limit:100});
  if(subscriptions.has_more||subscriptions.data.some(s=>!['canceled','incomplete_expired'].includes(s.status)))throw Error('SUBSCRIPTION_EXISTS');
  let attempt=await storage.first(`INSERT INTO billing_checkouts(member_id,mode,plan_id,request_key,expires_at,lease_until) VALUES(?,?,?,?,?,?)
    ON CONFLICT(member_id,mode) DO UPDATE SET plan_id=excluded.plan_id,request_key=excluded.request_key,session_id=NULL,url=NULL,expires_at=excluded.expires_at,lease_until=excluded.lease_until
    WHERE billing_checkouts.expires_at<=? RETURNING *`,member.id,mode,plan.id,randomUUID(),now+1800,now+30,now);
  if(!attempt){
    const previous=await storage.first('SELECT * FROM billing_checkouts WHERE member_id=? AND mode=?',member.id,mode);
    if(previous?.plan_id!==plan.id)throw Error('CHECKOUT_ALREADY_OPEN');
    if(previous?.session_id)return {url:stripeRedirect(previous.url)};
    attempt=await storage.first('UPDATE billing_checkouts SET lease_until=? WHERE member_id=? AND mode=? AND lease_until<=? AND session_id IS NULL RETURNING *',now+30,member.id,mode,now);
    if(!attempt)throw Error('CHECKOUT_PENDING');
  }
  try{
    const origin=billingOrigin();
    // Derive the label from the persisted attempt so idempotent retries keep identical parameters.
    const suffix=Array.from(createHash('sha256').update(attempt.request_key).digest().subarray(0,8),value=>String.fromCharCode(97+value%26)).join('');
    const session=await stripe.checkout.sessions.create({customer,mode:'subscription',line_items:[{price:plan.priceId,quantity:1}],
      integration_identifier:`nugaom-membership-${suffix}`,
      client_reference_id:member.id,subscription_data:{metadata:{member_id:member.id,plan_id:plan.id}},
      success_url:`${origin}/account?billing=success`,cancel_url:`${origin}/account?billing=cancelled`,expires_at:attempt.expires_at},
      {idempotencyKey:`nugaom-checkout-${attempt.request_key}`});
    const url=stripeRedirect(session.url);
    await storage.run('UPDATE billing_checkouts SET session_id=?,url=?,lease_until=0 WHERE member_id=? AND mode=? AND request_key=?',session.id,url,member.id,mode,attempt.request_key);
    return {url};
  }catch(error){await storage.run('UPDATE billing_checkouts SET lease_until=0 WHERE member_id=? AND mode=? AND request_key=?',member.id,mode,attempt.request_key);throw error;}
}
export async function portal(member,{stripe=stripeClient()}={}){
  if(!member)throw Error('LOGIN_REQUIRED');
  if(isDemoIdentity(member)&&(!member.demo||stripeMode()!=='test'))throw Error('DEMO_BILLING_TEST_ONLY');
  const configuration=process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  if(configuration&&!/^bpc_[A-Za-z0-9]+$/.test(configuration))throw Error('INVALID_BILLING_CONFIG');
  const row=await storage.first('SELECT customer_id FROM billing_customers WHERE member_id=? AND mode=?',member.id,stripeMode());
  if(!row)throw Error('BILLING_CUSTOMER_REQUIRED');
  const session=await stripe.billingPortal.sessions.create({customer:row.customer_id,return_url:`${billingOrigin()}/account`,...(configuration?{configuration}:{})});
  return {url:stripeRedirect(session.url)};
}
export async function applyStripeEvent(event,{stripe=stripeClient()}={}){
  const mode=stripeMode();
  if(typeof event.id!=='string'||!/^evt_/.test(event.id)||!Number.isInteger(event.created)||event.livemode!==(mode==='live'))throw Error('INVALID_STRIPE_EVENT');
  if(await storage.first('SELECT event_id FROM billing_events WHERE event_id=?',event.id))return {duplicate:true};
  const object=event.data?.object;
  let id;
  if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed'].includes(event.type))id=object?.id;
  else if(['invoice.paid','invoice.payment_failed'].includes(event.type))id=idOf(object?.parent?.subscription_details?.subscription??object?.subscription);
  else if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&object?.mode==='subscription')id=idOf(object.subscription);
  if(!id)return {ignored:true};
  // Read current Stripe state so delayed events cannot restore an obsolete subscription snapshot.
  const sub=await stripe.subscriptions.retrieve(id,{expand:['latest_invoice']});
  if(sub.livemode!==(mode==='live'))throw Error('INVALID_STRIPE_EVENT');
  const owner=await storage.first('SELECT member_id FROM billing_customers WHERE customer_id=? AND mode=?',idOf(sub.customer),mode);
  if(!owner)return {ignored:true};
  const previous=await storage.first('SELECT * FROM billing_subscriptions WHERE subscription_id=?',sub.id);
  if(previous&&previous.member_id!==owner.member_id)throw Error('INVALID_STRIPE_EVENT');
  const items=sub.items?.data??[],item=items.length===1?items[0]:null;
  const plan=configuredPlans().find(p=>p.priceId===idOf(item?.price));
  const invoice=sub.latest_invoice;
  const periodEnd=item?.current_period_end??sub.current_period_end;
  const invoiceMatches=plan&&invoice?.lines?.data?.some(line=>idOf(line.pricing?.price_details?.price??line.price)===plan.priceId&&Number.isFinite(line.period?.end)&&line.period.end>=periodEnd);
  const verified=invoiceMatches&&plan&&item.quantity===1&&validMonthlyPrice(item.price,plan,mode)&&sub.status==='active'&&invoice?.status==='paid'&&Number.isFinite(periodEnd)&&periodEnd*1000>Date.now();
  let planId=verified?plan.id:previous?.plan_id??null,paidUntil=verified?new Date(periodEnd*1000).toISOString():previous?.paid_until??null;
  if(!plan||!['active','past_due'].includes(sub.status)){planId=null;paidUntil=null;}
  const mutation=randomUUID(),now=new Date().toISOString();
  const queries=[
    op('INSERT OR IGNORE INTO billing_events(event_id,mode,event_created,mutation_token,received_at) VALUES(?,?,?,?,?)',event.id,mode,event.created,mutation,now),
    op(`INSERT INTO billing_subscriptions(subscription_id,member_id,mode,plan_id,status,paid_until,cancel_at_period_end,last_event_created,updated_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_events WHERE event_id=? AND mutation_token=?)
      ON CONFLICT(subscription_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,paid_until=excluded.paid_until,cancel_at_period_end=excluded.cancel_at_period_end,last_event_created=excluded.last_event_created,updated_at=excluded.updated_at
      WHERE billing_subscriptions.last_event_created<=excluded.last_event_created`,sub.id,owner.member_id,mode,planId,sub.status,paidUntil,sub.cancel_at_period_end?1:0,event.created,now,event.id,mutation),
  ];
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&object?.id)queries.push(op('UPDATE billing_checkouts SET expires_at=0 WHERE member_id=? AND mode=? AND session_id=? AND EXISTS(SELECT 1 FROM billing_events WHERE event_id=? AND mutation_token=?)',owner.member_id,mode,object.id,event.id,mutation));
  const result=await storage.batch(queries);
  return {processed:Boolean(result[1].changes)};
}
