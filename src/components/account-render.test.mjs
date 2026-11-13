import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToString} from 'react-dom/server';
test('authenticated account overview renders its Pro tools and package section without missing icon errors',async()=>{
 const result=await build({entryPoints:['src/components/account-page.jsx'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',jsx:'automatic',logLevel:'silent'});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>{const value=createRequire(import.meta.url)(name);return name==='next/image'?value.default:value;},module,module.exports);
 const Account=module.exports.default;
 const markup=renderToString(React.createElement(Account,{initialData:{configured:true,account:{id:'fixture',displayName:'Fixture member',portfolioStatus:'verified'},rights:{tier:'subscriber',label:'สมาชิก',planName:'Pro',expiresAt:'2026-11-21T00:00:00Z',capabilities:{manualDailyScan:true},limits:{dailyScanSymbols:8}},aiQuota:{freeRemaining:50,freeLimit:50},billing:{configured:false}}}));
 assert.match(markup,/Fixture member/);assert.match(markup,/บริหารความเสี่ยง/);assert.match(markup,/แพ็กเกจและน้องนักออม/);assert.match(markup,/50 \/ 50 ครั้งวันนี้/);
});
test('customer account has no portfolio enrollment CTA or broker number form and displays the selected-market cap',async()=>{
 const result=await build({entryPoints:['src/components/account-page.jsx'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',jsx:'automatic',logLevel:'silent'});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>{const value=createRequire(import.meta.url)(name);return name==='next/image'?value.default:value;},module,module.exports);
 const markup=renderToString(React.createElement(module.exports.default,{initialData:{configured:true,account:{id:'fixture',displayName:'Fixture',portfolioStatus:'none'},rights:{tier:'subscriber',planId:'starter',label:'Starter',capabilities:{manualDailyScan:true},limits:{dailyScanSymbols:8}},aiQuota:null,billing:{configured:false}}}));
 assert.ok(!markup.includes('แจ้งเลขพอร์ตหุ้น'));assert.ok(!markup.includes('BROKERAGE ACCOUNT'));assert.ok(!markup.includes('เลขบัญชีซื้อขายหลักทรัพย์'));assert.match(markup,/3 หุ้น \/ ครั้ง/);
});
test('TFEX customer terminal renders after BYOK removal and contains no broker credential controls',async()=>{
 const result=await build({entryPoints:['src/components/tfex/tfex-terminal.jsx'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',jsx:'automatic',logLevel:'silent',plugins:[{name:'styles',setup(b){b.onResolve({filter:/\.module\.css$/},a=>({path:a.path,namespace:'styles'}));b.onLoad({filter:/.*/,namespace:'styles'},()=>({contents:'export default {};',loader:'js'}));}}]});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const markup=renderToString(React.createElement(module.exports.default,{selectedSymbol:'S50Z26',onSelect:()=>{}}));
 assert.match(markup,/READ-ONLY/);for(const text of ['BYOK','App Secret','App ID','SETTRADE OPEN API GATEWAY','ต่อโบรค'])assert.ok(!markup.includes(text),text);
});
test('Thai and DR Radar have no nested customer portfolio tab',async()=>{
 const result=await build({entryPoints:['src/components/dr/dr-strategy-radar.jsx'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',jsx:'automatic',logLevel:'silent',plugins:[{name:'styles',setup(b){b.onResolve({filter:/\.module\.css$/},a=>({path:a.path,namespace:'styles'}));b.onLoad({filter:/.*/,namespace:'styles'},()=>({contents:'export default {};',loader:'js'}));}}]});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>{const value=createRequire(import.meta.url)(name);return name==='next/image'?value.default:value;},module,module.exports);
 for(const currentMarket of ['thai','dr']){
  const markup=renderToString(React.createElement(module.exports.default,{currentMarket,signalAccess:false,visible:false}));
  assert.ok(!markup.includes('ALGO_EQ'));assert.ok(!markup.includes('App Secret'));assert.ok(!markup.includes('พอร์ต &amp; API'));
 }
});
