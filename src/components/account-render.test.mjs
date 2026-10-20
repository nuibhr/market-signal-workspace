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
