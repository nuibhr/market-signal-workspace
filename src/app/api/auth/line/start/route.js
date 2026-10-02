import { rateLimit } from '../../../../../security/request-guard.mjs';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isConfigured, createLineFlow } from '../../../../../membership/store.mjs';
import { OAUTH_COOKIE, authBase, secureCookie } from '../../../../../membership/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isConfigured()) return NextResponse.redirect(new URL('/account?auth=unavailable', authBase(request)));
  const limited = rateLimit('line-login', 'global', 60); if (limited) return limited;
  const { value, state, nonce, verifier } = createLineFlow();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorize = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorize.search = new URLSearchParams({ response_type: 'code', client_id: process.env.LINE_CHANNEL_ID,
    redirect_uri: process.env.LINE_REDIRECT_URI, state, scope: 'openid profile', nonce,
    code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(OAUTH_COOKIE, value, {
    httpOnly: true, secure: secureCookie(request), sameSite: 'lax', path: '/api/auth/line', maxAge: 600,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
