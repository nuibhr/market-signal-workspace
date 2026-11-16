import {billingSummary} from '../billing/store.mjs';
import { cookies } from 'next/headers.js';
import { accountSummary, aiQuota, isConfigured, sessionMember, trialEnrollment } from './store.mjs';
import { membershipFor } from './rights.mjs';
import {DEMO_COOKIE,DEMO_ROLES,demoEnabled} from './demo-policy.mjs';

export const SESSION_COOKIE = 'nugaom_session';
export const OAUTH_COOKIE = 'nugaom_line_flow';
export const privateHeaders = { 'Cache-Control': 'private, no-store' };

function parseCookieHeader(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try { out[key] = decodeURIComponent(val); } catch { out[key] = val; }
  }
  return out;
}

export async function currentMember(request) {
  let demoVal = null;
  let sessionVal = null;
  try {
    const jar = await cookies();
    demoVal = jar.get(DEMO_COOKIE)?.value;
    sessionVal = jar.get(SESSION_COOKIE)?.value;
  } catch {
    if (!request?.headers) return null;
    const parsed = parseCookieHeader(request.headers.get('cookie'));
    demoVal = parsed[DEMO_COOKIE] ?? null;
    sessionVal = parsed[SESSION_COOKIE] ?? null;
  }
  if (demoEnabled() && demoVal) {
    const demo = await sessionMember(demoVal);
    if (demo?.demo) return demo;
  }
  if (!sessionVal) return null;
  return sessionMember(sessionVal);
}
export async function currentAccount() {
  const member = await currentMember();
  return { trialEnrollment: trialEnrollment(member), configured: isConfigured(), demoEnabled:demoEnabled(), demoRoles:demoEnabled()?DEMO_ROLES:[], account: (await accountSummary(member)), rights: membershipFor(member), aiQuota: (await aiQuota(member)), aiConfigured: Boolean(process.env.BIGDATA_API_KEY?.trim()), billing:await billingSummary(member) };
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  try { return Boolean(origin && origin === authBase(request)); } catch { return false; }
}
export function errorResponse(error) {
  const known = new Set(['INVALID_PORTFOLIO', 'INVALID_BROKER', 'PORTFOLIO_ALREADY_USED', 'PORTFOLIO_CHANGE_REQUIRES_ADMIN',
    'PAYLOAD_TOO_LARGE', 'INVALID_JSON', 'CONTENT_TYPE_REQUIRED', 'PORTFOLIO_NOT_VERIFIED', 'PORTFOLIO_MISMATCH', 'CODE_UNAVAILABLE', 'INVALID_CODE', 'REQUEST_UNAVAILABLE', 'INVALID_CREDIT_AMOUNT', 'INVALID_REQUEST_ID', 'INVALID_NOTE', 'FORBIDDEN', 'TRIAL_ENROLLMENT_CLOSED', 'TRIAL_ALREADY_USED', 'TRIAL_NOT_AVAILABLE']);
  const raw = error instanceof Error ? error.message : '';
  const code = known.has(raw) ? raw : 'UNEXPECTED_ERROR';
  const status = code === 'UNEXPECTED_ERROR' ? 500 : code === 'FORBIDDEN' ? 403 : code === 'PAYLOAD_TOO_LARGE' ? 413 : code === 'CONTENT_TYPE_REQUIRED' ? 415 : 400;
  return Response.json({ error: code }, { status, headers: privateHeaders });
}

export function authBase(request) {
  const value = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? process.env.LINE_REDIRECT_URI : null) || request.url;
  try { return new URL(value).origin; } catch { return new URL(request.url).origin; }
}
export function secureCookie(request) { return process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:'; }
