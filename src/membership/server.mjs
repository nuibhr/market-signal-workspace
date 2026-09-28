import { cookies } from 'next/headers';
import { accountSummary, aiQuota, isConfigured, sessionMember } from './store.mjs';
import { membershipFor } from './rights.mjs';

export const SESSION_COOKIE = 'nugaom_session';
export const OAUTH_COOKIE = 'nugaom_line_flow';
export const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function currentMember() {
  if (!isConfigured()) return null;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionMember(value);
}
export async function currentAccount() {
  const member = await currentMember();
  return { configured: isConfigured(), account: accountSummary(member), rights: membershipFor(member), aiQuota: aiQuota(member), aiConfigured: Boolean(process.env.BIGDATA_API_KEY) };
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}
export function errorResponse(error) {
  const known = new Set(['INVALID_PORTFOLIO', 'INVALID_BROKER', 'PORTFOLIO_ALREADY_USED', 'PORTFOLIO_CHANGE_REQUIRES_ADMIN',
    'PORTFOLIO_NOT_VERIFIED', 'PORTFOLIO_MISMATCH', 'CODE_UNAVAILABLE', 'INVALID_CODE', 'REQUEST_UNAVAILABLE', 'INVALID_CREDIT_AMOUNT']);
  const raw = error instanceof Error ? error.message : '';
  const code = known.has(raw) ? raw : 'UNEXPECTED_ERROR';
  const status = code === 'UNEXPECTED_ERROR' ? 500 : 400;
  return Response.json({ error: code }, { status, headers: privateHeaders });
}
