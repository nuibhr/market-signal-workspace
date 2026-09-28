'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, Calculator, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'nugaom-ai-pick-manual-plans';
const empty = { side: 'BUY', entry: '', stop: '', target: '', capital: '', riskPercent: '1', note: '', levelSource: 'manual' };
const price = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—';

export default function SignalPlanBuilder({ asset, timeframe, tradePlan, freshness, currentPrice, sourceLabel }) {
  const longOnly = ['thai', 'dr', 'crypto'].includes(asset.id);
  const cashMarket = ['thai', 'dr', 'us', 'crypto'].includes(asset.id);
  const capitalCurrency = ['thai', 'dr'].includes(asset.id) ? 'THB' : asset.id === 'us' ? 'USD' : asset.id === 'crypto' ? 'USDT' : 'สกุลบัญชี';
  const [form, setForm] = useState(empty);
  const [plans, setPlans] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(stored)) setPlans(stored.filter(item => item && typeof item === 'object').slice(0, 50));
    } catch { setPlans([]); }
    setLoaded(true);
  }, []);
  useEffect(() => { setForm(empty); setMessage(''); }, [asset.instrumentId, timeframe]);

  function update(field, value) { setForm(current => ({ ...current, [field]: value, ...(['entry', 'stop', 'target', 'side'].includes(field) ? { levelSource: 'manual' } : {}) })); setMessage(''); }
  function fillFromChart() {
    if (!tradePlan?.tradeAllowed || freshness !== 'recent') return;
    const { entry, stopLoss, tp1, side } = tradePlan;
    if (![entry, stopLoss, tp1].every(value => Number.isFinite(value) && value > 0)) return;
    setForm(current => ({ ...current, side: side === 'SHORT' ? 'SELL' : 'BUY', entry: String(Number(entry.toPrecision(8))), stop: String(Number(stopLoss.toPrecision(8))), target: String(Number(tp1.toPrecision(8))), levelSource: 'technical-plan' }));
    setMessage('เติมระดับจากแผนเทคนิคแล้ว · Target คือโซนถัดไปที่พบจริง ตรวจราคาก่อนบันทึก');
  }

  const calculation = useMemo(() => {
    const entry = Number(form.entry), stop = Number(form.stop), target = Number(form.target);
    const capital = Number(form.capital), riskPercent = Number(form.riskPercent);
    const numbersValid = [entry, stop, target, capital, riskPercent].every(value => Number.isFinite(value) && value > 0);
    const orderValid = form.side === 'BUY' ? stop < entry && entry < target : target < entry && entry < stop;
    const valid = numbersValid && orderValid && riskPercent <= 10 && !(longOnly && form.side === 'SELL');
    const perUnitRisk = Math.abs(entry - stop);
    const riskBudget = capital * riskPercent / 100;
    const units = valid && cashMarket ? Math.min(riskBudget / perUnitRisk, capital / entry) : null;
    return { valid, riskBudget, perUnitRisk, units: units === null ? null : asset.id === 'crypto' ? Math.floor(units * 1_000_000) / 1_000_000 : Math.floor(units),
      rewardRisk: valid ? Math.abs(target - entry) / perUnitRisk : null };
  }, [form, longOnly, cashMarket, asset.id]);
  const knownZones = [...(tradePlan?.supports ?? []), ...(tradePlan?.resistances ?? [])];
  const firstBarrier = calculation.valid && tradePlan
    ? form.side === 'BUY'
      ? knownZones.filter(zone => zone.low > Number(form.entry) && zone.low < Number(form.target)).sort((a, b) => a.low - b.low)[0]
      : knownZones.filter(zone => zone.high < Number(form.entry) && zone.high > Number(form.target)).sort((a, b) => b.high - a.high)[0]
    : null;

  function save(event) {
    event.preventDefault();
    if (!calculation.valid) { setMessage('ตรวจลำดับราคา: BUY ต้อง Stop < Entry < Target; SHORT ต้อง Target < Entry < Stop และความเสี่ยงไม่เกิน 10%'); return; }
    const next = [{ ...form, id: crypto.randomUUID(), symbol: asset.symbol, instrumentId: asset.instrumentId, timeframe,
      createdAt: new Date().toISOString(), source: form.levelSource === 'technical-plan' ? `${sourceLabel} · ${tradePlan.ruleVersion}` : 'กำหนดเอง', status: 'draft' }, ...plans].slice(0, 50);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setPlans(next); setMessage('บันทึกแผนส่วนตัวในเบราว์เซอร์นี้แล้ว'); }
    catch { setMessage('บันทึกไม่ได้ เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูลในเครื่อง'); }
  }
  function remove(id) {
    const next = plans.filter(item => item.id !== id);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setPlans(next); }
    catch { setMessage('ลบแผนไม่ได้ กรุณาตรวจสิทธิพื้นที่เก็บข้อมูลของเบราว์เซอร์'); }
  }
  const visiblePlans = plans.filter(item => item.instrumentId === asset.instrumentId).slice(0, 5);

  return <article id="section-plan-builder" className="panel signal-plan-builder">
    <div className="rail-kicker"><span>YOUR SIGNAL PLAN / {asset.symbol}</span><span className="rail-mode">MANUAL</span></div>
    <h2>ตั้งแผนสัญญาณ</h2>
    <p className="signal-plan-intro">กำหนดระดับก่อนเทรด คำนวณขนาดสถานะจากความเสี่ยง และบันทึกแผนไว้กลับมาเปิดดู</p>
    <div className="signal-plan-source"><span>ราคาอ้างอิง {Number.isFinite(currentPrice) ? price(currentPrice) : '—'}</span><small>{Number.isFinite(currentPrice) ? sourceLabel : 'ยังไม่มีราคาจริง · กำหนดระดับเองได้'}</small></div>
    <form onSubmit={save} className="signal-plan-form">
      <div className="signal-plan-side" role="group" aria-label="ฝั่งแผน"><button type="button" className={form.side === 'BUY' ? 'selected buy' : ''} onClick={() => update('side', 'BUY')}>↗ BUY</button><button type="button" className={form.side === 'SELL' ? 'selected sell' : ''} onClick={() => update('side', 'SELL')} disabled={longOnly} title={longOnly ? 'ตลาดนี้ยังไม่รองรับแผน SHORT ในระบบ' : undefined}>↘ SHORT</button></div>
      <div className="signal-plan-fields"><label>Entry<input type="number" step="any" min="0" value={form.entry} onChange={event => update('entry', event.target.value)} required /></label><label>Stop<input type="number" step="any" min="0" value={form.stop} onChange={event => update('stop', event.target.value)} required /></label><label>Target<input type="number" step="any" min="0" value={form.target} onChange={event => update('target', event.target.value)} required /></label></div>
      <div className="signal-plan-helper"><button type="button" onClick={() => Number.isFinite(currentPrice) && update('entry', String(currentPrice))} disabled={!Number.isFinite(currentPrice)}>ใช้ราคาอ้างอิงเป็น Entry</button><button type="button" onClick={fillFromChart} disabled={!tradePlan?.tradeAllowed || freshness !== 'recent'} title={!tradePlan?.tradeAllowed ? 'รอแผนเทคนิคผ่านทุกเงื่อนไขก่อนเติมระดับ' : undefined}>เติมจากแผนเทคนิค</button></div>
      <div className="signal-plan-fields two"><label>เงินทุน ({capitalCurrency})<input type="number" step="any" min="0" value={form.capital} onChange={event => update('capital', event.target.value)} required /></label><label>เสี่ยงต่อแผน (%)<input type="number" step="0.1" min="0.1" max="10" value={form.riskPercent} onChange={event => update('riskPercent', event.target.value)} required /></label></div>
      <div className="signal-plan-calculation"><Calculator size={16} /><span>งบขาดทุน <b>{calculation.valid ? price(calculation.riskBudget) : '—'}</b></span><span>{cashMarket ? 'จำนวนหน่วยสูงสุด' : 'จำนวนสัญญา'} <b>{calculation.valid ? price(calculation.units) : '—'}</b></span><span>Reward : Risk <b>{calculation.valid ? `${price(calculation.rewardRisk)} : 1` : '—'}</b></span></div>
      {calculation.valid && calculation.rewardRisk < 1.8 && <p className="signal-plan-message">R:R ต่ำกว่า 1.8 ตามเกณฑ์แผนเทคนิค · แผนส่วนตัวนี้ยังบันทึกเป็นร่างได้</p>}
      {firstBarrier && <p className="signal-plan-message">Target ที่กรอกเลยโซนราคาใกล้สุด {price(form.side === 'BUY' ? firstBarrier.low : firstBarrier.high)} · ตรวจระยะทำกำไรอีกครั้ง</p>}
      <label className="signal-plan-note">เหตุผล/เงื่อนไขที่รอ<textarea rows={2} maxLength={400} value={form.note} onChange={event => update('note', event.target.value)} placeholder="เช่น รอแท่ง 1D ปิดเหนือแนวต้านก่อนพิจารณา" /></label>
      <button className="signal-plan-save" disabled={!calculation.valid}><BookmarkCheck size={16} />บันทึกแผนส่วนตัว</button>
      {message && <p className="signal-plan-message" role="status">{message}</p>}
    </form>
    <div className="signal-plan-saved"><h3>แผนที่บันทึกของ {asset.symbol}</h3>{loaded && visiblePlans.length ? visiblePlans.map(item => <div className="signal-plan-saved-row" key={item.id}><div><strong className={item.side === 'BUY' ? 'positive' : 'negative'}>{item.side} · {item.timeframe.toUpperCase()}</strong><small>{new Date(item.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}</small><span>Entry {item.entry} · Stop {item.stop} · Target {item.target}</span>{item.note && <em>{item.note}</em>}</div><button type="button" onClick={() => remove(item.id)} aria-label={`ลบแผน ${item.symbol}`}><Trash2 size={15} /></button></div>) : <p>ยังไม่มีแผนส่วนตัวของสินทรัพย์นี้</p>}</div>
    <p className="analysis-disclosure">แผนนี้เก็บในเบราว์เซอร์ ไม่ส่งคำสั่งซื้อขายและยังไม่แจ้งเตือนเมื่อแตะระดับ · {cashMarket ? asset.id === 'crypto' ? 'จำนวนเหรียญจำกัดด้วยเงินทุนและปัดลง 6 ตำแหน่ง ยังไม่รวมค่าธรรมเนียม/สเปรด' : 'จำนวนหุ้นถูกจำกัดด้วยเงินทุนและปัดลงเต็มหน่วย ยังไม่ปัดขนาด lot และไม่รวมค่าธรรมเนียม' : 'ยังไม่คำนวณจำนวนสัญญาจนกว่าจะมี contract size, tick value และการแปลงสกุลเงิน'}{longOnly ? ' · ฝั่ง SHORT รอข้อมูลสิทธิจากโบรกเกอร์' : ''}</p>
  </article>;
}
