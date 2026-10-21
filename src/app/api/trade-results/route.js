import {currentMember,privateHeaders} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {rateLimit} from '../../../security/request-guard.mjs';
import {tradeResults} from '../../../monitor/results-store.mjs';
import {STRATEGIES,RESULT_STATES,RESULT_SCOPES} from '../../../monitor/results.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 const member=await currentMember();
 if(!membershipFor(member).capabilities.autoPickFeed)return Response.json({status:'membership-required',signals:[],total:0},{headers:privateHeaders});
 const p=new URL(request.url).searchParams,options={market:p.get('market')??'all',strategy:p.get('strategy')??'all',status:p.get('status')??'all',scope:p.get('scope')??'history',page:p.get('page')??1,tradeKey:p.get('trade')};
 if(!['all','thai','dr','us','forex','tfex'].includes(options.market)||!STRATEGIES.includes(options.strategy)||!RESULT_STATES.includes(options.status)||!RESULT_SCOPES.includes(options.scope)||(options.tradeKey&&(!/^(swing|legacy|daytrade):[A-Za-z0-9:_-]+$/.test(options.tradeKey)||options.tradeKey.length>200)))return Response.json({code:'INVALID_FILTER'},{status:400,headers:privateHeaders});
 const limited=await rateLimit('trade-results',member.id,90);if(limited)return limited;
 try{return Response.json(await tradeResults(member.id,options),{headers:privateHeaders});}
 catch{return Response.json({status:'unavailable',code:'RESULT_STORE_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
