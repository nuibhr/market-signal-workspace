import {DISCOVERY_INTERVAL_MS} from '../signals/cadence.mjs';
// Shared per server process, after entitlement/rate-limit checks in the route.
// Refresh buttons read this cache too; a page reload cannot bypass its TTL.
export function createStrategyFeedCache({load,clock=Date.now}={}){
 let cached,pending,expires=0,retryAt=0;
 return async()=>{
  if(!pending&&(!cached||clock()>=expires)){
   if(clock()<retryAt)throw Error('SCAN_RETRY_LATER');
   pending=Promise.resolve().then(load).then(data=>{
    cached=data;expires=clock()+DISCOVERY_INTERVAL_MS;retryAt=0;return data;
   }).catch(error=>{retryAt=clock()+60000;throw error;}).finally(()=>{pending=null;});
  }
  const data=pending?await pending:cached;
  return {...data,scanIntervalMinutes:DISCOVERY_INTERVAL_MS/60000,nextRefreshAt:new Date(expires).toISOString()};
 };
}
