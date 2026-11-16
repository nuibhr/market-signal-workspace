'use client';

import { useEffect } from 'react';

export default function ReferralTracker() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')?.trim();
      if (!ref || ref.length < 3 || ref.length > 24) return;
      const cacheKey = `nugaom_ref_sent_${ref.toUpperCase()}`;
      if (sessionStorage.getItem(cacheKey)) return;
      sessionStorage.setItem(cacheKey, '1');
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ref }),
      }).catch(() => {});
    } catch {}
  }, []);

  return null;
}
