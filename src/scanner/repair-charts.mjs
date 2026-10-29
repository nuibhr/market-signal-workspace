import {storage} from '../storage/database.mjs';
import {signalUniverse,loadSignalFrame} from '../signals/data.mjs';
import {publishSharedSeries} from '../market-data/shared-policy.mjs';
import {dailyWindow} from './daily.mjs';
// One-time acceptance repair for already-scanned symbols only. No analysis,
// signal publication, manual jobs or complete universe restart is performed.
export async function repairSharedCharts({log=()=>{},hour=7}={}){
 let saved=0,failed=0;
 for(const market of ['thai','dr']){
  const row=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?',`daily-scan-v1:${market}:${dailyWindow(Date.now(),hour).key}`,Date.now());
  if(!row)continue;const progress=JSON.parse(row.payload_json),known=new Map(signalUniverse(market).map(a=>[a.symbol,a]));
  for(const symbol of (progress.roster||[]).slice(0,progress.next)){
   const asset=known.get(symbol);if(!asset)continue;
   for(const frame of ['1d','4h']){
    const cached=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?',`chart-snapshot-v1:${market}:${asset.instrumentId}:${frame}`,Date.now());
    if(cached)continue;
    try{await publishSharedSeries(await loadSignalFrame(asset,frame),asset,frame);saved++;}
    catch{failed++;}
   }
   log({event:'scanner.chart-repair',market,symbol,saved,failed});
  }
 }
 return {saved,failed};
}
