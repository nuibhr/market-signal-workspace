'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, Copy, Gift, Link2, RefreshCw, Share2, UserPlus, Wallet } from 'lucide-react';

const thb = v => `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ฿`;
const dt = v => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—');

export default function AdminAffiliates() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [code, setCode] = useState('');
  const [ratePct, setRatePct] = useState('30');
  const [payoutNote, setPayoutNote] = useState('');
  const [manualMemberId, setManualMemberId] = useState('');
  const [manualGross, setManualGross] = useState('399');
  const [manualPlan, setManualPlan] = useState('pro');
  const [manualNote, setManualNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/affiliates', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'LOAD_FAILED');
      setData(json);
    } catch {
      setError('โหลดข้อมูล Affiliate ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitAction(body, okText) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ACTION_FAILED');
      setData(json);
      setMessage(okText);
    } catch (err) {
      setError(`ทำรายการไม่สำเร็จ (${err.message})`);
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.nugaom.com';
  const myCode = data?.myPartner?.code;
  const myRefLink = myCode ? `${origin}/?ref=${myCode}` : '';

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <section className="account-card">
        <div className="admin-section-title">
          <div>
            <h2><Gift size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />ระบบพาร์ทเนอร์ Affiliate (ส่วนแบ่งค่าแนะนำ 30%)</h2>
            <p>แชร์ลิงก์ให้ลูกค้ากดเข้าเว็บ ล็อกอิน LINE และสมัครแพ็กเกจ (BASIC / PRO VIP) รับค่าคอมมิชชั่น 30% อัตโนมัติทุกบิล</p>
          </div>
          <button type="button" className="account-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'กำลังโหลด' : 'รีเฟรช'}
          </button>
        </div>

        {error && <div className="account-alert error" role="alert"><CircleAlert size={16} />{error}</div>}
        {message && <div className="account-alert success" role="status"><Check size={16} />{message}</div>}

        {myPartnerBox(myCode, myRefLink, data?.myPartner?.commission_rate_pct ?? 30, copiedLink, () => {
          navigator.clipboard?.writeText(myRefLink);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
        })}

        {data?.summary && (
          <div className="admin-stat-grid" style={{ marginTop: '16px' }}>
            <article>
              <span>ลูกค้าที่ชวนเข้ามาทั้งหมด</span>
              <strong>{data.summary.referredTotal} ราย</strong>
              <small>กดผ่านลิงก์ ?ref= ของทีม</small>
            </article>
            <article>
              <span>ลูกค้ากด Subscribe สำเร็จ</span>
              <strong style={{ color: '#38bdf8' }}>{data.summary.activeSubscribers} ราย</strong>
              <small>ยอดขายรวม {thb(data.summary.totalGrossThb)}</small>
            </article>
            <article>
              <span>ค่าคอม 30% รอโอนจ่าย</span>
              <strong style={{ color: '#fbbf24' }}>{thb(data.summary.pendingCommissionThb)}</strong>
              <small>คำนวณจากบิล Stripe / Manual</small>
            </article>
            <article>
              <span>ค่าคอม 30% โอนจ่ายแล้ว</span>
              <strong style={{ color: '#34d399' }}>{thb(data.summary.paidCommissionThb)}</strong>
              <small>{data.isSuper ? `พาร์ทเนอร์ ${data.summary.partnerCount} คน` : 'ยอดสะสมที่จ่ายแล้ว'}</small>
            </article>
          </div>
        )}
      </section>

      {data?.isSuper && (
        <section className="account-card">
          <div className="admin-section-title">
            <div>
              <h2><UserPlus size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />แต่งตั้งแอดมิน / พาร์ทเนอร์แนะนำลูกค้า (30%)</h2>
              <p>เลือกสมาชิก LINE เพื่อสร้างหรือแก้รหัส ?ref=CODE สำหรับนำไปแชร์ชวนลูกค้า</p>
            </div>
          </div>

          <form
            className="admin-credit-form"
            onSubmit={async event => {
              event.preventDefault();
              await submitAction(
                { action: 'create-partner', memberId, code, commissionRatePct: Number(ratePct) || 30, status: 'active', payoutNote },
                `ตั้งค่าพาร์ทเนอร์รหัส ${code.toUpperCase()} (${ratePct}%) สำเร็จ`
              );
              setCode('');
              setPayoutNote('');
            }}
          >
            <label>
              เลือกบัญชีสมาชิก / แอดมิน
              <select value={memberId} onChange={e => setMemberId(e.target.value)} required>
                <option value="">— เลือกสมาชิก LINE —</option>
                {(data.candidates || []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.display_name} ({c.id.slice(0, 8)}){c.existing_code ? ` · [${c.existing_code}]` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              รหัสแนะนำ (เช่น COACH_A, PI003)
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="COACH_A" minLength={3} maxLength={24} required />
            </label>
            <label>
              ส่วนแบ่ง (%)
              <input type="number" min="1" max="80" step="1" value={ratePct} onChange={e => setRatePct(e.target.value)} required />
            </label>
            <label>
              บัญชีรับโอน / PromptPay
              <input value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="เช่น กสิกร 012-3-45678-9" maxLength={160} />
            </label>
            <button type="submit" className="account-primary" disabled={busy}>
              <Link2 size={15} /> บันทึกพาร์ทเนอร์ Affiliate
            </button>
          </form>

          {(data.referrals || []).length > 0 && (
            <form
              className="admin-credit-form"
              style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(148,163,184,0.15)' }}
              onSubmit={async event => {
                event.preventDefault();
                await submitAction(
                  { action: 'record-manual-commission', referredMemberId: manualMemberId, grossAmountThb: Number(manualGross), planId: manualPlan, note: manualNote },
                  'บันทึกค่าคอม 30% จากยอดโอนตรงสำเร็จ'
                );
                setManualNote('');
              }}
            >
              <label>
                บันทึกรายได้โอนตรง (นอก Stripe) ให้ลูกค้าที่ถูกแนะนำมา
                <select value={manualMemberId} onChange={e => setManualMemberId(e.target.value)} required>
                  <option value="">— เลือกลูกค้าที่ชวนมา —</option>
                  {data.referrals.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.display_name} (แนะนำโดย {r.referred_by_code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                แพ็กเกจ
                <select value={manualPlan} onChange={e => { setManualPlan(e.target.value); setManualGross(e.target.value === 'starter' ? '159' : '399'); }}>
                  <option value="pro">PRO VIP (399 ฿)</option>
                  <option value="starter">BASIC (159 ฿)</option>
                </select>
              </label>
              <label>
                ยอดชำระจริง (บาท)
                <input type="number" min="1" step="1" value={manualGross} onChange={e => setManualGross(e.target.value)} required />
              </label>
              <label>
                หมายเหตุ
                <input value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="เช่น โอนสลิปรอบ พ.ย." maxLength={160} />
              </label>
              <button type="submit" className="account-secondary" disabled={busy}>
                <Wallet size={15} /> คำนวณค่าคอม 30%
              </button>
            </form>
          )}
        </section>
      )}

      {data?.isSuper && (data.partners || []).length > 0 && (
        <section className="account-card">
          <h3>รายชื่อพาร์ทเนอร์ Affiliate ทั้งหมด ({data.partners.length})</h3>
          <div className="admin-member-list">
            {data.partners.map(p => (
              <article key={p.member_id}>
                <div>
                  <strong>{p.partner_name} · <code>{p.code}</code> ({p.commission_rate_pct}%)</strong>
                  <small>ลิงก์: <code>{origin}/?ref={p.code}</code> {p.payout_note ? `· บัญชีรับเงิน: ${p.payout_note}` : ''}</small>
                </div>
                <div className="admin-member-meta">
                  <small>ชวน {p.referred_count} คน · Sub active {p.active_subscribers} คน</small>
                  <small>รอโอน <b style={{ color: '#fbbf24' }}>{thb(p.pending_commission_thb)}</b> · จ่ายแล้ว <b style={{ color: '#34d399' }}>{thb(p.paid_commission_thb)}</b></small>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="account-secondary"
                    disabled={busy}
                    onClick={() => submitAction(
                      { action: 'create-partner', memberId: p.member_id, code: p.code, commissionRatePct: p.commission_rate_pct, status: p.status === 'active' ? 'paused' : 'active', payoutNote: p.payout_note || '' },
                      `${p.status === 'active' ? 'พักสิทธิ์' : 'เปิดสิทธิ์'}พาร์ทเนอร์ ${p.code} แล้ว`
                    )}
                  >
                    {p.status === 'active' ? 'พักรหัสชั่วคราว' : 'เปิดใช้งานรหัส'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="account-card">
        <h3>บัญชีค่าคอมมิชชั่น 30% ({(data?.commissions || []).length} รายการล่าสุด)</h3>
        {!(data?.commissions || []).length ? (
          <p className="account-empty">ยังไม่มีรายการค่าคอมมิชชั่น — ส่งลิงก์ ?ref= ของคุณให้ลูกค้าเข้าเว็บแล้วสมัครสมาชิกเพื่อเริ่มรับส่วนแบ่ง 30%</p>
        ) : (
          <div className="admin-member-list">
            {data.commissions.map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.customer_name} · แพ็กเกจ {String(item.plan_id).toUpperCase()} ({item.interval === 'year' ? 'รายปี' : 'รายเดือน'})</strong>
                  <small>รหัส {item.referral_code} ({item.partner_name}) · ยอดบิล {thb(item.gross_amount_thb)} · อัตรา {item.commission_rate_pct}%</small>
                  <small>วันที่ {dt(item.created_at)} {item.payout_note ? `· ${item.payout_note}` : ''}</small>
                </div>
                <div className="admin-member-meta">
                  <strong style={{ color: item.status === 'paid' ? '#34d399' : item.status === 'cancelled' ? '#94a3b8' : '#fbbf24' }}>
                    +{thb(item.commission_thb)}
                  </strong>
                  <small>{item.status === 'paid' ? `โอนแล้ว ${dt(item.paid_at)}` : item.status === 'cancelled' ? 'ยกเลิก' : 'รอโอนจ่าย'}</small>
                </div>
                {data?.isSuper && item.status === 'pending' && (
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="account-primary"
                      disabled={busy}
                      onClick={() => submitAction(
                        { action: 'mark-commission-status', commissionId: item.id, status: 'paid', payoutNote: 'โอนจ่ายเรียบร้อย' },
                        `บันทึกโอนจ่ายค่าคอม ${thb(item.commission_thb)} แล้ว`
                      )}
                    >
                      โอนจ่ายแล้ว
                    </button>
                    <button
                      type="button"
                      className="account-secondary"
                      disabled={busy}
                      onClick={() => submitAction(
                        { action: 'mark-commission-status', commissionId: item.id, status: 'cancelled', payoutNote: 'ยกเลิกรายการ' },
                        'ยกเลิกรายการค่าคอมแล้ว'
                      )}
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="account-card">
        <h3>ลูกค้าที่เข้ามาผ่านลิงก์แนะนำล่าสุด ({(data?.referrals || []).length})</h3>
        {!(data?.referrals || []).length ? (
          <p className="account-empty">ยังไม่มีลูกค้าที่ติดรหัสแนะนำ</p>
        ) : (
          <div className="admin-member-list">
            {data.referrals.map(ref => (
              <article key={ref.id}>
                <div>
                  <strong>{ref.display_name}</strong>
                  <small>รหัส {ref.referred_by_code} ({ref.partner_name || 'Partner'}) · เข้ามาเมื่อ {dt(ref.referred_at)}</small>
                </div>
                <div className="admin-member-meta">
                  <small style={{ color: ref.stripe_status === 'active' || (ref.subscription_ends_at && Date.parse(ref.subscription_ends_at) > Date.now()) ? '#34d399' : '#94a3b8' }}>
                    {ref.stripe_status === 'active'
                      ? `✅ Stripe ${String(ref.stripe_plan_id || '').toUpperCase()}`
                      : ref.subscription_ends_at && Date.parse(ref.subscription_ends_at) > Date.now()
                        ? '✅ VIP Active'
                        : '⏳ ยังไม่ Subscribe'}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function myPartnerBox(myCode, myRefLink, ratePct, copiedLink, onCopy) {
  if (!myCode) return null;
  return (
    <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
      <div>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', display: 'block' }}>
          <Share2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> ลิงก์แนะนำส่วนตัวของคุณ (รับค่าคอม {ratePct}%)
        </span>
        <code style={{ fontSize: '13px', color: '#f8fafc', wordBreak: 'break-all' }}>{myRefLink}</code>
      </div>
      <button type="button" className="account-primary" onClick={onCopy}>
        {copiedLink ? <Check size={15} /> : <Copy size={15} />} {copiedLink ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ชวนลูกค้า'}
      </button>
    </div>
  );
}
