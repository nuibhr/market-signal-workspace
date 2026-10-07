import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../security/request-guard.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
import { researchWithBigdata } from '../../../analysis/bigdata-research.mjs';
import { currentAccount, currentMember, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { aiConversation, aiHistory, aiQuota, completeAiQuestion, latestAiConversation, releaseAiQuestion, reserveAiQuestion } from '../../../membership/store.mjs';
import { membershipFor } from '../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await currentAccount();
  const member = await currentMember();
  const conversationId = (await latestAiConversation(member));
  return Response.json({ ...state, conversationId, history: (await aiHistory(member, conversationId)) }, { headers: privateHeaders });
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  if (Number(request.headers.get('content-length') ?? 0) > 2500) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413, headers: privateHeaders });
  const member = await currentMember();
  if (!member) return Response.json({ error: 'LOGIN_REQUIRED' }, { status: 401, headers: privateHeaders });
  if (!membershipFor(member).capabilities.aiQuestions) return Response.json({ error: 'MEMBERSHIP_REQUIRED', quota: (await aiQuota(member)) }, { status: 403, headers: privateHeaders });
  if (!process.env.BIGDATA_API_KEY?.trim()) return Response.json({ error: 'BIGDATA_NOT_CONFIGURED', quota: (await aiQuota(member)) }, { status: 503, headers: privateHeaders });
  const limited = (await rateLimit('assistant', member.id, 8)); if (limited) return limited;
  let input;
  try { input = await readJsonBody(request, 2500); } catch (error) { return requestErrorResponse(error); }
  const question = typeof input?.question === 'string' ? input.question.trim() : '';
  const requestId = typeof input?.requestId === 'string' ? input.requestId : '';
  const conversationId = typeof input?.conversationId === 'string' ? input.conversationId : '';
  const selectedSymbol = typeof input?.selectedSymbol === 'string' && ALL_ASSETS.some(item => item.symbol === input.selectedSymbol) ? input.selectedSymbol : null;
  if (question.length < 3 || question.length > 700 || !/^[a-f0-9-]{36}$/i.test(requestId) || !/^[a-f0-9-]{36}$/i.test(conversationId)) {
    return Response.json({ error: 'INVALID_QUESTION' }, { status: 400, headers: privateHeaders });
  }
  let conversation;
  try { conversation = (await aiConversation(member, conversationId)); }
  catch { return Response.json({ error: 'INVALID_CONVERSATION_ID' }, { status: 400, headers: privateHeaders }); }
  let reservation;
  try { reservation = (await reserveAiQuestion(member, requestId, question, conversationId)); }
  catch (error) {
    const code = ['INSUFFICIENT_AI_CREDITS', 'QUESTION_IN_PROGRESS'].includes(error.message) ? error.message : 'INVALID_REQUEST';
    return Response.json({ error: code, quota: (await aiQuota(member)) }, { status: code === 'INSUFFICIENT_AI_CREDITS' ? 402 : code === 'QUESTION_IN_PROGRESS' ? 409 : 400, headers: privateHeaders });
  }
  if (reservation.kind === 'cached') return Response.json({ ...reservation.response, quota: reservation.quota }, { headers: privateHeaders });
  if (reservation.kind === 'pending') return Response.json({ error: 'QUESTION_IN_PROGRESS', quota: reservation.quota }, { status: 409, headers: privateHeaders });
  try {
    const result = await researchWithBigdata(question, selectedSymbol, conversation);
    const { chatId, checkpointId, ...publicResult } = result;
    const payload = { status: 'available', ...publicResult, chargeType: reservation.chargeType };
    const quota = (await completeAiQuestion(member, requestId, payload, { id: conversationId, chatId, checkpointId }, reservation.reservationToken));
    return Response.json({ ...payload, quota }, { headers: privateHeaders });
  } catch (error) {
    const quota = (await releaseAiQuestion(member, requestId, reservation.reservationToken));
    const known = new Set(['BIGDATA_AUTH_FAILED', 'BIGDATA_RATE_LIMIT', 'BIGDATA_EMPTY_RESPONSE', 'BIGDATA_UNGROUNDED', 'BIGDATA_RESPONSE_TOO_LONG']);
    const code = known.has(error?.message) ? error.message : error?.name === 'TimeoutError' ? 'BIGDATA_TIMEOUT' : 'BIGDATA_UNAVAILABLE';
    return Response.json({ error: code, quota }, { status: 503, headers: privateHeaders });
  }
}
