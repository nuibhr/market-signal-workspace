import {legacyScanHandler} from '../../../market-data/contracts/v1/legacy-scan-server.mjs';
import {requireDataOwner} from '../../../market-data/contracts/v1/owner-server.mjs';
import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
import { saveUsCosts, usCostProfile, defaultSignalCosts } from '../../../signals/store.mjs';
import { runSignalScan } from '../../../signals/runner.mjs';
import { loadSignalReplay } from '../../../signals/replay.mjs';
import { enqueueScannerRequest } from '../../../scanner/requests.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
async function member(){const m=await currentMember();return membershipFor(m).capabilities.autoPickFeed?m:null;}
const denied=()=>Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
export const GET=legacyScanHandler('swing','thai',['thai','dr','us']);
export async function POST(request){
  if(!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
  const m=await member();if(!m)return denied();
  let body;try{body=await readJsonBody(request,4096);}catch(e){return requestErrorResponse(e);}
  const limited=await rateLimit('signal-desk-write',m.id,3);if(limited)return limited;
  try{
    if(body.action==='costs')return Response.json({status:'saved',profile:await saveUsCosts(m.id,body.costs||{})},{headers:privateHeaders});
    const ownerDenied=await requireDataOwner(request);if(ownerDenied)return ownerDenied;
    const asset=ALL_ASSETS.find(a=>a.id===body.market&&a.symbol===body.symbol&&['thai','dr','us'].includes(a.id));
    if(body.action==='replay'&&asset){
      const globalLimit=await rateLimit('signal-replay','provider-global',6);if(globalLimit)return globalLimit;
      const costs=asset.id==='us'?(await usCostProfile(m.id))?.costs:defaultSignalCosts(asset);
      if(!costs)return Response.json({code:'COSTS_REQUIRED'},{status:422,headers:privateHeaders});
      return Response.json(await loadSignalReplay(asset,costs),{headers:privateHeaders});
    }
    if(body.action==='scan'&&['thai','dr','us'].includes(body.market)&&Array.isArray(body.symbols)&&body.symbols.length>0&&body.symbols.length<=6){
      if(process.env.SHARED_MARKET_DATA_MODE==='daily')return Response.json({code:'PERSONAL_DATA_CONNECTION_REQUIRED',message:'ผลส่วนกลางสแกนวันละครั้ง การสแกนเพิ่มต้องเชื่อมข้อมูลส่วนตัวที่รองรับก่อน'},{status:409,headers:privateHeaders});
      const globalLimit=await rateLimit('signal-scan','provider-global',6);if(globalLimit)return globalLimit;
      if(process.env.SCANNER_RUNTIME==='vps')return Response.json(await enqueueScannerRequest(body.market,body.symbols),{status:202,headers:privateHeaders});
      return Response.json(await runSignalScan(body.market,{symbols:body.symbols,maxSymbols:6,budgetMs:25000}),{headers:privateHeaders});
    }
    return Response.json({code:'INVALID_SIGNAL_REQUEST'},{status:400,headers:privateHeaders});
  }catch(e){const invalid=['COSTS_REQUIRED','INVALID_COSTS','INVALID_SYMBOLS'].includes(e.message);return Response.json({code:invalid?e.message:'SIGNAL_SOURCE_UNAVAILABLE'},{status:invalid?400:503,headers:privateHeaders});}
}
