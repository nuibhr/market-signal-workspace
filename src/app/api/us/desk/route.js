import {currentMember} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
import {US_SCAN_SYMBOLS} from '../../../../markets/us-universe.mjs';
import {US_FOCUS_SYMBOLS,US_ROTATION_SYMBOLS,usDeskBatch,usDeskCached} from '../../../../market-data/desk-feed.mjs';
import {usEodRights} from '../../../../market-data/us-eod.mjs';
import {getYahooHistory} from '../../../../market-data/yahoo-history.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
 const p=new URL(request.url).searchParams,view=p.get('view')||'focus',page=Math.max(1,Math.floor(Number(p.get('page'))||1));
 if(!['focus','screener','rotation','diagnostic','fx'].includes(view))return Response.json({code:'INVALID_VIEW'},{status:400,headers});
 if(view==='fx'){
  const limited=await rateLimit('us-desk-fx','global',60);if(limited)return limited;
  if(process.env.NODE_ENV==='production'&&process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED!=='true')return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
  try{const s=await getYahooHistory({id:'forex',symbol:'USD/THB',instrumentId:'FX:USDTHB'},'1d');const b=s.bars.at(-1);return Response.json({price:b.close,source:s.source,observedAt:b.time},{headers});}
  catch{return Response.json({code:'FX_SOURCE_UNAVAILABLE'},{status:503,headers});}
 }
 if(!usEodRights().fmp&&!usEodRights().yahoo)return Response.json({code:'DISPLAY_RIGHTS_NOT_CONFIRMED'},{status:503,headers});
 const allowed=new Set([...US_SCAN_SYMBOLS,...US_FOCUS_SYMBOLS,...US_ROTATION_SYMBOLS,'INTC','NKE','BA','BABA','SMCI']);
 const q=(p.get('q')||'').trim().toUpperCase().slice(0,40),matches=US_SCAN_SYMBOLS.filter(s=>!q||s.includes(q));
 const symbol=(p.get('symbol')||'NVDA').toUpperCase();
 if(view==='diagnostic'&&!allowed.has(symbol))return Response.json({code:'INVALID_SYMBOL'},{status:400,headers});
 const symbols=view==='rotation'?US_ROTATION_SYMBOLS:view==='diagnostic'?[symbol]:view==='screener'?matches.slice((page-1)*6,page*6):US_FOCUS_SYMBOLS;
 if(!usDeskCached(symbols)){const limited=await rateLimit('us-desk-provider','global',30);if(limited)return limited;}
 const rows=await usDeskBatch(symbols),signalAccess=membershipFor(await currentMember()).capabilities.autoPickFeed;
 const visibleRows=signalAccess?rows:rows.map(row=>({...row,entry:null,stopLoss:null,tp1:null,tp2:null,tp1Reward:null,riskPercent:null,actionPlan:'เข้าสู่ระบบสมาชิกเพื่อดูระดับแผน'}));
 return Response.json({rows:visibleRows,signalAccess,page,pages:Math.max(1,Math.ceil(matches.length/6)),universe:US_SCAN_SYMBOLS.length,total:matches.length,generatedAt:new Date().toISOString()},{headers});
}
