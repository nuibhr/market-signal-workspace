import {summarizeOptionChain} from '../../options-chain.mjs';
import {apiError,privateHeaders} from './http.mjs';
import {canonicalTier,displayRights,projectEnvelope} from './pipeline.mjs';
import {ENTITLEMENT_CAPS} from './status-codes.mjs';
import {validateOutput} from './schema-validator.mjs';
export function createOptionsHandler({currentMember,membershipFor,contracts,getQuote,evidence,rateLimit=async()=>null,clock=Date.now}){
 return async request=>{
  try{
   const p=new URL(request.url).searchParams,series=p.get('series')??'S50Z26';
   if(!contracts().some(c=>c.root==='S50'&&c.symbol===series))return apiError('INVALID_SYMBOL');
   const now=clock(),member=await currentMember(request),tier=canonicalTier(membershipFor(member)),rights=evidence();
   const cap=ENTITLEMENT_CAPS[tier].maxFullCards||1;
   const limited=await rateLimit('canonical-options',member?.id??'public',30);if(limited)return apiError('RATE_LIMITED');
   let inputs=[],atmStrike=null;
   if(displayRights(rights,'tfex','settrade',now)==='CONFIRMED'){
    const underlying=await getQuote(series);
    if(underlying?.status==='available'&&underlying.price>0){
     const atm=Math.round(underlying.price/10)*10;atmStrike=atm;
     // Stable ATM-out selection; no client strike/page filter can reveal extra options.
     const specs=[0,-1,1,-2,2,-3,3].flatMap(offset=>['C','P'].map(side=>({strike:atm+offset*10,side}))).slice(0,cap);
     for(const spec of specs){
      const symbol=series+spec.side+spec.strike;let quote=null;
      try{quote=await getQuote(symbol);}catch{}
      inputs.push({market:'tfex',symbol,instrumentId:'TFEX:'+symbol,assetType:'OPTION',dataKind:'OPTIONS_CHAIN',providerId:'settrade',
       providerState:quote?.status==='available'?'READY':'UNAVAILABLE',dataMode:'DELAYED',dataAsOf:quote?.observedAt??null,observedAt:quote?.observedAt??null,
       receivedAt:quote?.receivedAt??null,available:quote?.symbol===symbol&&quote?.status==='available',qualityVerified:false,closed:false,
       data:{price:quote?.price,bid:quote?.bid,ask:quote?.ask,openInterest:quote?.openInterest??null,volume:quote?.volume}});
     }
    }
   }
   const envelope=projectEnvelope(inputs,{market:'tfex',tier,now,evidence:rights,kind:'REFERENCE'});
   if(!validateOutput(envelope).valid)return apiError('INTERNAL_ERROR');
   if(p.get('format')==='canonical')return Response.json(envelope,{headers:privateHeaders});
   const grouped=new Map();
   for(const r of envelope.records.filter(r=>r.projection==='FULL')){
    const match=r.instrument.symbol.slice(series.length).match(/^([CP])(\d+)$/);if(!match)continue;
    const side=match[1]==='C'?'call':'put',strike=Number(match[2]);
    const pair=grouped.get(strike)??{strike,callPrice:null,putPrice:null,callBid:null,callAsk:null,putBid:null,putAsk:null,callOi:null,putOi:null,callVol:null,putVol:null,callIv:null,putIv:null,isAtm:strike===atmStrike,isMaxPain:false};
    pair[side+'Symbol']=r.instrument.symbol;pair[side+'Source']=r.source.providerId;
    pair[side+'ObservedAt']=r.timestamps.observedAt;pair[side+'Status']=r.status.availability;
    for(const [target,key] of [['Price','price'],['Bid','bid'],['Ask','ask'],['Oi','openInterest'],['Vol','volume']])pair[side+target]=r.data[key]??null;
    grouped.set(strike,pair);
   }
   const rows=[...grouped.values()].sort((a,b)=>a.strike-b.strike);
   return Response.json({status:envelope.status.availability.toLowerCase(),series,rows,underlyingPrice:null,source:'settrade',isLiveFeed:false,
    summary:summarizeOptionChain(rows)}, {headers:privateHeaders});
  }catch{return apiError('PROVIDER_UNAVAILABLE');}
 };
}
