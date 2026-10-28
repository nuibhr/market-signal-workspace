import {nativeSource,scanAssets} from './runtime.mjs';
import {ownerPreviewAccess,ownerPreviewEnabled,validOwnerPreviewKey,OWNER_PREVIEW_COOKIE} from './owner-preview-policy.mjs';
import {apiError,privateHeaders} from './http.mjs';
import {MARKET_IDS} from './status-codes.mjs';
const sourceName=id=>id==='fmp'?'Financial Modeling Prep · EOD':id==='settrade'?'Settrade Market API':id==='owner-ingest'?'Owner ingestion':'Unknown';
export function previewStatus(request){return Response.json({active:ownerPreviewAccess(request),scope:ownerPreviewAccess(request)?'OWNER_INTERNAL':null},{headers:privateHeaders});}
export function openPreview(request){
 if(!ownerPreviewEnabled())return apiError('SOURCE_NOT_CONFIGURED');
 const url=new URL(request.url),origin=new URL(process.env.APP_ORIGIN);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||(request.headers.get('host')??url.host)!==origin.host||!validOwnerPreviewKey(url.searchParams.get('key')))return apiError('FORBIDDEN');
 return new Response(null,{status:303,headers:{...privateHeaders,'Referrer-Policy':'no-referrer',Location:origin.origin+'/thai',
  'Set-Cookie':`${OWNER_PREVIEW_COOKIE}=${process.env.CANONICAL_OWNER_PREVIEW_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((Number(process.env.CANONICAL_OWNER_PREVIEW_EXPIRES)-Date.now())/1000))}`}});
}
export async function readOwnerPreview(request){
 if(!ownerPreviewAccess(request))return apiError('OWNER_ONLY');
 try{
  const p=new URL(request.url).searchParams,market=p.get('market'),view=p.get('view')??'rows',universe=p.get('universe')??'default';
  if(!MARKET_IDS.includes(market))return apiError('INVALID_MARKET');
  if(!['rows','thai','chart'].includes(view)||!['default','etf'].includes(universe))return apiError('INVALID_VIEW');
  if(p.has('timeframe')&&p.get('timeframe')!=='1d')return apiError('INVALID_DATA_REQUEST');
  const assets=scanAssets(market,universe).slice(0,8),symbol=p.get('symbol')?.toUpperCase();
  if(symbol&&!assets.some(a=>a.symbol===symbol))return apiError('MEMBERSHIP_REQUIRED');
  const inputs=market==='forex'?[]:(await nativeSource(market,{universe})).slice(0,8);
  const selected=symbol?inputs.filter(r=>r.symbol===symbol):inputs;
  const base={disclosureScope:'OWNER_INTERNAL',customerDisplayRights:'UNCONFIRMED',market,isLiveFeed:false,signalEligible:false,performanceEligible:false,executionEligible:false,generatedAt:new Date().toISOString()};
  if(view==='chart'){
   const row=selected[0];if(!row?.available||!row.data.bars?.length)return apiError('PROVIDER_UNAVAILABLE');
   return Response.json({...base,status:'available',instrumentId:row.instrumentId,symbol:row.symbol,timeframe:'1d',source:sourceName(row.providerId),
    dataAsOf:row.dataAsOf,receivedAt:row.receivedAt??null,observedAt:null,latestDay:row.data.bars.at(-1).time,latestTime:null,
    freshness:'unknown',chartOnly:true,fallback:false,live:false,quote:null,bars:row.data.bars,availableBars:row.data.bars.length},{headers:privateHeaders});
  }
  const rows=selected.map(r=>({symbol:r.symbol,instrumentId:r.instrumentId,market,status:r.available?'available':'unavailable',
   source:sourceName(r.providerId),code:r.failureCode??null,dataAsOf:r.dataAsOf??null,receivedAt:r.receivedAt??null,observedAt:r.observedAt??null,
   price:r.available?r.data.price??null:null,changePercent:r.available?r.data.changePct??null:null,
   openInterest:r.available?r.data.openInterest??null:null,closedBars:r.data.bars?.length??0,signalEligible:false,isLiveFeed:false}));
  if(view==='thai')return Response.json({...base,status:rows.some(r=>r.status==='available')?'available':'unavailable',rows:rows.map(r=>({...r,name:assets.find(a=>a.symbol===r.symbol)?.name??r.symbol,
   section:assets.find(a=>a.symbol===r.symbol)?.sectionId??null,priceDay:r.dataAsOf?.slice(0,10)??null,score:null,stage:null,criteria:[],templatePass:false,plan:null,rs:null,rsi:null,macdHistogram:null,rvol:null,pe:null,dividendPercent:null})),
   stats:{expected:rows.length,observed:rows.filter(r=>r.status==='available').length,stage2:0,surge:0,rsLeaders:[],advance:rows.filter(r=>r.changePercent>0).length,decline:rows.filter(r=>r.changePercent<0).length,flat:rows.filter(r=>r.changePercent===0).length,index:null}},{headers:privateHeaders});
  return Response.json({...base,status:rows.some(r=>r.status==='available')?'available':'unavailable',rows,code:market==='forex'?'SOURCE_NOT_CONFIGURED':null},{headers:privateHeaders});
 }catch{return apiError('PROVIDER_UNAVAILABLE');}
}
