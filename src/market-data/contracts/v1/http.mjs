import {randomUUID} from 'node:crypto';
import {API_ERROR_HTTP_STATUS} from './status-codes.mjs';
export const privateHeaders = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function apiError(code='INTERNAL_ERROR', now=Date.now()) {
  if (!Object.hasOwn(API_ERROR_HTTP_STATUS,code)) code='INTERNAL_ERROR';
  return Response.json({schemaVersion:'nugaom.api-error.v1',requestId:randomUUID(),generatedAt:new Date(now).toISOString(),
    error:{code,messageKey:`market_data.${code.toLowerCase()}`,retryable:['PROVIDER_UNAVAILABLE','RATE_LIMITED'].includes(code)}},
    {status:API_ERROR_HTTP_STATUS[code],headers:privateHeaders});
}
// Resolve identities exclusively from the trusted session implementation.
export function ownerGuard({currentMember,isOwner}) {
  return async request => {
    try {
      const member=await currentMember(request);
      return !member ? apiError('AUTHENTICATION_REQUIRED') : !isOwner(member) ? apiError('OWNER_ONLY') : null;
    } catch {return apiError('INTERNAL_ERROR');}
  };
}
