import {currentMember} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {isAdmin} from '../../../membership/store.mjs';
import {storage} from '../../../storage/database.mjs';
import {storeFor} from '../../../forex-mt5/store.mjs';
import {receiverConfiguration} from '../../../forex-mt5/runtime-policy.mjs';
import {rateLimit} from '../../../security/request-guard.mjs';
import {tradeResults} from '../../../monitor/results-store.mjs';
import {STRATEGIES,RESULT_STATES,RESULT_SCOPES} from '../../../monitor/results.mjs';
import {canonicalTier,displayRights} from './pipeline.mjs';
import {MARKET_IDS,ENTITLEMENT_CAPS} from './status-codes.mjs';
import {scanAssets,rightsEvidence} from './runtime.mjs';
import {apiError,privateHeaders} from './http.mjs';
export function legacyLedgerHandler(view='results'){
 return async request=>{
  try{
   const p=new URL(request.url).searchParams,market=p.get('market')??'thai';
   if(!MARKET_IDS.includes(market))return apiError('INVALID_MARKET');
   const member=await currentMember(),tier=canonicalTier(membershipFor(member)),cap=ENTITLEMENT_CAPS[tier].maxFullCards;
   if(!cap)return apiError('MEMBERSHIP_REQUIRED');
   const query={market,strategy:p.get('strategy')??'all',status:p.get('status')??'all',scope:p.get('scope')??'history',page:p.get('page')??'1',tradeKey:p.get('trade')};
   if(!STRATEGIES.includes(query.strategy)||!RESULT_STATES.includes(query.status)||!RESULT_SCOPES.includes(query.scope)||!/^([1-9][0-9]{0,5})$/.test(query.page))return apiError('INVALID_REQUEST');
   const sources=market==='forex'?['owner-ingest']:market==='us'?['fmp','yahoo',...(process.env.CANONICAL_FOREX_OWNER_ID?['owner-ingest']:[])]:['settrade','yahoo'];
   const now=Date.now(),evidence=rightsEvidence();
   if(!sources.every(id=>displayRights(evidence,market,id,now)==='CONFIRMED'))return apiError('DISPLAY_RIGHTS_NOT_CONFIRMED');
   const limited=await rateLimit('canonical-ledger',member.id,90);if(limited)return apiError('RATE_LIMITED');
   let ownerConnection=null;
   const ownerId=process.env.CANONICAL_FOREX_OWNER_ID;
   if(ownerId&&['forex','us'].includes(market)){
    const owner=await storage.first('SELECT id,line_id FROM members WHERE id=?',ownerId),config=receiverConfiguration();
    if(isAdmin(owner)&&config.enabled){const connection=storeFor(config).connection(`owner:${ownerId}`);
     if(connection&&!connection.revoked&&connection.expires>now&&config.servers.includes(connection.server))ownerConnection=connection;}
   }
   const result=await tradeResults(member.id,{...query,customerProjection:{cap,symbols:scanAssets(market).slice(0,cap).map(a=>a.symbol),ownerConnection}});
   if(view==='performance')return Response.json({status:result.status,summary:result.summary,recentTrades:[],isLiveFeed:false},{headers:privateHeaders});
   if(view==='events'){
    // Legacy notifications have no retained canonical freshness/quality proof.
    // Never replay an unverified active signal through the history endpoint.
    if(p.has('after')&&!/^[a-f0-9]{32}$/.test(p.get('after')))return apiError('INVALID_REQUEST');
    return Response.json({events:[],nextCursor:p.get('after')??null,hasMore:false,baseline:!p.has('after'),notificationScope:`canonical:${member.id}:${market}`},{headers:privateHeaders});
   }
   return Response.json(result,{headers:privateHeaders});
  }catch{return apiError('PROVIDER_UNAVAILABLE');}
 };
}
