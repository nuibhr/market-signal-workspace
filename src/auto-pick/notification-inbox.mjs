import { ANNOUNCEMENT_TYPES } from './announcements.mjs';
const CAPACITY = 500, LEASE_MS = 120000;
export function createNotificationInbox({ scope, storage, locks, owner, now = Date.now, onPersistenceError = () => {} }) {
  if (!scope || !owner) throw Error('NOTIFICATION_SCOPE_REQUIRED');
  const key = `nugaom-signal-inbox:${scope}`;
  let memory = { version: 1, cursor: null, pending: [], history: [] };
  let durable = true;
  const read = () => {
    if (!durable) return memory;
    try {
      const raw = storage?.getItem(key);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.version !== 1 || !Array.isArray(state.pending) || !Array.isArray(state.history)) throw Error();
        memory = state;
      }
    } catch { durable = false; onPersistenceError(); }
    return memory;
  };
  const write = state => {
    // Cursor and all received events are committed in one storage write.
    // A failure retains the old durable cursor; a reload can fetch that page again.
    try {
      if (!storage) throw Error();
      storage.setItem(key, JSON.stringify(state));
      durable = true;
    } catch { durable = false; onPersistenceError(); }
    memory = state;
  };
  const act = action => {
    const work = () => action(read());
    return locks?.request ? locks.request(key, { mode: 'exclusive' }, work) : Promise.resolve(work());
  };
  const historical = event => {
    const age = now() - Date.parse(event.createdAt);
    const barAge = event.market !== 'us' && event.barTime ? now() - (event.barTime + 900) * 1000 : 0;
    return !Number.isFinite(age) || age < 0 || age >= 1800000 || barAge >= 1800000;
  };
  return {
    scope,
    async snapshot() { return act(state => ({ cursor: state.cursor, pending: state.pending.length, durable })); },
    async receive(page, expectedCursor) {
      return act(state => {
        if (expectedCursor !== undefined && state.cursor !== expectedCursor) return false;
        const known = new Set([...state.pending.map(item => item.event.id), ...state.history.map(item => item.id)]);
        const incoming = page.events.filter(event => ANNOUNCEMENT_TYPES.has(event.type) && !known.has(event.id));
        if (state.pending.length + incoming.length > CAPACITY) return false;
        write({ ...state, cursor: page.nextCursor, pending: [...state.pending, ...incoming.map(event => ({ event,
          displayedAt: null, voice: 'pending', owner: null, leaseUntil: 0 }))] });
        return true;
      });
    },
    async claim(visible = true) {
      return act(state => {
        if (!visible || !state.pending.length) return null;
        const first = state.pending[0];
        if (first.owner && first.owner !== owner && first.leaseUntil > now()) return null;
        const priority = !first.owner || first.leaseUntil <= now()
          ? state.pending.findIndex(item => item.event.type !== 'PICK_READY') : 0;
        const index = Math.max(0, priority);
        const item = { ...state.pending[index], owner, leaseUntil: now() + LEASE_MS };
        write({ ...state, pending: [item, ...state.pending.filter((_, i) => i !== index)] });
        return { ...item.event, historical: historical(item.event), deliveryVoice: item.voice };
      });
    },
    async displayed(id) {
      return act(state => {
        const first = state.pending[0];
        if (first?.event.id !== id || first.owner !== owner) return;
        write({ ...state, pending: [{ ...first, displayedAt: first.displayedAt ?? new Date(now()).toISOString() }, ...state.pending.slice(1)] });
      });
    },
    async voice(id, value) {
      return act(state => {
        const first = state.pending[0];
        if (first?.event.id !== id || first.owner !== owner) return;
        write({ ...state, pending: [{ ...first, voice: value }, ...state.pending.slice(1)] });
      });
    },
    async dismiss(id) {
      return act(state => {
        const first = state.pending[0];
        if (first?.event.id !== id || first.owner !== owner) return;
        write({ ...state, pending: state.pending.slice(1), history: [...state.history,
          { id, displayedAt: first.displayedAt, voice: first.voice, dismissedAt: new Date(now()).toISOString() }].slice(-100) });
      });
    },
    async release() {
      return act(state => write({ ...state, pending: state.pending.map(item => item.owner === owner
        ? { ...item, owner: null, leaseUntil: 0 } : item) }));
    },
    async rebase() { return act(state => write({ ...state, cursor: null })); },
  };
}
