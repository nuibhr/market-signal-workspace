// A current offset is accepted only with fresh broker ticks and repeat observations.
// This verifies the current terminal clock, not historical DST rules or broker attestation.
export function observeClock(previous, sample, now) {
  const candidate = Math.round((sample.server_seconds - sample.utc_seconds) / 900) * 15;
  const valid = Math.abs(candidate) <= 840 &&
    Math.abs(sample.server_seconds - sample.utc_seconds - candidate * 60) <= 5 &&
    sample.server_seconds - sample.last_tick_seconds >= -5 &&
    sample.server_seconds - sample.last_tick_seconds <= 20 &&
    Math.abs(sample.utc_seconds * 1000 - now) <= 15000;
  if (!valid) return { status: "unavailable", offset_minutes: null, samples: 0, last_at: now,
    history_since: previous?.history_since ?? Math.floor(now / 1000) };
  const continuing = previous?.candidate === candidate && now - previous.last_at <= 30000;
  const first_at = continuing ? previous.first_at : now;
  // Same-time retries don't count as independent samples.
  const samples = continuing ? previous.samples + (now - previous.last_at >= 4000 ? 1 : 0) : 1;
  const ready = samples >= 3 && now - first_at >= 10000;
  return { status: ready ? "ready" : "observing", candidate,
    offset_minutes: ready ? candidate : null, samples: Math.min(samples, 3), first_at, last_at: now,
    // Export only bars formed in the observed offset period. Never guess historical DST offsets.
    history_since: continuing ? previous.history_since : Math.floor(now / 1000) };
}
export function publicClock(clock, now) {
  if (!clock) return { status: "awaiting_connector", offset_minutes: null };
  return { status: now - clock.last_at > 30000 ? "unavailable" : clock.status,
    offset_minutes: now - clock.last_at > 30000 ? null : clock.offset_minutes };
}
