'use client';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowUpRight, ArrowRight, CandlestickChart, Globe2, Layers3, ChartNoAxesCombined, ArrowLeftRight, ShieldCheck} from 'lucide-react';
import {useEffect,useState} from 'react';
import {MARKET_PAGES} from '../markets/market-pages.mjs';
import MemberAvatar from './member-avatar.jsx';
const ICONS={thai:CandlestickChart,dr:Globe2,tfex:Layers3,us:ChartNoAxesCombined,forex:ArrowLeftRight};
const MARKET_METADATA = {
  thai: { feed: 'Settrade Open API', quality: 'Delayed · รอบ 15m / 1D', status: 'พร้อมประเมิน' },
  dr: { feed: 'KTB DR80 · หุ้นโลก', quality: 'EOD Closed Bars', status: 'พร้อมประเมิน' },
  tfex: { feed: 'TFEX Open API', quality: 'Delayed · สัญญา TFEX', status: 'รอจับคู่สัญญา' },
  us: { feed: 'Vantage CFD / FMP', quality: 'Strict Closed Bars 15m', status: 'พร้อมประเมิน' },
  forex: { feed: 'Vantage MT5 EA', quality: 'Read-only Connector', status: 'พร้อมเชื่อมต่อ' },
};
export default function MarketLobby(){
 const [account,setAccount]=useState(null);
 const [health,setHealth]=useState(null);
 useEffect(()=>{
  const c=new AbortController();
  fetch('/api/membership',{cache:'no-store',signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>setAccount(d?.account??null)).catch(()=>{});
  fetch('/api/health',{cache:'no-store',signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>setHealth(d)).catch(()=>{});
  return()=>c.abort();
 },[]);
 return <div className="market-lobby"><header className="lobby-header"><Link href="/" className="lobby-brand"><Image src="/nugaom-mascot.png" width={44} height={44} alt="น้องนักออม"/><span>Nugaom<small>YOUR DAILY MARKET ROUTINE</small></span></Link><Link className="lobby-account" href="/account"><MemberAvatar account={account} size={28}/>{account?.displayName??'เข้าสู่ระบบด้วย LINE'}<ArrowUpRight size={16}/></Link></header><main><section className="lobby-intro"><div><span className="eyebrow">FIVE MARKETS. ONE NUGAOM.</span><h1>ตลาดของคุณ<br/><em>พื้นที่ของคุณ</em></h1><p>เลือกตลาดที่สนใจ แล้วเริ่มจากข้อมูล กราฟ และสัญญาณ<br/>แต่ละตลาดมีพื้นที่ของตัวเอง เครื่องมือครบในบัญชีเดียว</p><Link href="/account" className="lobby-line">{account?'เปิดบัญชีของฉัน':'เริ่มใช้ฟรี 14 วันด้วย LINE'}<ArrowRight size={18}/></Link></div><div className="lobby-mascot"><Image src="/nugaom-mascot.png" width={220} height={220} priority alt="น้องนักออม AI"/><span>ผู้ช่วยประจำวันของคุณ</span></div></section>
 <section className="lobby-summary-strip" aria-label="สรุปความพร้อมและความสดของข้อมูล" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'14px',marginBottom:'26px'}}>
   <div style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'18px 22px',boxShadow:'0 4px 16px rgba(15,23,42,0.04)'}}>
     <span style={{fontSize:'11px',letterSpacing:'1.5px',color:'#0284c7',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'4px'}}>ENGINE STATUS</span>
     <strong style={{fontSize:'16px',color:'#0f172a',fontWeight:700,display:'block'}}>{health?.scanner === 'running' ? '● กำลังทำงาน (Scanner Active)' : '● พร้อมทำงาน (Standby)'}</strong>
     <small style={{fontSize:'12px',color:'#64748b'}}>AutoPick Rule: {health?.signalRule || 'swing-standard-forward-v1'}</small>
   </div>
   <div style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'18px 22px',boxShadow:'0 4px 16px rgba(15,23,42,0.04)'}}>
     <span style={{fontSize:'11px',letterSpacing:'1.5px',color:'#059669',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'4px'}}>FRESHNESS POLICY</span>
     <strong style={{fontSize:'16px',color:'#0f172a',fontWeight:700,display:'block'}}>Strict Closed Bars</strong>
     <small style={{fontSize:'12px',color:'#64748b'}}>ประเมินเมื่อแท่งปิดสมบูรณ์ · ไม่อ้างอิงเรียลไทม์</small>
   </div>
   <div style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'18px 22px',boxShadow:'0 4px 16px rgba(15,23,42,0.04)'}}>
     <span style={{fontSize:'11px',letterSpacing:'1.5px',color:'#6366f1',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'4px'}}>IMMUTABLE LEDGER</span>
     <strong style={{fontSize:'16px',color:'#0f172a',fontWeight:700,display:'block'}}>{health?.storage === 'available' ? 'พร้อมใช้งาน (SQLite/WAL)' : 'รอตรวจสอบ'}</strong>
     <small style={{fontSize:'12px',color:'#64748b'}}>บันทึกประวัติเข้า-ออกแท้จริง ป้องกัน Synthetic Wins</small>
   </div>
 </section>
 <section className="lobby-markets" aria-label="ตลาดทั้งหมด">{MARKET_PAGES.map((m,i)=>{const Icon=ICONS[m.id];return <Link href={m.href} key={m.id} className={`lobby-market ${m.id}`} style={{'--market-accent':m.accent,'--market-rgb':m.rgb}}><div className="lobby-market-top"><span className="market-icon"><Icon size={27}/></span><span>0{i+1} / {m.short}</span><ArrowUpRight size={20}/></div><h2>{m.label}</h2><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',margin:'12px 0 6px',fontSize:'10px'}}><span style={{color:'var(--market-accent)',background:'rgba(var(--market-rgb),0.12)',border:'1px solid rgba(var(--market-rgb),0.3)',padding:'3px 8px',borderRadius:'6px'}}>{MARKET_METADATA[m.id]?.status}</span><span style={{color:'#7a959f'}}>{MARKET_METADATA[m.id]?.quality}</span></div><p>{m.description}</p><span className="lobby-enter">เปิดพื้นที่ตลาด<ArrowRight size={17}/></span></Link>;})}</section><div className="lobby-note"><ShieldCheck size={18}/><span>บัญชี LINE · เครดิต · รายการโปรด · ผู้ช่วย AI ใช้ร่วมกันทุกตลาด<br/><small>แจ้งเตือนจากระบบเป็นข้อมูลอ้างอิง ไม่มีการส่งคำสั่งซื้อขาย</small></span></div></main></div>;
}
