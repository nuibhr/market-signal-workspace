import {marketHandler} from '../../../../market-data/contracts/v1/runtime.mjs';
import {apiError} from '../../../../market-data/contracts/v1/http.mjs';
import {currentMember,sameOrigin} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 const market=new URL(request.url).searchParams.get('market')??'dr';
 if(!['thai','dr'].includes(market))return apiError('INVALID_MARKET');
 return marketHandler(market,'radar')(request);
}
export async function POST(request){
 if(!sameOrigin(request))return apiError('INVALID_ORIGIN');
 if(!membershipFor(await currentMember()).capabilities.manualDailyScan)return apiError('MEMBERSHIP_REQUIRED');
 return GET(request);
}
