'use client';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowUpRight, ArrowRight, CandlestickChart, Globe2, Layers3, ChartNoAxesCombined, ArrowLeftRight, ShieldCheck} from 'lucide-react';
import {useEffect,useState} from 'react';
import {MARKET_PAGES} from '../markets/market-pages.mjs';
import MemberAvatar from './member-avatar.jsx';
const ICONS={thai:CandlestickChart,dr:Globe2,tfex:Layers3,us:ChartNoAxesCombined,forex:ArrowLeftRight};
export default function MarketLobby(){
 const [account,setAccount]=useState(null);
 useEffect(()=>{const c=new AbortController();fetch('/api/membership',{cache:'no-store',signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>setAccount(d?.account??null)).catch(()=>{});return()=>c.abort();},[]);
 return <div className="market-lobby"><header className="lobby-header"><Link href="/" className="lobby-brand"><Image src="/nugaom-mascot.png" width={44} height={44} alt="น้องนักออม"/><span>Nugaom<small>YOUR DAILY MARKET ROUTINE</small></span></Link><Link className="lobby-account" href="/account"><MemberAvatar account={account} size={28}/>{account?.displayName??'เข้าสู่ระบบด้วย LINE'}<ArrowUpRight size={16}/></Link></header><main><section className="lobby-intro"><div><span className="eyebrow">FIVE MARKETS. ONE NUGAOM.</span><h1>ตลาดของคุณ<br/><em>พื้นที่ของคุณ</em></h1><p>เลือกตลาดที่สนใจ แล้วเริ่มจากข้อมูล กราฟ และสัญญาณ<br/>แต่ละตลาดมีพื้นที่ของตัวเอง เครื่องมือครบในบัญชีเดียว</p><Link href="/account" className="lobby-line">{account?'เปิดบัญชีของฉัน':'เริ่มใช้ฟรี 14 วันด้วย LINE'}<ArrowRight size={18}/></Link></div><div className="lobby-mascot"><Image src="/nugaom-mascot.png" width={220} height={220} priority alt="น้องนักออม AI"/><span>ผู้ช่วยประจำวันของคุณ</span></div></section><section className="lobby-markets" aria-label="ตลาดทั้งหมด">{MARKET_PAGES.map((m,i)=>{const Icon=ICONS[m.id];return <Link href={m.href} key={m.id} className={`lobby-market ${m.id}`} style={{'--market-accent':m.accent,'--market-rgb':m.rgb}}><div className="lobby-market-top"><span className="market-icon"><Icon size={27}/></span><span>0{i+1} / {m.short}</span><ArrowUpRight size={20}/></div><h2>{m.label}</h2><p>{m.description}</p><span className="lobby-enter">เปิดพื้นที่ตลาด<ArrowRight size={17}/></span></Link>;})}</section><div className="lobby-note"><ShieldCheck size={18}/><span>บัญชี LINE · เครดิต · รายการโปรด · ผู้ช่วย AI ใช้ร่วมกันทุกตลาด<br/><small>แจ้งเตือนจากระบบเป็นข้อมูลอ้างอิง ไม่มีการส่งคำสั่งซื้อขาย</small></span></div></main></div>;
}
