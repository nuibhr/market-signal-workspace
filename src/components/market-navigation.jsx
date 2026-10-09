import Link from 'next/link';
import {CandlestickChart, Globe2, ChartNoAxesCombined, Layers3, ArrowLeftRight, House, Users} from 'lucide-react';
import {MARKET_PAGES} from '../markets/market-pages.mjs';
const ICONS={thai:CandlestickChart,dr:Globe2,tfex:Layers3,us:ChartNoAxesCombined,forex:ArrowLeftRight};
export default function MarketNavigation({current}){
 return <nav className="market-destinations" aria-label="เลือกหน้าตลาด"><Link href="/" className="market-home-link" aria-label="หน้ารวมตลาด"><House size={17}/></Link>{MARKET_PAGES.map(m=>{const Icon=ICONS[m.id];return <Link key={m.id} href={m.href} aria-current={current===m.id?'page':undefined} style={{'--destination-accent':m.accent}}><Icon size={18}/><span>{m.label}</span><small>{m.short}</small></Link>;})}<Link href="/coaches" aria-current={current==='coaches'?'page':undefined}><Users size={18}/><span>พอร์ตโค้ช</span><small>PAPER</small></Link></nav>;
}
