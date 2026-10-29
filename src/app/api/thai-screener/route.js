import {marketHandler} from '../../../market-data/contracts/v1/runtime.mjs';
import {apiError} from '../../../market-data/contracts/v1/http.mjs';
import {currentMember,sameOrigin} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=marketHandler('thai','thai');
export async function POST(request){
 if(!sameOrigin(request))return apiError('INVALID_ORIGIN');
 if(!membershipFor(await currentMember()).capabilities.autoPickFeed)return apiError('MEMBERSHIP_REQUIRED');
 return GET(request);
}
