'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SylvaHero } from '@designcodeio/threeui/components/SylvaHero';
import '@designcodeio/threeui/style.css';

// Change copy at the document boundary; upstream scene assets stay byte exact.
function personalize(frame, navigate) {
  const doc = frame.contentDocument;
  if (!doc?.querySelector('.headline')) return false;
  doc.documentElement.lang = 'th';
  doc.title = 'Nugaom AI Pick — เห็นจังหวะ ก่อนตัดสินใจ';
  frame.title = doc.title;
  const set = (selector, value) => { const el = doc.querySelector(selector); if (el) el.textContent = value; };
  set('.headline span:first-child i', 'เห็นจังหวะ');
  set('.headline span:last-child i', 'ก่อนตัดสินใจ');
  set('.lede', 'ให้ข้อมูลช่วยมองตลาด ให้คุณโฟกัสกับจังหวะที่ใช่ สแกน ติดตาม และทบทวนสัญญาณในพื้นที่เดียว');
  set('.ghost', 'NUGAOM');
  set('.liquid-button--explore .lbl', 'สำรวจตลาด');
  set('.stat--a dt', 'พื้นที่ของคุณ'); set('.stat--a dd', '5 ตลาด');
  set('.stat--b dt', 'เริ่มต้นด้วย'); set('.stat--b dd', 'LINE Login');
  set('.card--about .label', 'YOUR NEXT MOVE'); set('.card--about h2', 'เลือกตลาดของคุณ');
  set('.card--stove .label', 'FOLLOW THE SIGNAL'); set('.card--stove h2', 'ทุกจังหวะ มีบันทึก');
  doc.querySelectorAll('.portal-media img').forEach(img => img.alt = '');
  const dock = [...doc.querySelectorAll('.dock-item')];
  const items = [
    ['Nugaom AI Pick', '/'], ['ตลาด', '/markets'], ['วิธีใช้งาน', '/#how-it-works'],
    ['ผลงานสัญญาณ', '/thai#section-results'], ['เข้าใช้ด้วย LINE', '/account'],
  ];
  dock.forEach((el, i) => {
    const [label, href] = items[i];
    const text = el.querySelector('span:not(.glyph)');
    if (text) text.textContent = label;
    el.setAttribute('aria-label', label); el.title = label; el.href = href;
    el.dataset.nugaomHref = href;
  });
  const mark = dock[0];
  if (!mark.querySelector('img')) {
    const img = doc.createElement('img');
    img.src = '/nugaom-mascot.png'; img.alt = ''; img.width = 30; img.height = 30;
    img.style.cssText = 'width:90%;height:90%;object-fit:contain';
    mark.replaceChildren(img);
  }
  [
    ['.liquid-button--explore', '/markets', 'สำรวจทั้ง 5 ตลาด'],
    ['.liquid-button--play', '/#how-it-works', 'ดูวิธีติดตามสัญญาณ'],
    ['.knob--about', '/markets', 'เลือกตลาดของคุณ'],
    ['.card--stove .knob', '/thai#section-results', 'เปิดผลงานสัญญาณหุ้นไทย'],
    ['.scroll', '/#discover', 'เลือกตลาดที่สนใจ'],
  ].forEach(([selector, href, label]) => {
    const el = doc.querySelector(selector);
    if (!el) return;
    el.dataset.nugaomHref = href; el.setAttribute('aria-label', label);
    if (el.tagName === 'A') el.setAttribute('href', href);
  });
  const cue = doc.querySelector('.scroll');
  if (cue?.firstChild?.nodeType === 3) cue.firstChild.textContent = 'DISCOVER';
  if (!doc.getElementById('nugaom-scene-copy')) {
    const style = doc.createElement('style'); style.id = 'nugaom-scene-copy';
    style.textContent = `
      .hero .headline,.hero .lede,.hero .card h2,.hero .stat{font-family:'Lexend','Noto Sans Thai',Tahoma,sans-serif}
      .hero .headline{line-height:1.3}.hero .lede{line-height:1.8}
      .card h2{line-height:1.45}.ghost{font-size:calc(260 * var(--u));letter-spacing:calc(10 * var(--u))}
      @media(max-width:600px){
        .hero .headline{top:92px;font-size:36px;line-height:1.3}
        .hero .lede{top:194px;font-size:14px;line-height:1.7;width:calc(100% - 68 * var(--u))}
        .pill-clip{top:300px}.stat--a,.stat--b{top:355px}
        .stat dt,.stat dd{font-size:12px;line-height:1.6}
        .card .label{font-size:11px}.card h2{font-size:19px;line-height:1.4}
        .scroll{display:none}
        .card--about{top:max(540px,calc(1050 * var(--u)))}
        .knob-float{top:max(628px,calc(1218 * var(--u)))}
        .card--stove{top:max(682px,calc(1324 * var(--u)))}
        .stage{min-height:850px}
      }`;
    doc.head.appendChild(style);
  }
  if (!doc.documentElement.dataset.nugaomLinked) {
    doc.documentElement.dataset.nugaomLinked = 'true';
    doc.addEventListener('click', event => {
      const el = event.target.closest?.('[data-nugaom-href]');
      if (!el) return;
      event.preventDefault();
      // Keep bubbling so the authored dock's pollen interaction still runs.
      if (event.metaKey || event.ctrlKey) window.open(el.dataset.nugaomHref, '_blank', 'noopener,noreferrer');
      else navigate(el.dataset.nugaomHref);
    }, true);
  }
  return true;
}

