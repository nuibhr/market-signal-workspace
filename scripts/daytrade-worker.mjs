import {ForexStore} from '../src/forex-mt5/store.mjs';
import {createNativeScanner} from '../src/daytrade/native-worker.mjs';
const store=new ForexStore(process.env.FOREX_MT5_DATABASE_PATH||'data/forex-mt5.sqlite');
const step=createNativeScanner({db:store.db});
let stopped=false,wake;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopped=true;wake?.();});
console.log('Daytrade 15m collector started: Thai / DR / TFEX. CFD is collected through the authenticated MT5 bridge.');
while(!stopped){
  try{await step();}catch{console.error('DAYTRADE_CYCLE_FAILED');}
  if(!stopped)await new Promise(resolve=>{const timer=setTimeout(resolve,1000);wake=()=>{clearTimeout(timer);resolve();};});
}
store.db.close();
