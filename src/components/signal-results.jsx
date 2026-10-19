'use client';
import SignalPerformance from './signal-performance.jsx';
import { recordedOutcome } from '../auto-pick/signal-performance.mjs';
import { Fragment, useEffect, useState } from 'react';
import { Activity, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Copy, ExternalLink, Layers, Sparkles, TrendingUp, X, Zap } from 'lucide-react';

const MARKETS = [
  ['all', 'ทุกตลาด'],
  ['thai', 'หุ้นไทย (SET/mai)'],
  ['dr', 'DR80 เทคโนโลยี'],
  ['us', 'หุ้นสหรัฐฯ (US Equity)'],
  ['tfex', 'TFEX (S50)'],
  ['forex', 'Forex & Gold'],
];

const STRATEGIES = [
  { id: 'all', label: 'ทุกระบบสัญญาณ', icon: Layers, desc: 'แสดงสัญญาณและประวัติผลงานรวมจากทุกโมเดล' },
  { id: 'swing', label: 'Swing Standard (4H/1D)', icon: TrendingUp, desc: 'รอบสวิง 2-5 วัน · โครงสร้างแนวโน้ม D1/4H · TP1 2R สุทธิ + Breakeven Runner' },
  { id: 'orb', label: '15m ORB เปิดตลาด', icon: Zap, desc: 'Opening Range Breakout · กรอบ 30 นาทีแรก + ปิดเหนือ VWAP (หุ้นไทย & DR80)' },
  { id: 'eod', label: 'US EOD ปิดวัน', icon: CalendarDays, desc: 'สแกนแท่งปิดวันหลังตลาดสหรัฐฯ ปิด · คัด Breakout และ Volume สะสม 500 ตัว' },
  { id: 'scalp', label: 'Scalping CFD', icon: Activity, desc: 'แผนเดย์เทรดจบในวันบน Vantage CFD · กรอบสั้น 15m' },
];

const STATUSES = [
  ['all', 'ทุกสถานะ'],
  ['WAITING_FOR_ENTRY', 'รอเข้า'],
  ['OPEN', 'เข้าแล้ว'],
  ['TARGET', 'ถึงเป้า'],
  ['STOP', 'ตัดขาดทุน'],
  ['EXIT', 'ปิดตามกติกา'],
  ['EXPIRED', 'ไม่เข้า'],
  ['REVIEW', 'ข้อมูลขาด'],
  ['AMBIGUOUS', 'ตรวจผล'],
];

const STATUS_LABEL = {
  WAITING_FOR_ENTRY: 'รอจุดเข้า',
  OPEN: 'เข้าแล้ว',
  TARGET: 'ถึงเป้า',
  STOP: 'ตัดขาดทุน',
  EXIT: 'ปิดตามกติกา',
  EXPIRED: 'หมดเวลารอ',
  REVIEW: 'ตรวจข้อมูล',
  AMBIGUOUS: 'ตรวจผล',
};

const EVENT_LABEL = {
  PICK_READY: 'พบแผน',
  ENTRY: 'ยืนยันเข้า',
  TARGET: 'ถึงเป้า',
  STOP: 'แตะจุดตัดขาดทุน',
  EXIT: 'ออกตามกติกา',
  EXPIRED: 'หมดเวลารอ',
  ENTRY_SKIPPED: 'ข้ามจุดเข้า',
  DATA_GAP: 'ข้อมูลขาดช่วง',
  AMBIGUOUS: 'ต้องตรวจลำดับราคา',
  SESSION_END: 'จบรอบติดตาม',
};

const at = value => {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', {
    timeZone: dateOnly ? 'UTC' : 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
  });
};

const eventTime = event =>
  event.barDay
    ? `แท่งวัน ${at(event.barDay)}`
    : Number.isFinite(event.barTime)
    ? `แท่งเริ่ม ${at(new Date(event.barTime * 1000).toISOString())}`
    : `บันทึก ${at(event.createdAt)}`;

const price = (value, market) =>
  Number.isFinite(value)
    ? `${market === 'us' ? '$' : ''}${value.toLocaleString('en-US', {
        maximumFractionDigits: value < 1 ? 5 : 2,
      })}`
    : '—';

const percent = value =>
  Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';

