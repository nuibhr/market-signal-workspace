import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
test('actual chart routes pass canonical allowlists and do not call a disallowed native source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'chart-rights-'));globalThis.__chartRightsCalls=[];
 try{
  for(const [route,market,symbol] of [['market-data','thai','CPALL'],['tfex/candles','tfex','S50Z26'],['us-bars','us','NVDA'],['history-bars','thai','CPALL']]){
   const outfile=join(dir,route.replaceAll('/','-')+'.mjs');
   await build({entryPoints:[resolve('src/app/api',route,'route.js')],outfile,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/(chart-runtime|settrade|shared-policy|chart-backup|us-eod|request-guard|delayed-candles)\.mjs$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:
     a.path.endsWith('chart-runtime.mjs')?'export const chartHandler=read=>read;':
     a.path.endsWith('shared-policy.mjs')?'export const sharedDaily=()=>false;export const sharedSeriesResponse=()=>{throw Error("unexpected shared");};':
     a.path.endsWith('settrade.mjs')?`export class SettradeDataError extends Error{};export const MAX_CANDLE_BARS=1000;export const assessDailySeries=()=>({});export const assessIntradaySeries=()=>({});export const createSettradeClient=()=>({configuration:{configured:true},getCandles:async()=>{globalThis.__chartRightsCalls.push('native');throw Error('unexpected native');}});export const createTfexClient=createSettradeClient;`:
     a.path.endsWith('chart-backup.mjs')?`export const loadChartBackup=async(asset,frame,opts)=>{globalThis.__chartRightsCalls.push(opts.allowedProviders);return {status:'available',symbol:asset.symbol,instrumentId:asset.instrumentId,timeframe:frame,bars:[]};};`:
     a.path.endsWith('us-eod.mjs')?`export const getUsDailyBars=async(symbol,opts)=>{globalThis.__chartRightsCalls.push(opts.allowedProviders);return {symbol,bars:[]};};`:
     a.path.endsWith('delayed-candles.mjs')?'export const rememberChartSnapshot=async()=>{};export const candleClosedAt=()=>0;':
     'export const rateLimit=async()=>null;'}));
   }}]});
   const {GET}=await import(pathToFileURL(outfile));globalThis.__chartRightsCalls=[];
   const response=await GET(new Request(`https://fixture.invalid/api/${route}?market=${market}&symbol=${symbol}&timeframe=1d`),{allowedProviders:['yahoo']});
   assert.equal(response.status,200,route);assert.deepEqual(globalThis.__chartRightsCalls,[['yahoo']],route);
  }
 }finally{delete globalThis.__chartRightsCalls;await rm(dir,{recursive:true,force:true});}
});
