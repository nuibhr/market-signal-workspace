import Stripe from 'stripe';
import {stripeMode} from './plans.mjs';
export function stripeClient(){
  stripeMode();
  return new Stripe(process.env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000});
}
export function billingOrigin(){
  let url;try{url=new URL(process.env.APP_ORIGIN);}catch{throw Error('STRIPE_NOT_CONFIGURED');}
  if(url.pathname!=='/'||url.search||url.hash||url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('INVALID_BILLING_CONFIG');
  return url.origin;
}
export function stripeRedirect(url){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(parsed.hostname))throw Error('STRIPE_UNAVAILABLE');
  return parsed.href;
}
