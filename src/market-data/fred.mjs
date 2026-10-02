const API = 'https://api.stlouisfed.org/fred';
const RELEASES = [
  { id: 10, label: 'เงินเฟ้อ CPI', short: 'CPI' },
  { id: 50, label: 'การจ้างงานสหรัฐฯ', short: 'Jobs' },
  { id: 53, label: 'GDP สหรัฐฯ', short: 'GDP' },
  { id: 54, label: 'รายได้และการใช้จ่ายส่วนบุคคล', short: 'PCE' },
  { id: 46, label: 'ราคาผู้ผลิต PPI', short: 'PPI' },
];
const SERIES = [
  { id: 'CPIAUCSL', label: 'เงินเฟ้อ CPI เทียบปีก่อน', units: 'pc1', suffix: '%' },
  { id: 'UNRATE', label: 'อัตราว่างงาน', units: 'lin', suffix: '%' },
  { id: 'DGS10', label: 'พันธบัตรสหรัฐฯ 10 ปี', units: 'lin', suffix: '%' },
  { id: 'FEDFUNDS', label: 'อัตรา Fed Funds (effective)', units: 'lin', suffix: '%' },
];

function usDay(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function requestFred(path, params, key, fetcher) {
  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries({ ...params, api_key: key, file_type: 'json' })) url.searchParams.set(name, String(value));
  const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMITED' : response.status === 400 || response.status === 403 ? 'AUTH_FAILED' : 'SOURCE_UNAVAILABLE');
  return response.json();
}

export async function fredMacroSnapshot({ key, fetcher = fetch, now = Date.now() }) {
  if (!key) return { status: 'unconfigured', code: 'FRED_NOT_CONFIGURED', releases: [], indicators: [] };
  const today = usDay(now);
  const end = new Date(Date.parse(`${today}T12:00:00Z`) + 45 * 86_400_000).toISOString().slice(0, 10);
  const tasks = await Promise.allSettled([
    ...RELEASES.map(async release => {
      const data = await requestFred('release/dates', { release_id: release.id, include_release_dates_with_no_data: 'true', sort_order: 'desc', limit: 120 }, key, fetcher);
      if (!Array.isArray(data.release_dates)) throw new Error('INVALID_RESPONSE');
      return data.release_dates.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date >= today && row.date <= end)
        .map(row => ({ id: `${release.id}:${row.date}`, releaseId: release.id, date: row.date,
          label: release.label, short: release.short, url: `https://fred.stlouisfed.org/release?rid=${release.id}` }));
    }),
    ...SERIES.map(async series => {
      const data = await requestFred('series/observations', { series_id: series.id, units: series.units, sort_order: 'desc', limit: 8 }, key, fetcher);
      if (!Array.isArray(data.observations)) throw new Error('INVALID_RESPONSE');
      const row = data.observations.find(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.value !== '.' && Number.isFinite(Number(item.value)));
      if (!row) throw new Error('NO_OBSERVATION');
      return { id: series.id, label: series.label, value: Number(row.value), suffix: series.suffix,
        observationDate: row.date, url: `https://fred.stlouisfed.org/series/${series.id}` };
    }),
  ]);
  const releases = tasks.slice(0, RELEASES.length).flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)).slice(0, 10);
  const indicators = tasks.slice(RELEASES.length).flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const failures = tasks.filter(result => result.status === 'rejected').length;
  const status = releases.length || indicators.length ? failures ? 'partial' : 'available' : 'unavailable';
  return { status, code: status === 'unavailable' ? 'SOURCE_UNAVAILABLE' : null, source: 'FRED · Federal Reserve Bank of St. Louis',
    dateScope: 'America/New_York', receivedAt: new Date(now).toISOString(), releases, indicators, failedSources: failures,
    note: 'FRED ให้วันประกาศและค่าที่เผยแพร่แล้ว ไม่มีเวลาประกาศหรือค่า forecast ในฟีดนี้' };
}
