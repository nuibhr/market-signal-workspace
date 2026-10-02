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
  try { return Boolean(origin && origin === authBase(request)); } catch { return false; }
}
export function errorResponse(error) {
  const known = new Set(['INVALID_PORTFOLIO', 'INVALID_BROKER', 'PORTFOLIO_ALREADY_USED', 'PORTFOLIO_CHANGE_REQUIRES_ADMIN',
    'PAYLOAD_TOO_LARGE', 'INVALID_JSON', 'CONTENT_TYPE_REQUIRED', 'PORTFOLIO_NOT_VERIFIED', 'PORTFOLIO_MISMATCH', 'CODE_UNAVAILABLE', 'INVALID_CODE', 'REQUEST_UNAVAILABLE', 'INVALID_CREDIT_AMOUNT']);
  const raw = error instanceof Error ? error.message : '';
  const code = known.has(raw) ? raw : 'UNEXPECTED_ERROR';
  const status = code === 'UNEXPECTED_ERROR' ? 500 : code === 'PAYLOAD_TOO_LARGE' ? 413 : code === 'CONTENT_TYPE_REQUIRED' ? 415 : 400;
  return Response.json({ error: code }, { status, headers: privateHeaders });
}

export function authBase(request) {
  const value = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? process.env.LINE_REDIRECT_URI : null) || request.url;
  try { return new URL(value).origin; } catch { return new URL(request.url).origin; }
}
export function secureCookie(request) { return process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:'; }
