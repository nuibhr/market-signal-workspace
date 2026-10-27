import {rateLimit} from '../../../security/request-guard.mjs';
import {createTfexClient} from '../../settrade.mjs';
import {storage} from '../../../storage/database.mjs';
import {isAdmin} from '../../../membership/store.mjs';
import {receiverConfiguration} from '../../../forex-mt5/runtime-policy.mjs';
import {storeFor} from '../../../forex-mt5/store.mjs';
import {currentMember} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {generateStrategyFeed} from '../../../dr/strategy-feed.mjs';
import {thaiScreenerFeed} from '../../../signals/thai-screener.mjs';
import {usDeskBatch,US_FOCUS_SYMBOLS,US_ROTATION_SYMBOLS} from '../../desk-feed.mjs';
import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {candleClosedAt} from '../../delayed-candles.mjs';
import {expectedThaiDailySession} from '../../thai-feed-meta.mjs';
import {createCanonicalHandler} from './handlers.mjs';
import {legacyInput} from './adapters.mjs';
import {displayRights} from './pipeline.mjs';
// This registry must be provisioned only after evidence is reviewed. A provider
// flag, successful request, test fixture or development mode is not evidence.
export function rightsEvidence(env=process.env){
 try {const v=JSON.parse(env.CANONICAL_DISPLAY_RIGHTS_JSON||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}
}
const closeAt=(market,day)=>{const ms=candleClosedAt({time:day},'1d',market);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
function calendar(market,now){
 if(market!=='thai')return null; // Other exchange calendars still need approved evidence.
 const day=expectedThaiDailySession(now);return day?{verified:true,closeAt:closeAt(market,day)}:null;
}
const thai=['CPALL','BDMS','ADVANC','GULF','PTT','DELTA','KBANK','SCB'];
const dr=['AAPL80','NVDA80','MSFT80','TSLA80','BABA80','TENCENT80'];
export function scanAssets(market,universe="default"){
 const preferred=market==='thai'?thai:market==='dr'?dr:market==='us'?(universe==='etf'?US_ROTATION_SYMBOLS:US_FOCUS_SYMBOLS):null;
 return preferred?preferred.map(symbol=>ALL_ASSETS.find(a=>a.id===market&&a.symbol===symbol)??{id:market,symbol,instrumentId:`${market.toUpperCase()}:${symbol}`}):ALL_ASSETS.filter(a=>a.id===market);
}
const unavailable=(market,universe)=>scanAssets(market,universe).map(a=>({...legacyInput({symbol:a.symbol,instrumentId:a.instrumentId,status:'unavailable'},market,{closeAt}),attempted:false}));
async function loadInputs(market,{now,evidence,universe}){
 // Require every source that a legacy loader may fall back to BEFORE it runs;
 // row-specific rights are checked again after loading.
 const required=market==='us'?['fmp','yahoo']:['settrade','yahoo'];
 if(market==='tfex')return loadTfex({now,evidence});
 if(market==='forex')return loadForex({now,evidence});
 if(!required.every(id=>displayRights(evidence,market,id,now)==='CONFIRMED'))return unavailable(market,universe);
 try{
  let rows;
  if(market==='thai')rows=(await thaiScreenerFeed(now)).rows;
  else if(market==='dr'){
   const data=await generateStrategyFeed({markets:['dr'],now});rows=[...data.scoredDRs,...data.unavailable];
  }else rows=await usDeskBatch(universe==='etf'?US_ROTATION_SYMBOLS:US_FOCUS_SYMBOLS);
  const bySymbol=new Map(rows.map(r=>[r.symbol,r]));
  return scanAssets(market,universe).map(a=>legacyInput(bySymbol.get(a.symbol)??{symbol:a.symbol,status:'unavailable'},market,{closeAt}));
 }catch{return unavailable(market,universe);}
}
export function marketHandler(market=null,legacyView=null){return createCanonicalHandler({currentMember,membershipFor,loadInputs,evidence:rightsEvidence,calendar,market,legacyView,rateLimit});}

async function loadTfex({now,evidence}) {
 if(displayRights(evidence,'tfex','settrade',now)!=='CONFIRMED')return unavailable('tfex');
 const client=createTfexClient();if(!client.configuration.configured)return unavailable('tfex');
 const rows=[];
 for(const a of scanAssets('tfex').slice(0,8)){
  let quote;try{quote=await client.getQuote(a.symbol);}catch{quote=null;}
  rows.push({market:'tfex',symbol:a.symbol,instrumentId:a.instrumentId,providerId:'settrade',providerState:quote?.status==='available'?'READY':'UNAVAILABLE',
   dataMode:'DELAYED',dataKind:'FUTURES_QUOTE',observedAt:quote?.observedAt??null,dataAsOf:quote?.observedAt??null,receivedAt:quote?.receivedAt??null,
   qualityVerified:false,closed:false,available:quote?.status==='available',data:{price:quote?.price,changePct:quote?.changePercent,openInterest:quote?.openInterest??null}});
 }
 return rows;
}
async function loadForex({now,evidence}) {
 if(displayRights(evidence,'forex','owner-ingest',now)!=='CONFIRMED')return unavailable('forex');
 const ownerId=process.env.CANONICAL_FOREX_OWNER_ID;
 if(!ownerId)return unavailable('forex');
 const owner=await storage.first('SELECT id,line_id FROM members WHERE id=?',ownerId);
 if(!isAdmin(owner))return unavailable('forex');
 const config=receiverConfiguration();if(!config.enabled)return unavailable('forex');
 const store=storeFor(config),connection=store.connection(`owner:${ownerId}`);
 if(!connection||connection.expires<=now||connection.revoked||!config.servers.includes(connection.server))return unavailable('forex');
 const snapshot=JSON.parse(connection.snapshot||'null'),quotes=JSON.parse(connection.quotes),charts=JSON.parse(connection.charts);
 return scanAssets('forex').map(a=>{
  const instrument=snapshot?.instruments.find(i=>i.canonical_symbol===a.symbol||i.canonical_symbol===a.symbol.replace('/',''));
  const quote=quotes[instrument?.broker_symbol],chart=charts[`${instrument?.broker_symbol}|15m`];
  const sourceTime=Number.isFinite(quote?.time)?new Date(quote.time*1000).toISOString():null;
  return {market:'forex',symbol:a.symbol,instrumentId:a.instrumentId,providerId:'owner-ingest',providerState:quote?'READY':'UNAVAILABLE',
   dataMode:'DELAYED',dataKind:'SCAN_CANDIDATE',ownerIngest:true,connectionActive:true,heartbeatAt:connection.last_seen?new Date(connection.last_seen).toISOString():null,
   dataAsOf:sourceTime,observedAt:sourceTime,receivedAt:quote?.received_at??null,closed:true,qualityVerified:false,
   data:{price:quote?.bid,bid:quote?.bid,ask:quote?.ask,bars:chart?.bars,timeframe:'15m'}};
 });
}
