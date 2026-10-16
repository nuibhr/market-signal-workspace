import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'next/dist/build/swc/index.js';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {monitorRow,MARKET_LABELS} from './view.mjs';
const source=readFileSync(new URL('../components/monitor/market-table.jsx',import.meta.url),'utf8');
const patched=source.replace("import {MARKET_LABELS} from '../../monitor/view.mjs';",'const MARKET_LABELS='+JSON.stringify(MARKET_LABELS)+';').replace("import styles from '../daytrade/daytrade.module.css';","const styles=new Proxy({}, {get:(_t,key)=>String(key)});");
const compiled=transformSync(patched,{jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
const module={exports:{}};new Function('require','module','exports',compiled)(createRequire(import.meta.url),module,module.exports);const Table=module.exports.default;
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
