// Retain one request ID in memory until its answer is confirmed. A disconnected
// browser cannot infer whether the server completed and charged the question.
export async function sendAssistantQuestion(body, { fetcher = globalThis.fetch, timeoutMs = 135_000 } = {}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => {
    controller.abort(); resolve({ status: 'pending', error: 'CONFIRMATION_UNAVAILABLE' });
  }, timeoutMs); });
  const request = (async () => {
    try {
      const response = await fetcher('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        cache: 'no-store', signal: controller.signal, body: JSON.stringify(body) });
      const payload = await response.json();
      if (response.ok && payload?.status === 'available' && typeof payload.answer === 'string' && payload.answer.trim())
        return { status: 'confirmed', payload };
      const error = typeof payload?.error === 'string' ? payload.error : 'CONFIRMATION_UNAVAILABLE';
      // A documented provider failure with a quota response is sent after release.
      const released = response.status === 503 && payload?.quota &&
        ['BIGDATA_AUTH_FAILED', 'BIGDATA_RATE_LIMIT', 'BIGDATA_EMPTY_RESPONSE', 'BIGDATA_UNGROUNDED',
          'BIGDATA_RESPONSE_TOO_LONG', 'BIGDATA_INCOMPLETE_RESPONSE', 'BIGDATA_TIMEOUT', 'BIGDATA_UNAVAILABLE'].includes(error);
      if (error === 'AI_QUOTA_EXHAUSTED' && payload?.quota) return {status:'rejected',error,quota:payload.quota};
      if (released || response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status))
        return { status: 'rejected', error, quota: payload?.quota };
      return { status: 'pending', error, quota: payload?.quota };
    } catch { return { status: 'pending', error: 'CONFIRMATION_UNAVAILABLE' }; }
  })();
  try { return await Promise.race([timeout, request]); } finally { clearTimeout(timer); }
}

export function createAssistantWriter({ makeId = () => crypto.randomUUID(), onChange = () => {}, onStarted = () => {}, onConfirmed = () => {}, ...transport } = {}) {
  let pending = null, state = { busy: false, pending: false, error: '', quota: null };
  const update = next => { state = { ...state, ...next }; onChange({ ...state }); };
  async function attempt(body) {
    const wasPending = state.pending;
    update({ busy: true, error: '' });
    const outcome = await sendAssistantQuestion(body, transport);
    if (outcome.status === 'confirmed') {
      pending = null;
      update({ busy: false, pending: false, error: '', quota: outcome.payload.quota });
      onConfirmed(outcome.payload, body);
    } else {
      // A later expired login/permission error cannot disprove a prior completion.
      const keep = wasPending || outcome.status === 'pending';
      if (!keep) pending = null;
      update({ busy: false, pending: keep, error: outcome.error, quota: outcome.quota ?? null });
    }
    return outcome;
  }
  return {
    write(input) {
      if (state.busy || pending) return Promise.resolve({ status: 'ignored' });
      pending = { ...input, requestId: makeId() };
      onStarted(pending);
      return attempt(pending);
    },
    retry() {
      if (state.busy || !pending) return Promise.resolve({ status: 'ignored' });
      return attempt(pending);
    },
    snapshot: () => ({ ...state }),
  };
}
