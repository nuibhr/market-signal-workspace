import {hostname} from 'node:os';
import {createScannerClient} from '../src/scanner/client.mjs';
import {withScannerDatabase} from '../src/storage/database.mjs';
import {runSignalScan} from '../src/signals/runner.mjs';
import {signalProviderAllowed} from '../src/signals/data.mjs';
import {createLocalScanScheduler} from '../src/auto-pick/local-scheduler.mjs';
import {runVpsMarket} from '../src/scanner/requests.mjs';
import {createDailyBatch,dailyWindow} from '../src/scanner/daily.mjs';
import {dailyUniverse,runDailyReferences} from '../src/scanner/daily-reference.mjs';
import {repairSharedCharts} from '../src/scanner/repair-charts.mjs';

const log=data=>console.log(JSON.stringify({at:new Date().toISOString(),...data}));
let stopping=false,wake;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopping=true;wake?.();});
const pause=()=>new Promise(resolve=>{const timer=setTimeout(resolve,30000);wake=()=>{clearTimeout(timer);resolve();};});
try{
  if(process.env.NODE_ENV!=='production'||process.env.STORAGE_PROVIDER!=='scanner-http')throw Error('VPS_SCANNER_CONFIGURATION_REQUIRED');
  const markets=(process.env.SCANNER_MARKETS??'thai,dr,us').split(',');
  if(!markets.length||new Set(markets).size!==markets.length||markets.some(m=>!(process.env.SCANNER_SCHEDULE_MODE==='daily'?['thai','dr','us','forex','tfex']:['thai','dr','us']).includes(m)||!signalProviderAllowed(m)))throw Error('SCANNER_MARKETS_NOT_READY');
  const client=createScannerClient({url:process.env.SCANNER_BRIDGE_URL,secret:process.env.SCANNER_BRIDGE_SECRET,instance:process.env.SCANNER_INSTANCE_ID||hostname()});
  if(process.argv.includes('--check')){
    // Preflight verifies D1 without claiming ownership or starting scans.
    const status=await client.status();
    log({event:'scanner.preflight',...status,markets});
  }else if(process.argv.includes('--repair-shared-charts')){
    await client.heartbeat();
    const heartbeat=setInterval(()=>client.heartbeat().catch(()=>{}),30000);
    try{log({event:'scanner.chart-repair-complete',...await withScannerDatabase(client.storage,()=>repairSharedCharts({log,hour:Number(process.env.SCANNER_DAILY_HOUR_BANGKOK||7)}))});}
    finally{clearInterval(heartbeat);await client.release();}
  }else{
    const daily=process.env.SCANNER_SCHEDULE_MODE==='daily',hour=Number(process.env.SCANNER_DAILY_HOUR_BANGKOK||7);
    dailyWindow(Date.now(),hour);
    const dailyBatch=createDailyBatch({run:(m,o)=>['forex','tfex'].includes(m)?runDailyReferences(m,o):runSignalScan(m,o),universe:dailyUniverse,hour}),completed=new Set();let idleUntil=Number(process.env.SCANNER_DAILY_NOT_BEFORE||0);
    const scheduler=createLocalScanScheduler({runners:Object.fromEntries(markets.map(m=>[m,()=>withScannerDatabase(client.storage,()=>daily?dailyBatch(m):runVpsMarket(m,runSignalScan))])),
      onResult(m,result){if(result.status==='daily-complete')completed.add(m);log({event:'scanner.scan',market:m,...result});},
      onError(m,error){log({event:'scanner.error',market:m,code:error.code??'SCANNER_RUN_FAILED'});}});
    log({event:'scanner.started',instance:process.env.SCANNER_INSTANCE_ID||hostname(),markets,schedule:daily?'daily':'continuous',dailyHourBangkok:daily?hour:null});
    try{
      while(!stopping){
        if(daily&&Date.now()<idleUntil){if(process.argv.includes('--once'))break;await pause();continue;}
        if(daily&&completed.size===markets.length&&!scheduler.active().length){
          await client.release();idleUntil=dailyWindow(Date.now(),hour).next;completed.clear();
          log({event:'scanner.daily-idle',nextRunAt:new Date(idleUntil).toISOString()});continue;
        }
        try{await client.heartbeat();if(!stopping)scheduler.dispatch(markets.filter(m=>!daily||!completed.has(m)));}
        catch(error){log({event:'scanner.standby',code:error.code??'SCANNER_BRIDGE_UNAVAILABLE'});}
        if(process.argv.includes('--once'))break;
        if(!stopping)await pause();
      }
    }finally{
      await scheduler.drain();
      await client.release().catch(()=>log({event:'scanner.release',status:'expires-within-120-seconds'}));
      log({event:'scanner.stopped'});
    }
  }
}catch(error){
  // Do not expose URLs containing credentials, environment values or SDK errors.
  log({event:'scanner.fatal',code:/^[A-Z_]+$/.test(error.message)?error.message:'SCANNER_CONFIGURATION_OR_RUNTIME_FAILURE'});
  process.exitCode=1;
}
