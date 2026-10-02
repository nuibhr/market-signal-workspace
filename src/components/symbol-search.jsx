'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_ASSETS, MARKET_GROUPS } from '../markets/catalog.mjs';

export default function SymbolSearch({ onSelect }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => {
    const term = query.trim().toUpperCase();
    return ALL_ASSETS.filter(item => (category === 'all' || item.id === category)
      && (!term || `${item.symbol} ${item.name} ${item.sectionId}`.toUpperCase().includes(term)));
  }, [query, category]);
  const visible = matches;
  const matchedCounts = Object.fromEntries(MARKET_GROUPS.map(group => [group.id, matches.filter(item => item.id === group.id).length]));

  useEffect(() => {
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function focusShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        rootRef.current?.querySelector('input')?.focus();
        setOpen(true);
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', focusShortcut);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', focusShortcut);
    };
  }, []);

  function select(item) {
    onSelect(item);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(index + 1, Math.max(0, visible.length - 1))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
    if (event.key === 'Enter' && visible[activeIndex]) { event.preventDefault(); select(visible[activeIndex]); }
  }

  return <div className="symbol-search" ref={rootRef}>
    <label className="symbol-search-field"><span aria-hidden="true">⌕</span><input
      role="combobox" aria-label="ค้นหา symbol ทุกตลาด" aria-autocomplete="list" aria-expanded={open}
      aria-controls="symbol-search-results" value={query} placeholder="ค้นหา Symbol ทุกตลาด"
      onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
      onKeyDown={handleKeyDown}
    /><kbd>⌘ K</kbd></label>
    {open && <div className="symbol-search-popover" id="symbol-search-results" role="listbox" aria-label="ผลการค้นหาสินทรัพย์">
      <div className="symbol-search-categories"><button className={category === 'all' ? 'selected' : ''} onClick={() => { setCategory('all'); setActiveIndex(0); }}>ทั้งหมด <small>{ALL_ASSETS.length}</small></button>{MARKET_GROUPS.map(group => <button key={group.id} className={category === group.id ? 'selected' : ''} onClick={() => { setCategory(group.id); setActiveIndex(0); }}>{group.label} <small>{group.sections.reduce((sum, section) => sum + section.assets.length, 0)}</small></button>)}</div>
      <div className="symbol-search-summary">{matches.length} SYMBOLS · {query.trim() ? `ผลลัพธ์สำหรับ “${query.trim()}”` : 'เลือกหมวดหรือพิมพ์ชื่อย่อ'}</div>
      <div className="symbol-search-results">{visible.map((item, index) => <div key={item.instrumentId}>{(index === 0 || visible[index - 1].id !== item.id) && <div className="symbol-result-group">{MARKET_GROUPS.find(group => group.id === item.id)?.label} <small>{matchedCounts[item.id]} รายการ</small></div>}<button role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(item)}><span><strong>{item.symbol}</strong><small>{item.name === item.symbol ? item.sectionId : item.name}</small></span><span><em>{MARKET_GROUPS.find(group => group.id === item.id)?.label}</em><small>{item.feed === 'settrade-daily' ? 'Settrade OHLC · ขอเมื่อเลือก' : item.feed === 'tfex-quote' ? 'TFEX OHLC · ขอเมื่อเลือก' : item.id === 'us' ? 'FMP EOD · สิทธิบางตัวยังไม่ครบ' : item.id === 'forex' ? 'FMP quote · ยังไม่มีกราฟ' : 'รอฟีดราคา'}</small></span></button></div>)}{visible.length === 0 && <p className="empty-state">ไม่พบ symbol นี้ในรายการที่กำหนด</p>}</div>
      {category === 'thai' && <div className="symbol-search-more">mai 50 เป็นรายชื่อเริ่มต้น; ยังไม่ยืนยันอันดับตาม Market Cap</div>}
    </div>}
  </div>;
}
