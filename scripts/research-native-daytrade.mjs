import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {receiverConfiguration} from '../src/forex-mt5/runtime-policy.mjs';
import {nativeUniverse} from '../src/daytrade/universe.mjs';
import {summarize} from '../src/daytrade/engine.mjs';
import {replayNativeResearch,NATIVE_RESEARCH_SPEC} from '../src/daytrade/native-research.mjs';
const destination=process.argv[2];
if(!destination)throw Error('Usage: node --env-file=.env.local scripts/research-native-daytrade.mjs OUTPUT.json');
const db=new DatabaseSync(receiverConfiguration().databasePath,{readOnly:true});
db.exec('BEGIN');
const source=db.prepare("SELECT scope,symbol,body FROM daytrade_bars WHERE scope IN ('native:thai','native:dr') ORDER BY scope,symbol").all();
const forward=db.prepare("SELECT scope,body FROM daytrade_forward WHERE scope IN ('native:thai','native:dr')").all();
db.exec('COMMIT');db.close();
const now=Date.now(),snapshotHash=createHash('sha256').update(JSON.stringify(source)).digest('hex');
const stamp=t=>new Date(t*1000).toISOString(),day=t=>new Date((t+25200)*1000).toISOString().slice(0,10);
const markets=[];
for(const market of ['thai','dr']){
  const universe=new Map(nativeUniverse(market).map(a=>[a.symbol,a]));
  const rows=source.filter(r=>r.scope===`native:${market}`).map(r=>({...r,series:JSON.parse(r.body)}));
  const dates=[...new Set(rows.flatMap(r=>r.series.bars.map(b=>day(b.time))))].sort();
  const splitDay=dates[Math.floor(dates.length*0.7)];
  const variants=[];
  for(const candidate of [false,true]){
    const trades=[],rejections={};let open=0;
    for(const r of rows){const asset=universe.get(r.symbol);if(!asset)continue;
      const replay=replayNativeResearch(asset,r.series.bars,{candidate,now});
      trades.push(...replay.trades);open+=replay.open;
      for(const [k,n]of Object.entries(replay.rejections))rejections[k]=(rejections[k]||0)+n;
    }
    const train=trades.filter(t=>day(t.entryTime)<splitDay),holdout=trades.filter(t=>day(t.entryTime)>=splitDay);
    const stats=items=>({...summarize(items),sessionEnd:items.filter(t=>t.reason==='SESSION_END').length,
      symbols:new Set(items.filter(t=>t.status==='CLOSED').map(t=>t.symbol)).size});
    variants.push({version:candidate?NATIVE_RESEARCH_SPEC.version:'existing-v1-with-observed-feed-delay',
      training:stats(train),holdout:stats(holdout),all:stats(trades),open,rejections});
  }
  const actual=forward.filter(r=>r.scope===`native:${market}`).map(r=>JSON.parse(r.body));
  const times=rows.flatMap(r=>r.series.bars.map(b=>b.time));
  markets.push({market,coverage:{symbols:rows.length,bars:times.length,sessionDates:dates.length,first:stamp(Math.min(...times)),last:stamp(Math.max(...times))},
    splitDay,splitBasis:'chronological first 70% / last 30% diagnostic comparison; recent live losses informed the candidate, so this is not an independent untouched holdout; no parameter search',
    actualForward:summarize(actual),actualExitReasons:actual.filter(t=>t.status==='CLOSED').reduce((a,t)=>(a[t.reason]=(a[t.reason]||0)+1,a),{}),variants});
}
const report={createdAt:new Date(now).toISOString(),source:'immutable observations in local native daytrade_bars; read-only snapshot',snapshotHash,
  delaySeconds:900,scanLagSeconds:5,costs:{feeBpsPerSide:10,slippageBpsPerSide:5,spread:0,entryTickRounding:'unchanged adverse rounding'},candidateSpec:NATIVE_RESEARCH_SPEC,
  interpretation:'Research replays are separate from forward results. Gaps and ambiguous bars stay REVIEW. Equal risk per trade; overlapping symbols are not a portfolio simulation. Provider coverage is short and incomplete; there is no deployment acceptance from a positive short sample.',
  deployment:{thai:'paused-new-signals',dr:'paused-new-signals',reason:'15-minute delayed source is unsuitable for claiming timely intraday entry; candidate has no validated longer forward record'},markets};
writeFileSync(resolve(destination),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