function getSignalTag(row) {
  const setup = row.plan?.setupType || '';
  if (setup.includes('ORB') || row.market === 'thai' || row.market === 'dr') {
    return { label: '15m ORB', className: 'tag-orb' };
  }
  if (setup.includes('EOD') || row.market === 'us') {
    return { label: 'US EOD', className: 'tag-eod' };
  }
  if (setup.includes('SWING') || setup.includes('PULLBACK')) {
    return { label: 'Swing 4H', className: 'tag-swing' };
  }
  return { label: 'Daytrade', className: 'tag-daytrade' };
}

export default function SignalResults({
  onSelect,
  loginHref = '/account',
  fixedMarket = null,
  sectionId = 'section-results',
  isModal = false,
  onClose = null,
}) {
  const [strategy, setStrategy] = useState('all');
  const [market, setMarket] = useState(fixedMarket ?? 'all');
  const [status, setStatus] = useState('all');
  const [scope, setScope] = useState('closed');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const queryParams = new URLSearchParams({
          market,
          status,
          scope,
          strategy,
          page: String(page),
        });
        const response = await fetch(`/api/auto-pick/results?${queryParams.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setData(payload);
          setError(!response.ok);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        loading = false;
      }
    }
    setData(null);
    setError(false);
    setExpanded(null);
    setCopied(false);
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [market, status, scope, strategy, page, revision]);

  const summary = data?.summary;
  const rows = data?.signals ?? [];
  const closed = summary?.closed ?? 0;
  const currentStrategyObj = STRATEGIES.find(s => s.id === strategy) || STRATEGIES[0];

  async function copyActualResults() {
    const text = `Nugaom AI Pick · ผลสัญญาณ 100 ไม้ที่ปิดล่าสุด\nระบบ/สไตล์: ${currentStrategyObj.label}\nตลาด: ${
      MARKETS.find(([id]) => id === market)?.[1]
    }\nช่วงปิดผล ${summary.from ? at(summary.from) : '—'} – ${
      summary.to ? at(summary.to) : '—'
    }\nมีผลบันทึก ${summary.closed}/100 ไม้ · ชนะ ${summary.wins} · แพ้ ${summary.losses} · เสมอ ${
      summary.flat
    }\nอัตราชนะ ${closed ? `${summary.winRate.toFixed(1)}%` : 'ยังไม่มีผลปิด'} · ผลเฉลี่ยต่อไม้ ${percent(
      summary.averageReturnPercent
    )}\nราคาอ้างอิงจากแท่งที่ระบบตรวจพบ ก่อนค่าธรรมเนียมและสลิปเพจ · ไม่ใช่ผลซื้อขายลูกค้า`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      id={sectionId}
      className={`performance-section signal-results ${isModal ? 'is-modal-view' : ''}`}
      aria-labelledby="signal-results-title"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">VERIFIED FORWARD LEDGER</div>
          <h2 id="signal-results-title">ประวัติ &amp; ผลงานสัญญาณแยกตามกลยุทธ์</h2>
          <p>
            ราคาเข้าและออกอ้างอิงจากแท่งราคาที่ระบบตรวจพบจริง · บันทึกแบบ Immutable ไม่สร้างผลย้อนหลัง (No Synthetic Wins)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="results-refresh" onClick={() => setRevision(value => value + 1)}>
            โหลดล่าสุด ↻
          </button>
          {isModal && onClose && (
            <button className="modal-close" onClick={onClose} aria-label="ปิดหน้าต่าง">
              ×
            </button>
          )}
        </div>
      </div>

      {/* STRATEGY SELECTOR TABS */}
      <div className="ng-strategy-tabs-bar" role="tablist" aria-label="เลือกสไตล์สัญญาณเพื่อดูประวัติ">
        {STRATEGIES.map(item => {
          const Icon = item.icon;
          const active = strategy === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              className={`ng-strategy-tab-btn ${active ? 'is-active' : ''}`}
              onClick={() => {
                setStrategy(item.id);
                setPage(1);
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Strategy Detail Banner */}
      <div className="ng-strategy-desc-banner">
        <Sparkles size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
        <div>
          <strong>{currentStrategyObj.label}</strong>: {currentStrategyObj.desc}
        </div>
      </div>

      {error && <div className="results-message" role="status">อ่านประวัติสัญญาณไม่ได้ กรุณาลองโหลดใหม่</div>}
      {!data && !error && <div className="results-message" role="status">กำลังอ่านผลสัญญาณ…</div>}

      {data?.status === 'membership-required' && (
        <div className="results-message">
          <strong>ผลสัญญาณสำหรับสมาชิก</strong>
          <p>เข้าสู่ระบบ LINE เพื่อดูราคาเข้า ราคาออก แผน Stop Loss / Take Profit และผลย้อนหลังครบ 100 ไม้</p>
          <a href={loginHref} className="feature-primary" style={{ display: 'inline-block', marginTop: '10px' }}>
            เข้าสู่ระบบ LINE / รับสิทธิทดลอง 14 วัน ↗
          </a>
        </div>
      )}

      {data?.status === 'available' && (
        <>
          <p className="results-period">
            สรุป 100 ไม้ที่ปิดล่าสุด ({currentStrategyObj.label}) · มีบันทึก {closed} ไม้ ·{' '}
            {summary.from ? at(summary.from) : 'ยังไม่มีผลปิด'}
            {summary.to ? ` – ${at(summary.to)}` : ''}
          </p>

          <div className="stats-grid">
            <article className="panel stat-card">
              <span className="stat-label">ชนะ / แพ้</span>
              <strong className="stat-value">
                {summary.wins} / {summary.losses}
              </strong>
              <span className="stat-note">รวมการออกตามกติกาที่มีกำไรหรือขาดทุน</span>
            </article>

            <article className="panel stat-card">
              <span className="stat-label">เข้าและปิดผลแล้ว</span>
              <strong className="stat-value">{closed}</strong>
              <span className="stat-note">
                ชนะ {summary.wins} · แพ้ {summary.losses} · เสมอ {summary.flat}
              </span>
            </article>

            <article className="panel stat-card">
              <span className="stat-label">อัตราชนะจากไม้ปิด</span>
              <strong className="stat-value accent">{closed ? `${summary.winRate.toFixed(1)}%` : '—'}</strong>
              <span className="stat-note">
                {closed ? `อ้างอิง ${closed} ไม้ที่มีผลปิดสมบูรณ์` : 'ยังไม่มีไม้ที่เข้าและปิดผล'}
              </span>
            </article>

            <article className="panel stat-card">
              <span className="stat-label">ผลเฉลี่ยต่อไม้</span>
              <strong className={`stat-value ${summary.averageReturnPercent < 0 ? 'negative' : ''}`}>
                {percent(summary.averageReturnPercent)}
              </strong>
              <span className="stat-note">
                {Number.isFinite(summary.averageR)
                  ? `${summary.averageR.toFixed(2)}R เฉลี่ย`
                  : 'ยังไม่มีระยะความเสี่ยงที่คำนวณ R ได้'}{' '}
                · ก่อนค่าใช้จ่าย
              </span>
            </article>
          </div>

          <div className="results-share">
            <button className="results-refresh" disabled={!closed} onClick={copyActualResults}>
              {copied ? 'คัดลอกผลงานแล้ว ✓' : 'คัดลอกผลงานไปแชร์'}
            </button>
          </div>

          <SignalPerformance summary={summary} trades={data.recentTrades} onSelect={onSelect} />

          <div className="panel history-panel">
            <div className="history-heading">
              <div>
                <h2>รายการสัญญาณจากระบบ ({currentStrategyObj.label})</h2>
                <p>
                  หน้าละ 7 รายการ · เข้าแล้วทั้งหมด {summary.entered} · เปิดอยู่ {data.counts?.OPEN ?? 0} · รอเข้า{' '}
                  {data.counts?.WAITING_FOR_ENTRY ?? 0}
                </p>
              </div>
              <div className="results-filters">
                <select
                  hidden={Boolean(fixedMarket)}
                  value={market}
                  aria-label="เลือกตลาด"
                  onChange={event => {
                    setMarket(event.target.value);
                    setPage(1);
                    setCopied(false);
                  }}
                >
                  {MARKETS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={status}
                  aria-label="เลือกสถานะ"
                  onChange={event => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  {STATUSES.filter(
                    ([id]) => scope === 'history' || ['all', 'TARGET', 'STOP', 'EXIT'].includes(id)
                  ).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="results-scope" aria-label="ชุดประวัติสัญญาณ">
              {[
                ['closed', '100 ไม้ที่ปิดล่าสุด'],
                ['history', 'ประวัติทั้งหมด / รอเข้า'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={scope === id}
                  onClick={() => {
                    setScope(id);
                    setStatus('all');
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>กลยุทธ์</th>
                    <th>สถานะ</th>
                    <th>สินทรัพย์</th>
                    <th>แผนรอเข้า</th>
                    <th>ราคาเข้า</th>
                    <th>ราคาออก</th>
                    <th>ผลอ้างอิง</th>
                    <th>เข้า / ออก</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const outcome = recordedOutcome(row);
                    const complete = outcome !== null;
                    const change = outcome?.returnPercent ?? null;
                    const rMultiple = outcome?.rMultiple ?? null;
                    const tag = getSignalTag(row);

                    return (
                      <Fragment key={row.id}>
                        <tr>
                          <td>
                            <span className={`ng-mini-tag ${tag.className}`}>{tag.label}</span>
                          </td>
                          <td>
                            <span
                              className={`result-pill ${
                                complete
                                  ? change > 0
                                    ? 'win'
                                    : change < 0
                                    ? 'loss'
                                    : 'pending'
                                  : 'pending'
                              }`}
                            >
                              <i />
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                          </td>
                          <td>
                            <button className="results-symbol" onClick={() => onSelect(row.symbol)}>
                              {row.symbol} ↗
                            </button>
                            <span className="asset-market">
                              {MARKETS.find(([id]) => id === row.market)?.[1] ?? row.market}
                            </span>
                            <button
                              className="results-events-toggle"
                              aria-expanded={expanded === row.id}
                              onClick={() => setExpanded(current => (current === row.id ? null : row.id))}
                            >
                              {expanded === row.id ? 'ซ่อนเหตุการณ์' : `เหตุการณ์ ${row.events?.length ?? 0} ครั้ง`}
                            </button>
                          </td>
                          <td data-label="แผนรอเข้า">{price(row.plan?.entry, row.market)}</td>
                          <td data-label="ราคาเข้า">{price(row.entryPrice, row.market)}</td>
                          <td data-label="ราคาออก">{price(row.exitPrice, row.market)}</td>
                          <td
                            data-label="ผลอ้างอิง"
                            className={complete ? (change > 0 ? 'positive' : change < 0 ? 'negative' : '') : 'muted-cell'}
                          >
                            {complete ? (
                              <>
                                {percent(change)}
                                {Number.isFinite(rMultiple) && (
                                  <small className="results-source">{rMultiple.toFixed(2)}R</small>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td data-label="เข้า / ออก" className="muted-cell">
                            {at(row.enteredAt)} / {at(row.exitedAt)}
                          </td>
                        </tr>
                        {expanded === row.id && (
                          <tr className="results-events-row">
                            <td colSpan={8}>
                              <div className="results-events">
                                <strong>เส้นทางสัญญาณ · {row.symbol}</strong>
                                <span>เผยแพร่ {at(row.publishedAt)}</span>
                                {row.events?.length ? (
                                  <ol>
                                    {row.events.map((event, index) => (
                                      <li key={`${event.type}-${event.createdAt}-${index}`}>
                                        <b>{EVENT_LABEL[event.type] ?? event.type}</b>
                                        <span>
                                          {eventTime(event)} · ราคาอ้างอิง {price(event.price, row.market)}
                                        </span>
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p>ยังไม่มีเหตุการณ์บันทึกสำหรับสัญญาณนี้</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div className="results-message">ยังไม่มีสัญญาณในตัวกรองนี้</div>}
            </div>

            <div className="history-footnote results-footer">
              <span>
                พบ {data.total} สัญญาณ · หน้า {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))} ·
                คำนวณจากราคาอ้างอิงก่อนค่าธรรมเนียมและสลิปเพจ
              </span>
              <div>
                <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>
                  ก่อนหน้า
                </button>
                <button
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage(value => value + 1)}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
