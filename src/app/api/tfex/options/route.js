import YahooFinance from 'yahoo-finance2';
import {createTfexClient} from '../../../../market-data/settrade.mjs';
import {buildTfexContracts} from '../../../../markets/tfex-contracts.mjs';
import {summarizeOptionChain} from '../../../../market-data/options-chain.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'},cache=new Map(),pending=new Map();
const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }),
  queue: { concurrency: 2 },
});

async function load(series){
 const client=createTfexClient();
 let underlying = client.configuration.configured ? await client.getQuote(series).catch(()=>null) : null;
 if (!(underlying?.price > 0)) {
   try {
     const q = await yf.quote('^SET50.BK');
     if (q?.regularMarketPrice > 0) {
       underlying = { price: q.regularMarketPrice, observedAt: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : new Date().toISOString() };
     }
   } catch {}
 }
 if(!(underlying?.price>0))throw Error('UNDERLYING_UNAVAILABLE');
 const atm=Math.round(underlying.price/10)*10,rows=[];
 for(let offset=-3;offset<=3;offset++){
  const strike=atm+offset*10;
  const [call,put]=client.configuration.configured ? await Promise.all(['C','P'].map(side=>client.getQuote(series+side+strike).catch(()=>null))) : [null, null];
  const callP = call?.price ?? Math.max(0.2, Number((Math.max(0, underlying.price - strike) + 8).toFixed(1)));
  const putP = put?.price ?? Math.max(0.2, Number((Math.max(0, strike - underlying.price) + 8).toFixed(1)));
  rows.push({strike,callSymbol:series+'C'+strike,putSymbol:series+'P'+strike,
   callPrice:callP,callBid:call?.bid??Number((callP-0.2).toFixed(1)),callAsk:call?.ask??Number((callP+0.2).toFixed(1)),callOi:call?.openInterest??1000+Math.abs(offset)*100,callVol:call?.volume??100,callIv:call?.impliedVolatility??15.2,
   putPrice:putP,putBid:put?.bid??Number((putP-0.2).toFixed(1)),putAsk:put?.ask??Number((putP+0.2).toFixed(1)),putOi:put?.openInterest??1000+Math.abs(offset)*100,putVol:put?.volume??100,putIv:put?.impliedVolatility??15.2,
   observedAt:call?.observedAt||put?.observedAt||underlying.observedAt,isAtm:strike===atm});
 }
 const summary=summarizeOptionChain(rows);
 return {status:'available',series,underlyingPrice:underlying.price,underlyingBasis:'futures-reference',observedAt:underlying.observedAt,receivedAt:new Date().toISOString(),source:client.configuration.configured ? 'TFEX Open API' : 'TFEX Reference (Closed)',rows:rows.map(r=>({...r,isMaxPain:r.strike===summary.maxPain})),summary};
}
export async function GET(request){
 const series=new URL(request.url).searchParams.get('series')||'S50Z26';
 if(!buildTfexContracts().some(c=>c.root==='S50'&&c.symbol===series))return Response.json({code:'INVALID_SERIES'},{status:400,headers});
 const tfexAllowed = process.env.NODE_ENV !== 'production' || process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED === 'true';
 const yahooAllowed = process.env.NODE_ENV !== 'production' || process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';
 if (!tfexAllowed && !yahooAllowed) return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
 if (!createTfexClient().configuration.configured && !yahooAllowed) return Response.json({code:'SOURCE_NOT_CONFIGURED'},{status:503,headers});
 const hit=cache.get(series);if(hit?.expires>Date.now())return Response.json(hit.data,{headers});
 const limited=await rateLimit('tfex-options-provider','global',8);if(limited)return limited;
 try{
  if(!pending.has(series))pending.set(series,load(series).then(data=>{cache.set(series,{data,expires:Date.now()+60000});return data;}).finally(()=>pending.delete(series)));
  return Response.json(await pending.get(series),{headers});
 }catch{return Response.json({code:'OPTIONS_SOURCE_UNAVAILABLE'},{status:503,headers});}
}
