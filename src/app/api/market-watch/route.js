import {marketHandler} from '../../../market-data/contracts/v1/runtime.mjs';
import {apiError} from '../../../market-data/contracts/v1/http.mjs';
import {ALL_ASSETS} from '../../../markets/catalog.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 const params=new URL(request.url).searchParams;
 const symbols=(params.get('symbols')??params.get('symbol')??'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
 if(!symbols.length)return apiError('INVALID_SYMBOL');
 const assets=symbols.map(symbol=>ALL_ASSETS.find(a=>a.symbol===symbol));
 if(assets.some(a=>!a))return apiError('INVALID_SYMBOL');
 const market=assets[0].id;
 if(assets.some(a=>a.id!==market))return apiError('INVALID_MARKET');
 return marketHandler(market,'quotes')(request);
}
