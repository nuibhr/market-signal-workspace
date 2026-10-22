// Optional bounded cold-start warmup. Normal refresh is one profile per scan.
// This reads public company metadata, never member accounts or trading ledgers.
import {signalUniverse} from '../src/signals/data.mjs';
import {loadThaiProfile,loadThaiBenchmark} from '../src/signals/thai-context.mjs';
const symbols=signalUniverse('thai').map(a=>a.symbol);let index=0,available=0;
const benchmark=await loadThaiBenchmark();
await Promise.all(Array.from({length:2},async()=>{while(index<symbols.length){const symbol=symbols[index++];const result=await loadThaiProfile(symbol);if(result?.status==='available')available++;await new Promise(r=>setTimeout(r,1000));}}));
console.log(JSON.stringify({symbols:symbols.length,available,benchmarkBars:benchmark.bars?.length??0}));
