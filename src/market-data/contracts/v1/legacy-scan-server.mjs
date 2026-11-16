import {marketHandler} from './runtime.mjs';
import {apiError} from './http.mjs';
import {MARKET_IDS} from './status-codes.mjs';
// Historical ledgers are separate from current scan results. Legacy scans now
// share the canonical source, stable selection and post-entitlement serializer.
export function legacyScanHandler(view,defaultMarket,markets=MARKET_IDS){
 const handle=marketHandler(null,view);
 return request=>{
  const url=new URL(request.url),market=url.searchParams.get('market')??defaultMarket;
  if(!markets.includes(market))return apiError('INVALID_MARKET');
  const mode=url.searchParams.get('mode');
  if(mode&&!['all','breakout','pullback'].includes(mode))return apiError('INVALID_VIEW');
  url.searchParams.set('market',market);
  return handle(new Request(url,request));
 };
}
