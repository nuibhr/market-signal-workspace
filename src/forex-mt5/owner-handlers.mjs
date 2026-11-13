import {readJsonBody} from '../security/request-guard.mjs';
import {apiError} from '../market-data/contracts/v1/http.mjs';
import {createForexHandlers} from './handlers.mjs';
import {receiverConfiguration} from './runtime-policy.mjs';
import {storeFor} from './store.mjs';
// Old member/local pairing tokens never authorize this route. Service tokens are
// bound to an owner-created connection and the owner's CURRENT server role.
export function createOwnerForexHandlers({currentMember,isOwner,loadOwner,cookieStore,isLoginConfigured,env=process.env,getStore=storeFor}) {
 const inner=createForexHandlers({currentMember,cookieStore,isLoginConfigured,env,getStore,ownerPrefix:'owner',allowLocalSession:false});
 function audit(action){
  // No token, account, payload or client-supplied identity enters this log.
  try{const config=receiverConfiguration(env);if(config.enabled)getStore(config).auditAccess(action);}catch{}
 }
 async function authorize(request,method){
  try {
   if(method==='POST'&&request.headers.has('authorization')){
    const config=receiverConfiguration(env);
    if(!config.enabled)return apiError('SOURCE_NOT_CONFIGURED');
    const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if(!token){audit('invalid-service');return apiError('AUTHENTICATION_REQUIRED');}
    const id=getStore(config).serviceOwner(token);
    if(!id){audit('invalid-service');return apiError('AUTHENTICATION_REQUIRED');}
    const owner=await loadOwner(id);
    if(!owner||!isOwner(owner)){audit('role-revoked');return apiError('OWNER_ONLY');}
    let body;try{body=await readJsonBody(request.clone(),512000);}catch{return apiError('INVALID_REQUEST');}
    if(!['feed','universe'].includes(body.kind)||body.action!==undefined){audit('invalid-ingest');return apiError('FORBIDDEN');}
    return null;
   }
   const member=await currentMember(request);
   if(!member||!isOwner(member))audit('denied');
   return !member?apiError('AUTHENTICATION_REQUIRED'):!isOwner(member)?apiError('OWNER_ONLY'):null;
  }catch{return apiError('INTERNAL_ERROR');}
 }
 return Object.fromEntries(['GET','POST'].map(method=>[method,async request=>(await authorize(request,method))??inner[method](request)]));
}
