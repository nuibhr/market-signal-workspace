import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'next/dist/build/swc/index.js';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {monitorRow,MARKET_LABELS} from './view.mjs';
// Compile the actual small UI components, including their logo fallback, with
// Next's bundled transform. CSS class names are retained for structural checks.
function component(file) {
 const path=new URL(file,import.meta.url),nativeRequire=createRequire(path);
 const source=readFileSync(path,'utf8').replace(/import styles from ['"].*?\.css['"];?/g,"const styles=new Proxy({}, {get:(_t,key)=>String(key)});");
 const compiled=transformSync(source,{jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>name.endsWith('.jsx')?component(new URL(name,path).href):nativeRequire(name),module,module.exports);
 return module.exports;
}
const Table=component('../components/monitor/market-table.jsx').default;
const Cards=component('../components/monitor/opportunity-cards.jsx').default;
const Logo=component('../components/monitor/instrument-logo.jsx').default;
const RecordDetails=component('../components/monitor/trade-record.jsx').TradeRecordDetails;
const DecisionPlan=component('../components/dr/decision-desk.jsx').DecisionPlan;
const {ThaiScreenerTable,filterThaiRows}=component('../components/thai/thai-screener-dashboard.jsx');
const Radar=component('../components/dr/dr-strategy-radar.jsx').default;
const {MarketScanner}=component('../components/workspace-features.jsx');
const {default:ThaiWorkspaceNav,THAI_VIEWS,thaiViewForHash}=component('../components/thai/thai-workspace-nav.jsx');
test('Thai workspace exposes stable deep links, one selected view and a reachable style scanner',()=>{
 for(const view of THAI_VIEWS){
  const html=renderToStaticMarkup(React.createElement(ThaiWorkspaceNav,{view:view.id,symbol:'PTT'}));
  assert.equal((html.match(/aria-current="location"/g)??[]).length,1);
  for(const target of THAI_VIEWS)assert.ok(html.includes(`href="${target.hash}"`));
  assert.equal(thaiViewForHash(view.hash),view.id);
  assert.ok(html.includes('สแกนตามสไตล์'));assert.ok(html.includes('PTT'));
 }
 assert.equal(thaiViewForHash('#section-overview'),'stage2');
});
test('compact Thai table keeps chart and plan identities while revealing optional metrics only when requested',()=>{
 const row={symbol:'PTT',market:'thai',section:'SET100',score:8,stage:2,status:'available',criteria:[],rsi:62,pe:9,rvol:2,plan:{entry:30,stopLoss:28,minimumTarget:35,stopPercent:7},planFrame:'4H'};
 const compact=renderToStaticMarkup(React.createElement(ThaiScreenerTable,{rows:[row],showMetrics:false}));
 const detailed=renderToStaticMarkup(React.createElement(ThaiScreenerTable,{rows:[row],showMetrics:true}));
 for(const html of [compact,detailed]){assert.ok(html.includes('ดูกราฟ PTT'));assert.ok(html.includes('30 / 28 / 35'));}
 for(const label of ['RSI14','P/E / Div%','RVOL / RS vs SET']){assert.ok(!compact.includes(label));assert.ok(detailed.includes(label));}
});
test('restored Radar renders only its market tools and one canonical ledger; the style scanner retains both styles',()=>{
 for(const market of ['thai','dr']){
  const html=renderToStaticMarkup(React.createElement(Radar,{currentMarket:market,signalAccess:false}));
  assert.ok(html.includes(market==='thai'?'Thai Strategy Radar':'DR Strategy Radar'));
  assert.equal(html.includes('หุ้นไทย Scanner (SET Picks)'),market==='thai');
  assert.equal(html.includes('DR80 Scanner (DR Picks)'),market==='dr');
  assert.equal(html.includes('Indicative &amp; Arbitrage Bridge'),market==='dr');
  assert.equal(html.split('id="section-results"').length-1,1);
  assert.ok(html.includes('สแกนตามสไตล์ (Swing/Scalp)'));
 }
 const html=renderToStaticMarkup(React.createElement(MarketScanner,{asset:{symbol:'PTT',id:'thai'},market:{id:'thai'},favorites:[]}));
 for(const text of ['เลือกสไตล์การสแกน','Swing Trading','Scalping / Daytrade','EOD / Position','4H'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('AAPL80'));
});
const now=Date.parse('2026-10-15T15:00:00Z');
const row={symbol:'NTES',name:'NETEASE INC-ADR',kind:'stock_cfd',status:'READY',price:100,latestBar:now/1000-900,receivedAt:now,bars:100,stale:false,side:null,monitorPlan:{entry:100,side:'LONG',status:'WAITING'}};
test('Thai table preserves accessible favorites, exact chart action and honest missing values; filters never treat missing fundamentals as cheap',()=>{
 const rows=[{symbol:'PTT',name:'PTT',market:'thai',section:'SET100',score:8,criteria:[],stage:2,status:'available',templatePass:true,pe:9,dividendPercent:6,rsi:60,rvol:2,rs:{outperforming:true,excessReturnPercent:5}},
 {symbol:'AOT',name:'AOT',market:'thai',section:'SET100',score:null,criteria:[],stage:null,status:'unavailable',pe:null,dividendPercent:null,rsi:null,rvol:null}];
 const html=renderToStaticMarkup(React.createElement(ThaiScreenerTable,{rows,favorites:['PTT'],selectedSymbol:'PTT'}));
 for(const copy of ['ดูกราฟ PTT','เลิกติดตาม PTT','8/8','/instrument-logos/thai/PTT.png','ประวัติไม่ครบ'])assert.ok(html.includes(copy),copy);
 assert.deepEqual(filterThaiRows(rows,{preset:'dividend'}).map(r=>r.symbol),['PTT']);assert.deepEqual(filterThaiRows(rows,{peMax:15}).map(r=>r.symbol),['PTT']);assert.equal(filterThaiRows(rows,{preset:'orb'}).length,0);
 assert.deepEqual(filterThaiRows(rows,{savedOnly:true,favorites:['AOT']}).map(r=>r.symbol),['AOT']);
});
test('decision card renders canonical net-cost levels and risk sizing without implying an entered trade',()=>{
 const plan={signalEligible:true,entry:100,entryBasis:101,stopLoss:97,minimumTarget:110,netRiskPerUnit:4.5,stopPercent:4,friction:{assumptions:{commissionPercent:0.06,marketFeePercent:0.005,commissionVatPercent:7,slippagePercent:0.15}}};
 const candidate={market:'thai',symbol:'PTT',name:'PTT',mode:'breakout',category:'waiting',price:100,relativeVolume:1.2,trigger:{breakout:101},plan,checks:[{label:'D1 ขาขึ้น',passed:true},{label:'4H ทะลุกรอบ',passed:false}]};
 const html=renderToStaticMarkup(React.createElement(DecisionPlan,{row:candidate,capital:'50000',riskBudget:'1000',lotSize:'100'}));
 for(const value of ['รอเงื่อนไขครบ','ระดับเข้าแผน','Stop โครงสร้าง','TP1 · ขาย 50%','200 หุ้น','20,200','900','แบ่ง TP1 100','Gap','0.15'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('ซื้อทันที'));const zero=renderToStaticMarkup(React.createElement(DecisionPlan,{row:candidate,capital:'100',riskBudget:'10',lotSize:'100'}));assert.ok(zero.includes('งบยังไม่พอ'));assert.ok(!zero.includes('200 หุ้น'));
});
test('real table component renders NTES target touch with accessible button and truthful time/price labels',()=>{
 const r=monitorRow(row,'us','connected',now),html=renderToStaticMarkup(React.createElement(Table,{rows:[r],selected:{market:'us',symbol:'NTES'}}));
 for(const copy of ['NTES','NETEASE','US CFD','ราคาเข้า / ระยะห่าง','แตะระดับราคา','รอเงื่อนไขครบ','Delayed','ปิดแท่ง 15m','ประเมิน','รับ'])assert.ok(html.includes(copy),copy);
 assert.ok(html.includes('tabindex="0"'));assert.ok(html.includes('aria-selected="true"'));assert.ok(html.includes('<button'));assert.ok(!html.includes('Real-time'));assert.ok(!html.includes('เข้าเงื่อนไขแล้ว'));
});
test('real component renders simultaneous groups and textual abnormal state, no color-only signal',()=>{
 const rows=[monitorRow({...row,side:'LONG',monitorPlan:{...row.monitorPlan,status:'OPEN'}},'thai','server',now),monitorRow({...row,symbol:'S50',status:'UNAVAILABLE'},'tfex','server',now),monitorRow({...row,symbol:'NTES',latestBar:null,price:null,monitorPlan:null},'us','stale',now)];
 const html=renderToStaticMarkup(React.createElement(Table,{rows}));assert.equal((html.split('<tbody>')[1].match(/<tr/g)||[]).length,3);assert.ok(html.includes('เข้าเงื่อนไขแล้ว'));assert.ok(html.includes('ตรวจเงื่อนไขไม่ได้'));assert.ok(html.includes('Unavailable'));assert.ok(html.includes('ยังไม่มีแผน'));assert.ok(html.includes('TFEX'));
});

test('MVP cards show real score breakdown, direction and selected accessible chart action',()=>{
 const pick=monitorRow({...row,side:'LONG',ranking:{score:82,factors:[{label:'แนวโน้ม',points:30,max:30}]}},'us','connected',now);
 const html=renderToStaticMarkup(React.createElement(Cards,{rows:[pick],selected:{symbol:'NTES',market:'us'}}));
 for(const copy of ['82','/100','LONG','ที่มาคะแนน','30/30','เปิดกราฟ NTES คะแนน 82 จาก 100','aria-pressed="true"','image-stock/NTES.png','ไม่ใช่โอกาสชนะ'])assert.ok(html.includes(copy),copy);
});
test('MVP has explicit empty/loading/member states and no sample picks',()=>{
 for(const [props,copy] of [[{},'ยังไม่มีสินทรัพย์ผ่านเกณฑ์'],[{loading:true},'กำลังจัดอันดับ'],[{locked:true},'เข้าสู่ระบบสมาชิก'],[{unavailable:true},'รอข้อมูลที่พร้อมประเมิน']]){
  const html=renderToStaticMarkup(React.createElement(Cards,props));assert.ok(html.includes(copy));assert.ok(!html.includes('/100'));assert.ok(!html.includes('<img'));
 }
});
test('unknown logo stays a local monogram and known logo uses no-referrer without secrets',()=>{
 const unknown=renderToStaticMarkup(React.createElement(Logo,{asset:{market:'us',symbol:'UNKNOWN.a'}}));assert.ok(!unknown.includes('<img'));assert.ok(unknown.includes('UN'));
 const known=renderToStaticMarkup(React.createElement(Logo,{asset:{market:'thai',symbol:'PTT'}}));assert.ok(known.includes('/instrument-logos/thai/PTT.png'));assert.ok(known.includes('referrerPolicy="no-referrer"'));assert.ok(!known.includes('apikey'));
});
test('actual record details show entry, exit, timeline, counted state and same ledger summary',()=>{
  const t={id:'exact-record',market:'us',symbol:'NTES',side:'SHORT',status:'CLOSED',publishedAt:now,entryTime:now/1000+900,exitTime:now/1000+1800,trigger:100,stop:105,plan:{entry:100,stop:105,target:90},exit:90,reason:'TP',netR:2};
  const html=renderToStaticMarkup(React.createElement(RecordDetails,{reference:{ledger:'daytrade'},data:{record:t,rule:'daytrade-trend-15m-v1',summary:{closed:1,winRate:100,averageR:2,review:0}}}));
  for(const copy of ['exact-record','NTES','SHORT','นับในสถิติแล้ว 1 ไม้','Exit 90','ถึง TP · ปิดไม้','หนึ่งไม้มีหลายแจ้งเตือนได้','สถิติจากบันทึกชุดเดียวกัน'])assert.ok(html.includes(copy),copy);
  const review=renderToStaticMarkup(React.createElement(RecordDetails,{reference:{ledger:'daytrade'},data:{record:{...t,status:'REVIEW',exitTime:null,netR:null},summary:{closed:0,review:1}}}));
  assert.ok(review.includes('ยังไม่นับในสถิติไม้ปิด'));assert.ok(!review.includes('นับในสถิติแล้ว 1 ไม้'));
});
test('enabled legacy Swing shell renders with centralized audio state, without a missing speechState variable',()=>{
  const path=new URL('../components/signal-desk.jsx',import.meta.url),nativeRequire=createRequire(path);
  const source=readFileSync(path,'utf8').replace(/import DaytradePanel from .*?;/,"const DaytradePanel=()=>null;").replace(/import \{useMonitor\} from .*?;/,"const useMonitor=()=>({audio:'blocked'});")+"\nexport {LegacySignalDesk};";
  const compiled=transformSync(source,{jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
  const module={exports:{}};new Function('require','module','exports',compiled)(nativeRequire,module,module.exports);
  const html=renderToStaticMarkup(React.createElement(module.exports.LegacySignalDesk,{marketId:'thai',memberId:'fixture',rights:{capabilities:{autoPickFeed:true}}}));
  assert.ok(html.includes('อุปกรณ์ยังเล่นเสียงไม่ได้'));assert.ok(html.includes('กดเปิดเสียงที่แถบบนอีกครั้ง'));assert.ok(html.includes('สแกนและติดตามสัญญาณ'));
});
