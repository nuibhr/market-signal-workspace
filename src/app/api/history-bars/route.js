import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {getYahooHistory} from '../../../market-data/yahoo-history.mjs';
import {rateLimit} from '../../../security/request-guard.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
 const p=new URL(request.url).searchParams,market=p.get('market'),symbol=p.get('symbol')?.trim().toUpperCase(),timeframe=p.get('timeframe')??'1d';
 const asset=ALL_ASSETS.find(a=>a.id===market&&a.symbol===symbol);
 if(!asset)return Response.json({status:'unavailable',code:'UNKNOWN_INSTRUMENT'},{status:404,headers});
 if(process.env.NODE_ENV==='production'&&process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED!=='true')return Response.json({status:'unavailable',code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
 const limited=(await rateLimit('history-bars','provider-global',40));if(limited)return limited;
 try{return Response.json(await getYahooHistory(asset,timeframe),{headers});}
 catch(e){const known=['INSTRUMENT_NOT_SUPPORTED','TIMEFRAME_NOT_AVAILABLE','HISTORY_UNAVAILABLE','INSTRUMENT_MISMATCH','BARS_UNAVAILABLE'];return Response.json({status:'unavailable',code:known.includes(e.code)?e.code:'SOURCE_UNAVAILABLE'},{status:503,headers});}
}
