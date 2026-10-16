import { createSettradeClient, createTfexClient } from '../market-data/settrade.mjs';
import { nativeUniverse } from './universe.mjs';
import { ingestBars, recordFailure } from './store.mjs';
import { candleClosedAt } from '../market-data/delayed-candles.mjs';

export function createNativeScanner({db,env=process.env,now=Date.now,clients={SET:createSettradeClient(),TFEX:createTfexClient()}}) {
  let index=0,pauseUntil=0;
  const assets=['thai','dr','tfex'].flatMap(nativeUniverse);
  return async function step() {
    if(now()<pauseUntil)return {status:'rate-limited'};
    const asset=assets[index++%assets.length],scope=`native:${asset.market}`;
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
