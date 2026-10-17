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
const now=Date.parse('2026-10-15T15:00:00Z');
const row={symbol:'NTES',name:'NETEASE INC-ADR',kind:'stock_cfd',status:'READY',price:100,latestBar:now/1000-900,receivedAt:now,bars:100,stale:false,side:null,monitorPlan:{entry:100,side:'LONG',status:'WAITING'}};
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
 const known=renderToStaticMarkup(React.createElement(Logo,{asset:{market:'thai',symbol:'PTT'}}));assert.ok(known.includes('image-stock/PTT.BK.png'));assert.ok(known.includes('referrerPolicy="no-referrer"'));assert.ok(!known.includes('apikey'));
});
