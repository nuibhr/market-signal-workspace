'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Radar, ScanLine, Volume2 } from 'lucide-react';

export default function LandingRobot() {
  const canvas = useRef(null);
  const root = useRef(null);
  const scene = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setEnabled(!navigator.connection?.saveData); }, []);
  useEffect(() => {
    setReady(false);
    if (!enabled) return;
    let cancelled = false, inView = true;
    const sync = () => scene.current?.setActive(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { rootMargin: '100px' });
    observer.observe(root.current);
    document.addEventListener('visibilitychange', sync);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    reduced.addEventListener('change', sync);
    import('./robot-scene.mjs').then(({ createRobotScene }) => {
      if (cancelled) return;
      try {
        scene.current = createRobotScene(canvas.current, { onError: () => { if (!cancelled) setEnabled(false); } });
        setReady(true); sync();
      } catch { if (!cancelled) setEnabled(false); }
    }).catch(() => { if (!cancelled) setEnabled(false); });
    return () => {
      cancelled = true; observer.disconnect();
      document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync);
      scene.current?.dispose(); scene.current = null;
    };
  }, [enabled]);

  return <section ref={root} className="ng-robot-hero" aria-labelledby="robot-hero-title">
    <div className="ng-robot-grid" aria-hidden="true" />
    <div className="ng-robot-copy">
      <span className="ng-robot-eyebrow"><span /> YOUR PERSONAL MARKET RADAR</span>
      <h1 id="robot-hero-title">มองตลาด<br />ให้<span>เห็นจังหวะ</span></h1>
      <p>พบกับน้องนักออม AI ผู้ช่วยสแกนตลาด<br className="ng-desktop-break" /> ติดตามสัญญาณ และทบทวนทุกการตัดสินใจ<br className="ng-desktop-break" /> ในพื้นที่เดียวของคุณ</p>
      <div className="ng-robot-actions"><Link href="/account" className="ng-robot-primary">เริ่มต้นด้วย LINE <ArrowUpRight size={20} /></Link><a href="#discover" className="ng-robot-secondary">สำรวจตลาด <span>↗</span></a></div>
      <div className="ng-robot-market-links" aria-label="ตลาดและพื้นที่สมาชิก"><Link href="/thai">หุ้นไทย</Link><Link href="/dr">DR</Link><Link href="/tfex">TFEX</Link><Link href="/forex">Forex / CFD</Link><Link href="/community">ชุมชนและทีม</Link></div>
      <div className="ng-robot-caption"><ScanLine size={15} /><span>สแกนตามเงื่อนไข · แจ้งเตือนผ่านเว็บ · คุณเป็นผู้ตัดสินใจ</span></div>
    </div>

    <div className="ng-robot-visual">
      <div className="ng-robot-aura" aria-hidden="true" />
      <div className="ng-robot-id"><span>N / 01</span><small>NUGAOM SCAN ASSISTANT</small></div>
      <div className="ng-robot-static" hidden={ready && enabled} role="img" aria-label="หุ่นยนต์น้องนักออมกับวงเรดาร์">
        <div className="ng-static-orbit" /><div className="ng-static-orbit ng-static-orbit-two" />
        <div className="ng-static-bot"><i className="ng-static-antenna" /><div className="ng-static-head"><span /><span /><i /></div><div className="ng-static-body"><b>N</b></div><div className="ng-static-arm ng-static-arm-left" /><div className="ng-static-arm ng-static-arm-right" /></div>
      </div>
      {enabled && <canvas ref={canvas} className={`ng-robot-canvas${ready ? ' is-ready' : ''}`} role="img" aria-label="หุ่นยนต์ 3D ลอยเหนือเรดาร์และสแกนกราฟ ภาพประกอบ ไม่ใช่ผลการสแกนจริง" />}
      <div className="ng-robot-hud ng-robot-hud-top" aria-hidden="true"><Radar size={16} /><span>MARKET RADAR<small>ค้นหาจังหวะที่เข้าเงื่อนไข</small></span><i /></div>
      <div className="ng-robot-hud ng-robot-hud-bottom"><Volume2 size={18} /><span>น้องนักออม AI<small>ผู้ช่วยอ่านสัญญาณของคุณ</small></span></div>
      <div className="ng-robot-visual-foot"><span>SCANNER VISUAL / ภาพประกอบ</span><button type="button" aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>{enabled ? 'หยุดฉาก 3D' : 'เปิดฉาก 3D'} <span aria-hidden="true">{enabled ? 'Ⅱ' : '▷'}</span></button></div>
    </div>
    <a href="#discover" className="ng-robot-scroll">EXPLORE THE MARKETS <span>↓</span></a>
  </section>;
}
