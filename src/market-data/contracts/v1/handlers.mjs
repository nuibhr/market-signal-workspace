import {canonicalTier,projectEnvelope} from './pipeline.mjs';
import {validateOutput} from './schema-validator.mjs';
import {compatibility} from './adapters.mjs';
import {MARKET_IDS} from './status-codes.mjs';
import {apiError,privateHeaders} from './http.mjs';
export function createCanonicalHandler({currentMember,membershipFor,loadInputs,evidence=()=>({}),calendar=()=>null,clock=Date.now,policy=null,market:fixedMarket,legacyView=null,rateLimit=async()=>null}) {
 return async request=>{
  try{
   const params=new URL(request.url).searchParams,market=params.get('market')??fixedMarket;
   if(!MARKET_IDS.includes(market)||(fixedMarket&&market!==fixedMarket))return apiError('INVALID_MARKET');
   const view=params.get('view');
   if(view&&!['focus','screener','rotation','diagnostic','fx'].includes(view))return apiError('INVALID_VIEW');
   if(params.has('timeframe')&&params.get('timeframe')!=='1d')return apiError('INVALID_DATA_REQUEST');
   const member=await currentMember(request),tier=canonicalTier(membershipFor(member)),now=clock();
   const limited=await rateLimit('canonical-read',member?.id??'public',60);if(limited)return apiError('RATE_LIMITED');
   const universe=market==='us'&&(view==='rotation'||params.get('universe')==='etf')?'etf':'default';
   const inputs=await loadInputs(market,{now,evidence:evidence(),member,universe});
   const symbol=params.get('symbol')?.trim().toUpperCase();
   if(symbol&&!inputs.some(r=>r.symbol===symbol))return apiError('INVALID_SYMBOL');
   const symbols=params.has('symbols')?[...new Set(params.get('symbols').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))]:null;
   if(symbols&&(!symbols.length||symbols.some(s=>!inputs.some(r=>r.symbol===s))))return apiError('INVALID_SYMBOL');
   if(params.has('page')&&!/^[1-9][0-9]{0,5}$/.test(params.get('page')))return apiError('INVALID_REQUEST');
   const favorites=params.has('favorites')?params.get('favorites').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean):null;
   const query={symbol,symbols:symbols??favorites,q:params.get('q')?.trim().toUpperCase(),page:params.get('page')};
   const envelope=projectEnvelope(inputs,{market,tier,now,evidence:evidence(),calendar,policy,query});
   if(!validateOutput(envelope).valid)return apiError('INTERNAL_ERROR');
   if(legacyView&&params.get('format')!=='canonical')return Response.json(view==='fx'?{price:null,source:null,observedAt:null}:compatibility(envelope,legacyView,{mode:params.get('mode'),memberId:member?.id??'guest'}),{headers:privateHeaders});
   return Response.json(envelope,{headers:privateHeaders});
  }catch{return apiError('INTERNAL_ERROR');}
 };
}
