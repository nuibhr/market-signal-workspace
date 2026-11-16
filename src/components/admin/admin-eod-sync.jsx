'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, Copy, Database, RefreshCw, Upload } from 'lucide-react';

export default function AdminEodSync() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);
  const [onlyKnown, setOnlyKnown] = useState(true);
  const [maxDaysBack, setMaxDaysBack] = useState('30');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/eod-sync', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'LOAD_FAILED');
      setStatus(data);
    } catch {
      setError('โหลดสถานะฐานข้อมูลแท่งเทียน EOD ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const csvText = await file.text();
      const params = new URLSearchParams({
        onlyKnown: String(onlyKnown),
        source: 'Admin CSV Upload',
      });
      if (maxDaysBack !== 'all') params.set('maxDaysBack', maxDaysBack);
      const res = await fetch(`/api/admin/eod-sync?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: csvText,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'UPLOAD_FAILED');
      setResult(payload);
      if (payload.dbStatus) setStatus(payload.dbStatus);
      setFile(null);
    } catch (err) {
      setError(`นำเข้าไฟล์ CSV ไม่สำเร็จ (${err.message})`);
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain';
  const sampleCmd = `node scripts/office-eod-push.mjs --watch=./eod-inbox --target=${origin} --secret=$EOD_INGEST_SECRET --days=14`;

  return (
    <section className="account-card" style={{ marginTop: '18px' }}>
      <div className="admin-section-title">
        <div>
          <h2><Database size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />อัปเดตข้อมูล EOD / CSV จาก Metabase (Delta Sync)</h2>
          <p>คัดกรองแถว 0.0 และเขียนลงฐานข้อมูลเฉพาะแท่งเทียนวันใหม่ที่ยังไม่ซ้ำ เพื่อประหยัดโควตา D1</p>
        </div>
        <button type="button" className="account-secondary" onClick={loadStatus} disabled={loading}>
          <RefreshCw size={15} /> {loading ? 'กำลังโหลด' : 'รีเฟรช'}
        </button>
      </div>

      {error && <div className="account-alert error" role="alert"><CircleAlert size={16} />{error}</div>}

      {status && (
        <div className="admin-stat-grid compact" style={{ marginBottom: '16px' }}>
          <article>
            <span>หุ้น &amp; กองทุนในคลัง 1D</span>
            <strong>{status.symbolCount} / {status.catalogCount}</strong>
            <small>ครอบคลุมตาม Catalog ปัจจุบัน</small>
          </article>
          <article>
            <span>จำนวนแท่งเทียน 1D ทั้งหมด</span>
            <strong>{Number(status.totalBars || 0).toLocaleString('en-US')}</strong>
            <small>อ้างอิง EMA200 / Stage 2</small>
          </article>
          <article>
            <span>ช่วงวันที่ข้อมูลในระบบ</span>
            <strong style={{ fontSize: '15px' }}>{status.maxDay || '—'}</strong>
            <small>เริ่มต้น {status.minDay || '—'}</small>
          </article>
          <article>
            <span>Office Auto-Push Token</span>
            <strong style={{ fontSize: '15px', color: status.ingestSecretConfigured ? '#34d399' : '#fbbf24' }}>
              {status.ingestSecretConfigured ? 'พร้อมใช้งาน (≥32 ตัวอักษร)' : 'ยังไม่ตั้ง EOD_INGEST_SECRET'}
            </strong>
            <small>ใช้ยืนยันการส่งจากเครื่องสำนักงาน</small>
          </article>
        </div>
      )}

      <form onSubmit={handleUpload} className="admin-credit-form" style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '16px', borderRadius: '14px' }}>
        <label>
          เลือกไฟล์ CSV จาก Metabase (`D_TRADE,N_SECURITY,...`)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            required
          />
        </label>
        <label>
          ช่วงวันที่นำเข้าจากไฟล์
          <select value={maxDaysBack} onChange={e => setMaxDaysBack(e.target.value)}>
            <option value="14">เฉพาะ 14 วันล่าสุด (เร็วสุด)</option>
            <option value="30">เฉพาะ 30 วันล่าสุด</option>
            <option value="90">เฉพาะ 90 วันล่าสุด</option>
            <option value="all">ทุกวันในไฟล์ (เทียบซ้ำอัตโนมัติ)</option>
          </select>
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" style={{ width: '16px', minHeight: '16px' }} checked={onlyKnown} onChange={e => setOnlyKnown(e.target.checked)} />
          <span>อัปเดตเฉพาะ 227 หุ้น &amp; กองทุนใน Catalog (≥฿2 · ≥5M/วัน)</span>
        </label>
        <button type="submit" className="account-primary" disabled={!file || busy}>
          <Upload size={15} /> {busy ? 'กำลังอัปเดตข้อมูล…' : 'อัปเดตแท่งเทียนเฉพาะวันที่ใหม่'}
        </button>
      </form>

      {result && (
        <div className="account-alert success" role="status" style={{ marginTop: '12px' }}>
          <Check size={16} />
          <span>
            ซิงก์สำเร็จ ({result.source}): อ่าน {result.totalInputRows?.toLocaleString('en-US')} แถว ·
            อัปเดตใหม่ <b style={{ color: '#34d399' }}>{result.writtenBars}</b> แท่ง ({result.symbolsUpdated} ตัว) ·
            ข้ามข้อมูลซ้ำ {result.unchangedBars} แท่ง · ตัดแถว 0.0 ออก {result.skippedInvalidRows} แถว
            {result.latestUpdatedDay ? ` · ล่าสุด ${result.latestUpdatedDay}` : ''}
          </span>
        </div>
      )}

      <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.1)', fontSize: '12px', color: '#cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <strong style={{ color: '#7dd3fc' }}>คำสั่งสำหรับตั้ง Auto-Push บนเครื่องสำนักงาน (IP ตรง Metabase):</strong>
          <button
            type="button"
            className="account-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => {
              navigator.clipboard?.writeText(sampleCmd);
              setCopiedCmd(true);
              setTimeout(() => setCopiedCmd(false), 2000);
            }}
          >
            {copiedCmd ? <Check size={13} /> : <Copy size={13} />} {copiedCmd ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่ง'}
          </button>
        </div>
        <code style={{ display: 'block', wordBreak: 'break-all', color: '#e2e8f0' }}>{sampleCmd}</code>
      </div>
    </section>
  );
}
