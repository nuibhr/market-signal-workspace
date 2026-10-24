import {createTfexClient} from '../../../../market-data/settrade.mjs';
import {buildTfexContracts} from '../../../../markets/tfex-contracts.mjs';
import {summarizeOptionChain} from '../../../../market-data/options-chain.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'},cache=new Map(),pending=new Map();
async function load(series){
 const client=createTfexClient(),underlying=await client.getQuote(series);
 if(!(underlying.price>0))throw Error('UNDERLYING_UNAVAILABLE');
 const atm=Math.round(underlying.price/10)*10,rows=[];
 for(let offset=-3;offset<=3;offset++){
  const strike=atm+offset*10;
  const [call,put]=await Promise.all(['C','P'].map(side=>client.getQuote(series+side+strike).catch(()=>null)));
  rows.push({strike,callSymbol:series+'C'+strike,putSymbol:series+'P'+strike,
   callPrice:call?.price??null,callBid:call?.bid??null,callAsk:call?.ask??null,callOi:call?.openInterest??null,callVol:call?.volume??null,callIv:call?.impliedVolatility??null,
   putPrice:put?.price??null,putBid:put?.bid??null,putAsk:put?.ask??null,putOi:put?.openInterest??null,putVol:put?.volume??null,putIv:put?.impliedVolatility??null,
   observedAt:call?.observedAt||put?.observedAt||null,isAtm:strike===atm});
 }
 const summary=summarizeOptionChain(rows);
 return {status:rows.some(r=>r.callPrice!==null||r.putPrice!==null)?'available':'unavailable',series,underlyingPrice:underlying.price,underlyingBasis:'futures-reference',observedAt:underlying.observedAt,receivedAt:new Date().toISOString(),source:'TFEX Open API',rows:rows.map(r=>({...r,isMaxPain:r.strike===summary.maxPain})),summary};
}
export async function GET(request){
 const series=new URL(request.url).searchParams.get('series')||'S50Z26';
 if(!buildTfexContracts().some(c=>c.root==='S50'&&c.symbol===series))return Response.json({code:'INVALID_SERIES'},{status:400,headers});
 if(process.env.NODE_ENV==='production'&&process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED!=='true')return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
 if(!createTfexClient().configuration.configured)return Response.json({code:'SOURCE_NOT_CONFIGURED'},{status:503,headers});
 const hit=cache.get(series);if(hit?.expires>Date.now())return Response.json(hit.data,{headers});
 const limited=await rateLimit('tfex-options-provider','global',8);if(limited)return limited;
 try{
  if(!pending.has(series))pending.set(series,load(series).then(data=>{cache.set(series,{data,expires:Date.now()+60000});return data;}).finally(()=>pending.delete(series)));
  return Response.json(await pending.get(series),{headers});
 }catch{return Response.json({code:'OPTIONS_SOURCE_UNAVAILABLE'},{status:503,headers});}
}
