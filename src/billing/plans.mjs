export const PAID_FEATURES=['manualDailyScan','autoPickFeed','aiQuestions','communityPosting'];
// Prices always come from Stripe. This server-only mapping defines the feature entitlement.
export const MEMBERSHIP_PLANS=[
 {id:'starter',name:'Starter',monthlyBaht:99,aiDailyLimit:10,dailyScanSymbols:8,features:[...PAID_FEATURES],priceEnv:'STRIPE_PRICE_STARTER_MONTHLY'},
 {id:'pro',name:'Pro',monthlyBaht:299,aiDailyLimit:50,dailyScanSymbols:8,features:[...PAID_FEATURES],priceEnv:'STRIPE_PRICE_PRO_MONTHLY'},
 {id:'ultimate',name:'Ultimate',monthlyBaht:599,aiDailyLimit:150,dailyScanSymbols:8,features:[...PAID_FEATURES],priceEnv:'STRIPE_PRICE_ULTIMATE_MONTHLY'},
];
export function configuredPlans(env=process.env) {
 const seen=new Set();
 return MEMBERSHIP_PLANS.flatMap(p=>{
   const priceId=env[p.priceEnv]?.trim();
   if(!priceId)return [];
   if(!/^price_[A-Za-z0-9]+$/.test(priceId)||seen.has(priceId))throw Error('INVALID_BILLING_CONFIG');
   seen.add(priceId);return [{...p,priceId}];
 });
}
export function pendingPlans(){return MEMBERSHIP_PLANS.map(({priceEnv,...p})=>({...p,amount:p.monthlyBaht*100,currency:'thb',interval:'month',ready:false}));}
export function stripeMode(env=process.env){
  const match=/^(?:sk|rk)_(test|live)_/.exec(env.STRIPE_SECRET_KEY||'');
  if(!match)throw Error('STRIPE_NOT_CONFIGURED');
  return match[1];
}
export function validMonthlyPrice(price,plan,mode){
  return price?.id===plan.priceId&&price.active===true&&price.livemode===(mode==='live')&&price.currency==='thb'&&Number.isSafeInteger(price.unit_amount)&&price.unit_amount===plan.monthlyBaht*100&&price.type==='recurring'&&price.recurring?.interval==='month'&&price.recurring.interval_count===1&&!price.recurring.usage_type?.includes('metered');
}
