import { storage } from '../storage/database.mjs';
import { customerEvent } from './customer-view.mjs';

// Immutable event IDs are cursors. Resolve their current row order in this database,
// so a SQLite -> D1 import need not preserve the original SQLite rowid numbers.
export async function signalEventPage({ after = null, limit = 50 } = {}) {
  const size = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));
  const latest = await storage.first('SELECT id FROM auto_pick_events ORDER BY created_at DESC,rowid DESC LIMIT 1');
  if (!after) return { events: [], nextCursor: latest?.id ?? null, hasMore: false, baseline: true };
  if (!/^[a-f0-9]{32}$/.test(after)) throw Object.assign(new Error('INVALID_EVENT_CURSOR'), { code: 'INVALID_EVENT_CURSOR' });
  const anchor = await storage.first('SELECT rowid AS sequence,created_at AS at FROM auto_pick_events WHERE id=?', after);
  if (!anchor) throw Object.assign(new Error('EVENT_CURSOR_UNAVAILABLE'), { code: 'EVENT_CURSOR_UNAVAILABLE' });
  const rows = await storage.all(`SELECT e.id,e.pick_id AS pickId,e.event_type AS type,e.bar_time AS barTime,e.bar_day AS barDay,
    e.price,e.created_at AS createdAt,s.market,s.symbol,s.plan_json AS planJson
    FROM auto_pick_events e JOIN auto_pick_signals s ON s.id=e.pick_id
    WHERE e.created_at>? OR (e.created_at=? AND e.rowid>?)
    ORDER BY e.created_at ASC,e.rowid ASC LIMIT ?`, anchor.at, anchor.at, anchor.sequence, size + 1);
  const selected = rows.slice(0, size);
  return { events: selected.map(({ planJson, ...row }) => {
    const plan = JSON.parse(planJson);
    return customerEvent({ ...row, entryCeiling: plan?.features?.maxChase ?? null, stopLoss: plan?.stopLoss ?? null,
      tp1: plan?.tp1 ?? null, session: plan?.features?.session ?? null });
  }), nextCursor: selected.at(-1)?.id ?? after, hasMore: rows.length > size, baseline: false };
}
