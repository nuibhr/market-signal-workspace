import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import { currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { sharedDatabase } from '../../../membership/store.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
import { createSettradeClient, assessDailySeries } from '../../../market-data/settrade.mjs';
import { getUsDailyBars } from '../../../market-data/us-eod.mjs';
import { analyzeCandles } from '../../../analysis/technical.mjs';
import { customerSummary } from '../../../analysis/customer-summary.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const client=createSettradeClient();
function db(){const d=sharedDatabase();d.exec(`CREATE TABLE IF NOT EXISTS customer_holdings(member_id TEXT NOT NULL, market TEXT NOT NULL, symbol TEXT NOT NULL, cost REAL NOT NULL, quantity REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(member_id,market,symbol))`);return d;}
async function member(){const m=await currentMember();return m&&membershipFor(m).capabilities.manualDailyScan?m:null;}
export async function POST(request){
 if(!sameOrigin(request))return Response.json({code:'INVALID_ORIGIN'},{status:403,headers:privateHeaders});
 const m=await member();if(!m)return Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
 const limited=rateLimit('holdings-write',m.id,10);if(limited)return limited;
 let v;try{v=await readJsonBody(request,4096);}catch(error){return requestErrorResponse(error);}
 const {symbol,market}=v;const cost=Number(v.cost),quantity=Number(v.quantity);
 if(!['thai','dr','us'].includes(market)||typeof symbol!=='string')return Response.json({code:'INVALID_SYMBOL'},{status:400});
 if(v.action==='remove'){db().prepare('DELETE FROM customer_holdings WHERE member_id=? AND market=? AND symbol=?').run(m.id,market,symbol);return Response.json({ok:true},{headers:privateHeaders});}
 if(!ALL_ASSETS.some(a=>a.symbol===symbol&&a.id===market))return Response.json({code:'INVALID_SYMBOL'},{status:400});
 if(!Number.isFinite(cost)||cost<=0||!Number.isFinite(quantity)||quantity<=0)return Response.json({code:'INVALID_INPUT'},{status:400});
 if(!db().prepare('SELECT 1 FROM customer_holdings WHERE member_id=? AND market=? AND symbol=?').get(m.id,market,symbol)&&db().prepare('SELECT COUNT(*) n FROM customer_holdings WHERE member_id=?').get(m.id).n>=20)return Response.json({code:'LIMIT_20'},{status:400});
 db().prepare(`INSERT INTO customer_holdings VALUES(?,?,?,?,?,?) ON CONFLICT(member_id,market,symbol) DO UPDATE SET cost=excluded.cost,quantity=excluded.quantity,updated_at=excluded.updated_at`).run(m.id,market,symbol,cost,quantity,new Date().toISOString());return Response.json({ok:true},{headers:privateHeaders});
}
export async function GET(){
 const m=await member();if(!m)return Response.json({code:'MEMBERSHIP_REQUIRED'},{status:403,headers:privateHeaders});
 const limited=rateLimit('holdings-read',m.id,30);if(limited)return limited;
 const rows=db().prepare('SELECT market,symbol,cost,quantity FROM customer_holdings WHERE member_id=? ORDER BY updated_at DESC').all(m.id);const results=[];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());
 for(const row of rows){try{
  let series;if(row.market==='us')series=await getUsDailyBars(row.symbol);else{
   if(process.env.NODE_ENV==='production'&&process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED!=='true')throw Error('RIGHTS');
   series=await client.getCandles(row.symbol,'1d',250);}
  const bars=series.bars.filter(b=>b.time<today);const analysis=analyzeCandles(bars);
  const eligible=row.market==='us'?Boolean(series.latestDay&&Date.now()-Date.parse(series.latestDay)<8*86400000):assessDailySeries({...series,bars}).signalEligible;
  results.push({...row,source:series.source,latestDay:bars.at(-1)?.time,price:analysis?.price,...customerSummary(analysis,eligible,row.cost)});
 }catch{results.push({...row,score:null,label:'ข้อมูลไม่พร้อม',text:'เรียกข้อมูลไม่ได้ ไม่ประเมินจุดซื้อขาย'});}}
 return Response.json({results,asOf:new Date().toISOString(),basis:'ราคาปิดรายวัน ไม่ใช่มูลค่าพอร์ตสด'},{headers:privateHeaders});
}
