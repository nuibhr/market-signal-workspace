import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isConfigured, token } from '../../../../../membership/store.mjs';
import { OAUTH_COOKIE } from '../../../../../membership/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isConfigured()) return NextResponse.redirect(new URL('/account?auth=unavailable', request.url));
  const state = token();
  const nonce = token();
  const verifier = token();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorize = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorize.search = new URLSearchParams({ response_type: 'code', client_id: process.env.LINE_CHANNEL_ID,
    redirect_uri: process.env.LINE_REDIRECT_URI, state, scope: 'openid profile', nonce,
    code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(OAUTH_COOKIE, Buffer.from(JSON.stringify({ state, nonce, verifier, issuedAt: Date.now() })).toString('base64url'), {
    httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/api/auth/line', maxAge: 600,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