export default function LandingSylva() {
  const root = useRef(null);
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const mounted = enabled && visible && inView;

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    setEnabled(!reduced.matches && !navigator.connection?.saveData);
    const visibility = () => setVisible(!document.hidden);
    const motion = () => setEnabled(!reduced.matches && !navigator.connection?.saveData);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', motion); visibility();
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '200px' });
    observer.observe(root.current);
    return () => {
      observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', motion);
    };
  }, []);

  useEffect(() => {
    setReady(false);
    if (!mounted) return;
    const frame = root.current.querySelector('iframe');
    if (!frame) return;
    const load = () => {
      try {
        setReady(personalize(frame, href => {
          if (href.startsWith('/#')) {
            const target = document.getElementById(href.slice(2));
            target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            target?.focus({ preventScroll: true });
          } else router.push(href);
        }));
      } catch { setReady(false); }
    };
    frame.addEventListener('load', load); load();
    return () => frame.removeEventListener('load', load);
  }, [mounted, router]);

  return <section ref={root} className="ng-hero" aria-label="Nugaom AI Pick">
    <div className="ng-hero-fallback" hidden={mounted && ready}>
      <span className="ng-kicker">YOUR MARKET. YOUR MOMENT.</span>
      <h1>เห็นจังหวะ<br /><em>ก่อนตัดสินใจ</em></h1>
      <p>สแกนตลาด ติดตามสัญญาณ และทบทวนทุกจังหวะ<br />กับน้องนักออม AI ในพื้นที่เดียว</p>
      <div className="ng-actions"><Link href="/markets" className="ng-button ng-button-light">สำรวจตลาด ↗</Link><Link href="/account" className="ng-text-link">เข้าใช้ด้วย LINE →</Link></div>
    </div>
    {mounted && <div className="shader-frame" data-ready={ready}>
      <SylvaHero variant="living-green" headingFont="lexend" bodyFont="lexend" headingWeight="300" bodyWeight="300" primaryColor="#ffffff" headingSize={63} bodySize={16.5} headingLetterSpacing={-0.006} style={{ height: '100%' }} />
    </div>}
    <button type="button" className="ng-scene-toggle" aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>{enabled ? '◌ ปิดฉากเคลื่อนไหว' : '◉ เปิดฉาก 3D'}</button>
  </section>;
}
