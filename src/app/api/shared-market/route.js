import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {storage} from '../../../storage/database.mjs';
import {currentMember,privateHeaders} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {sharedCached,sharedDaily} from '../../../market-data/shared-policy.mjs';
import {sharedMarketRows} from '../../../market-data/shared-view.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request){
 const member=await currentMember();
 if(!membershipFor(member).capabilities.autoPickFeed)return Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
 const market=new URL(request.url).searchParams.get('market')||'thai';
 if(!['thai','dr','us','forex','tfex'].includes(market))return Response.json({code:'INVALID_MARKET'},{status:400,headers:privateHeaders});
 try{
  const data=await sharedCached(`daily-table:${market}`,async()=>{
   const rows=await storage.all(`SELECT json_extract(payload_json,'$.series.symbol') AS symbol,json_extract(payload_json,'$.series.instrumentId') AS instrument_id,json_extract(payload_json,'$.series.bars[#-1].close') AS price,json_extract(payload_json,'$.series.bars[#-2].close') AS previous_price,json_extract(payload_json,'$.series.source') AS source,json_extract(payload_json,'$.series.receivedAt') AS snapshot_at,json_extract(payload_json,'$.dataAsOfMs') AS price_ms FROM provider_cache WHERE id LIKE ? AND expires_at>?`,`chart-snapshot-v1:${market}:%:1d`,Date.now());
   return sharedMarketRows(ALL_ASSETS.filter(a=>a.id===market),rows);
  });
  return Response.json({dataMode:sharedDaily()?'daily-snapshot':'saved-snapshot',market,rows:data,available:data.filter(r=>r.status==='available').length,total:data.length,executionEligible:false},{headers:privateHeaders});
 }catch{return Response.json({code:'SHARED_DATA_UNAVAILABLE',message:'ยังอ่านข้อมูลส่วนกลางไม่ได้ กรุณาลองใหม่'},{status:503,headers:privateHeaders});}
}
