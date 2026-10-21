import { createSettradeClient, createTfexClient } from '../market-data/settrade.mjs';
import { nativeUniverse } from './universe.mjs';
import { ingestBars, recordFailure } from './store.mjs';
import { candleClosedAt } from '../market-data/delayed-candles.mjs';
import {DISCOVERY_INTERVAL_MS,ACTIVE_MONITOR_INTERVAL_MS} from '../signals/cadence.mjs';

export function createNativeScanner({db,env=process.env,now=Date.now,clients={SET:createSettradeClient(),TFEX:createTfexClient()}}) {
  let index=0,pauseUntil=0;
  const assets=['thai','dr','tfex'].flatMap(nativeUniverse);
  return async function step() {
    if(now()<pauseUntil)return {status:'rate-limited'};
    const stamp=now();
    const checked=new Map(db.prepare("SELECT scope,symbol,checked FROM daytrade_coverage WHERE scope IN ('native:thai','native:dr','native:tfex')").all().map(r=>[`${r.scope}:${r.symbol}`,r.checked]));
    const active=new Set(db.prepare("SELECT scope,symbol FROM daytrade_cursor WHERE scope IN ('native:thai','native:dr') AND json_extract(body,'$.active') IS NOT NULL").all().map(r=>[r.scope,r.symbol].join(':')));
    const due=a=>{
      const key=`native:${a.market}:${a.symbol}`;
      const right=a.market==='tfex'?'TFEX_DISPLAY_RIGHTS_CONFIRMED':'SETTRADE_DISPLAY_RIGHTS_CONFIRMED';
      if(env.NODE_ENV==='production'&&env[right]!=='true')return true;
      // Do not accelerate TFEX as a side effect of skipping Thai/DR candidates.
      const interval=active.has(key)?ACTIVE_MONITOR_INTERVAL_MS:a.market==='tfex'?assets.length*1000:DISCOVERY_INTERVAL_MS;
      return !checked.has(key)||stamp-checked.get(key)>=interval;
    };
    // Existing native positions retain their own faster queue. Persisted
    // coverage prevents reopening the app/worker from resetting the cooldown.
    let asset=assets.filter(a=>active.has(`native:${a.market}:${a.symbol}`)&&due(a)).sort((a,b)=>(checked.get(`native:${a.market}:${a.symbol}`)??0)-(checked.get(`native:${b.market}:${b.symbol}`)??0))[0];
    for(let i=0;!asset&&i<assets.length;i++){const candidate=assets[index++%assets.length];if(due(candidate))asset=candidate;}
    if(!asset)return {status:'idle'};
    const scope=`native:${asset.market}`;
    const right=asset.market==='tfex'?'TFEX_DISPLAY_RIGHTS_CONFIRMED':'SETTRADE_DISPLAY_RIGHTS_CONFIRMED';
    if(env.NODE_ENV==='production'&&env[right]!=='true'){
      recordFailure(db,scope,asset,'DISPLAY_RIGHTS_NOT_CONFIRMED',now());return;
    }
    const client=clients[asset.market==='tfex'?'TFEX':'SET'];
    if(!client.configuration.configured){recordFailure(db,scope,asset,'SOURCE_NOT_CONFIGURED',now());return;}
    try {
      const series=await client.getCandles(asset.symbol,'15m',1000);
      const stamp=now();
      const bars=series.bars.filter(b=>candleClosedAt(b,'15m',asset.market)+900000<=stamp);
      if(!bars.length)throw Object.assign(Error('NO_CLOSED_BARS'),{code:'NO_CLOSED_BARS'});
      // Reference results use explicit assumptions; actual execution fees are
      // account-specific. They are shown beside the replay and never broker P/L.
      db.exec('BEGIN IMMEDIATE');
      try {
        ingestBars(db,scope,asset,bars,{now:stamp,source:series.source,spread:0,slippageBps:5,
          delaySeconds:900,feeBps:asset.market==='tfex'?0:10});
        db.exec('COMMIT');
      } catch(error){db.exec('ROLLBACK');throw error;}
      return {market:asset.market,status:'checked'};
    } catch(error){
      if(error.status===429)pauseUntil=now()+60000;
      recordFailure(db,scope,asset,error.status===429?'RATE_LIMITED':['RATE_LIMITED','NO_CLOSED_BARS'].includes(error.code)?error.code:'SOURCE_UNAVAILABLE',now());
    }
  };
}
