import {ALL_ASSETS} from '../markets/catalog.mjs';
import {createTfexClient} from '../market-data/settrade.mjs';
import {getYahooHistory} from '../market-data/yahoo-history.mjs';
import {publishSharedSeries} from '../market-data/shared-policy.mjs';
const tfex=createTfexClient();
export const dailyUniverse=market=>ALL_ASSETS.filter(a=>a.id===market);
export async function runDailyReferences(market,{symbols,maxSymbols=8,budgetMs=20000}={}){
 let scanned=0;const errors=[],deadline=Date.now()+budgetMs;
 for(const symbol of symbols.slice(0,maxSymbols)){
  if(Date.now()>=deadline)break;scanned++;
  const asset=ALL_ASSETS.find(a=>a.id===market&&a.symbol===symbol);
  try{
   let series;
   if(market==='tfex'){
    if(process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED!=='true'||!tfex.configuration.configured)throw Error('SOURCE_NOT_CONFIGURED');
    series=await tfex.getCandles(symbol,'1d',750);
   }else{
    // Metals CFDs must not be relabelled gold/silver futures from another venue.
    if(!/^[A-Z]{3}\/[A-Z]{3}$/.test(symbol)||['XAU','XAG'].includes(symbol.slice(0,3)))throw Error('PERSONAL_DATA_CONNECTION_REQUIRED');
    if(process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED!=='true')throw Error('DISPLAY_RIGHTS_NOT_CONFIRMED');
    series=await getYahooHistory(asset,'1d');
   }
   await publishSharedSeries({...series,instrumentId:asset.instrumentId,timeframe:'1d'},asset,'1d');
  }catch{errors.push({symbol,code:'DAILY_SOURCE_UNAVAILABLE'});}
 }
 return {status:errors.length?'partial':'complete',scanned,published:0,errors};
}
