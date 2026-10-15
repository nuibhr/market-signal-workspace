import { runSignalScan } from '../src/signals/runner.mjs';
import { autoPickReadiness } from '../src/auto-pick/runner.mjs';
import { createLocalScanScheduler } from '../src/auto-pick/local-scheduler.mjs';
const scheduler=createLocalScanScheduler({runners:Object.fromEntries(['thai','dr','us'].map(m=>[m,()=>runSignalScan(m)])),
  onResult(m,r){if(r.status!=='busy')console.log(JSON.stringify({at:new Date().toISOString(),market:m,status:r.status,scanned:r.scanned,published:r.published}));},
  onError(m){console.error(JSON.stringify({at:new Date().toISOString(),market:m,code:'SIGNAL_WORKER_FAILURE'}));}});
let stopping=false,wake;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopping=true;wake?.();});
if(!autoPickReadiness().enabled){console.error('Signal source/readiness is not configured. No flags were changed.');process.exitCode=1;}
else{
  console.log('Swing signal-only worker started. No accounts, holdings or broker orders.');
  while(!stopping){
    scheduler.dispatch(autoPickReadiness().markets.filter(m=>m.status==='active'&&['thai','dr','us'].includes(m.id)).map(m=>m.id));
    await new Promise(resolve=>{const timer=setTimeout(resolve,30000);wake=()=>{clearTimeout(timer);resolve();};});
  }
  await scheduler.drain();
}
