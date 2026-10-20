import {currentMember,privateHeaders,sameOrigin} from '../membership/server.mjs';
import {readJsonBody,RequestError,requestErrorResponse,rateLimit} from '../security/request-guard.mjs';
import {pendingPlans,stripeMode} from './plans.mjs';
import {checkout,listPlans,portal} from './store.mjs';
const STATUS={LOGIN_REQUIRED:401,INVALID_PLAN:400,INVALID_BILLING_CONFIG:503,INVALID_STRIPE_PRICE:503,STRIPE_NOT_CONFIGURED:503,SUBSCRIPTION_EXISTS:409,CHECKOUT_ALREADY_OPEN:409,CHECKOUT_PENDING:409,BILLING_CUSTOMER_REQUIRED:400};
function failed(error){const code=STATUS[error?.message]?error.message:'STRIPE_UNAVAILABLE';return Response.json({error:code},{status:STATUS[code]??503,headers:privateHeaders});}
let catalogCache,catalogUntil=0,catalogPending;
export async function plansHandler(){
  try{if(!catalogCache||Date.now()>=catalogUntil){if(!catalogPending)catalogPending=listPlans().then(plans=>{catalogCache={configured:true,mode:stripeMode(),plans};catalogUntil=Date.now()+60000;return catalogCache;}).finally(()=>{catalogPending=null;});await catalogPending;}return Response.json(catalogCache,{headers:privateHeaders});}
  catch(error){return Response.json({configured:false,plans:pendingPlans(),error:STATUS[error?.message]?error.message:'STRIPE_UNAVAILABLE'},{headers:privateHeaders});}
}
export async function billingAction(request,kind,{getMember=currentMember,stripe}={}){
  if(!sameOrigin(request))return Response.json({error:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const member=await getMember();
  if(!member)return failed(Error('LOGIN_REQUIRED'));
  const limited=await rateLimit('billing',member.id,10);if(limited)return limited;
  try{
    const body=await readJsonBody(request,1024);
    const response=kind==='checkout'?await checkout(member,body.planId,{...(stripe?{stripe}:{})}):await portal(member,{...(stripe?{stripe}:{})});
    return Response.json(response,{headers:privateHeaders});
  }catch(error){return error instanceof RequestError?requestErrorResponse(error):failed(error);}
}
