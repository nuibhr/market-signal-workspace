export const BASIC_FEATURES=['manualDailyScan','autoPickFeed','aiQuestions'];
export const PAID_FEATURES=[...BASIC_FEATURES,'communityPosting','telegramVip','voiceAlerts'];
export const BASIC_MARKETS=['thai','dr'];
export const ALL_MARKETS=['thai','dr','us','tfex','forex'];

// Prices always come from Stripe. This server-only mapping defines the 2-tier entitlement.
export const MEMBERSHIP_PLANS=[
 {id:'starter',name:'Starter',displayName:'BASIC',monthlyBaht:159,annualBaht:1590,aiDailyLimit:10,dailyScanSymbols:3,markets:[...BASIC_MARKETS],features:[...BASIC_FEATURES],priceEnv:'STRIPE_PRICE_STARTER_MONTHLY',annualPriceEnv:'STRIPE_PRICE_STARTER_ANNUAL'},
 {id:'pro',name:'Pro',displayName:'PRO VIP',monthlyBaht:399,annualBaht:3990,aiDailyLimit:50,dailyScanSymbols:8,markets:[...ALL_MARKETS],features:[...PAID_FEATURES],priceEnv:'STRIPE_PRICE_PRO_MONTHLY',annualPriceEnv:'STRIPE_PRICE_PRO_ANNUAL'},
];

const validPriceId=value=>/^price_[A-Za-z0-9]+$/.test(value);

export function configuredPlans(env=process.env) {
 const seen=new Set();
 return MEMBERSHIP_PLANS.flatMap(p=>{
   const priceId=env[p.priceEnv]?.trim();
   if(!priceId)return [];
   if(!validPriceId(priceId)||seen.has(priceId))throw Error('INVALID_BILLING_CONFIG');
   seen.add(priceId);
   const rawAnnual=p.annualPriceEnv?env[p.annualPriceEnv]?.trim():'';
   let annualPriceId=null;
   if(rawAnnual){
     if(!validPriceId(rawAnnual)||seen.has(rawAnnual))throw Error('INVALID_BILLING_CONFIG');
     seen.add(rawAnnual);
     annualPriceId=rawAnnual;
   }
   return [{...p,priceId,annualPriceId}];
 });
}

export function pendingPlans(){
  return MEMBERSHIP_PLANS.map(({priceEnv,annualPriceEnv,...p})=>({
    ...p,
    amount:p.monthlyBaht*100,
    annualAmount:p.annualBaht*100,
    currency:'thb',
    interval:'month',
    annualPriceReady:false,
    ready:false,
  }));
}

export function stripeMode(env=process.env){
  const match=/^(?:sk|rk)_(test|live)_/.exec(env.STRIPE_SECRET_KEY||'');
  if(!match)throw Error('STRIPE_NOT_CONFIGURED');
  return match[1];
}

function validStripeRecurringPrice(price,planId,expectedBaht,interval,mode){
  return Boolean(priceIdMatch(price,planId))&&price.active===true&&price.livemode===(mode==='live')&&price.currency==='thb'&&Number.isSafeInteger(price.unit_amount)&&price.unit_amount===expectedBaht*100&&price.type==='recurring'&&price.recurring?.interval===interval&&price.recurring.interval_count===1&&!price.recurring.usage_type?.includes('metered');
}

function priceIdMatch(price,expectedId){return typeof price?.id==='string'&&Boolean(expectedId)&&price.id===expectedId;}

export function validMonthlyPrice(price,plan,mode){
  return validStripeRecurringPrice(price,plan?.priceId,plan?.monthlyBaht,'month',mode);
}

export function validAnnualPrice(price,plan,mode){
  return Boolean(plan?.annualPriceId)&&validStripeRecurringPrice(price,plan.annualPriceId,plan?.annualBaht,'year',mode);
}

export function validPlanPrice(price,plan,mode){
  return validMonthlyPrice(price,plan,mode)||validAnnualPrice(price,plan,mode);
}
