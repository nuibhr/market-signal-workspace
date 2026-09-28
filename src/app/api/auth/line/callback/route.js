import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSession, isConfigured, upsertLineMember } from '../../../../../membership/store.mjs';
import { OAUTH_COOKIE, SESSION_COOKIE } from '../../../../../membership/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function equal(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}
function accountRedirect(request, status) {
  const response = NextResponse.redirect(new URL(`/account?auth=${status}`, request.url));
  response.cookies.set(OAUTH_COOKIE, '', { path: '/api/auth/line', maxAge: 0 });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export async function GET(request) {
  if (!isConfigured()) return accountRedirect(request, 'unavailable');
  const params = new URL(request.url).searchParams;
  if (params.get('error')) return accountRedirect(request, 'cancelled');
  const raw = request.cookies.get(OAUTH_COOKIE)?.value;
  let flow;
  try { flow = JSON.parse(Buffer.from(raw || '', 'base64url').toString('utf8')); } catch { return accountRedirect(request, 'failed'); }
  if (!flow || !equal(params.get('state'), flow.state) || !flow.verifier || !flow.nonce || Date.now() - flow.issuedAt > 600_000 || !params.get('code')) {
    return accountRedirect(request, 'failed');
  }
  try {
    const exchange = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
      body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: process.env.LINE_REDIRECT_URI,
        client_id: process.env.LINE_CHANNEL_ID, client_secret: process.env.LINE_CHANNEL_SECRET, code_verifier: flow.verifier }),
    });
    if (!exchange.ok) return accountRedirect(request, 'failed');
    const tokens = await exchange.json();
    if (!tokens.id_token) return accountRedirect(request, 'failed');
    const verified = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
      body: new URLSearchParams({ id_token: tokens.id_token, client_id: process.env.LINE_CHANNEL_ID, nonce: flow.nonce }),
    });
    if (!verified.ok) return accountRedirect(request, 'failed');
    const identity = await verified.json();
    if (!identity.sub || identity.iss !== 'https://access.line.me' || identity.aud !== process.env.LINE_CHANNEL_ID) return accountRedirect(request, 'failed');
    const member = upsertLineMember({ lineId: identity.sub, displayName: identity.name || 'สมาชิก LINE', pictureUrl: identity.picture });
    const session = createSession(member.id);
    const response = accountRedirect(request, 'ok');
    response.cookies.set(SESSION_COOKIE, session.value, { httpOnly: true, secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax', path: '/', expires: new Date(session.expiresAt) });
    return response;
  } catch { return accountRedirect(request, 'failed'); }
}
