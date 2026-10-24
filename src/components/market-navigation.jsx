import Link from 'next/link';
import {CandlestickChart, Globe2, ChartNoAxesCombined, Layers3, ArrowLeftRight, House, Users, Sparkles} from 'lucide-react';
import {VISIBLE_MARKET_PAGES} from '../markets/market-pages.mjs';

const ICONS = {thai: CandlestickChart, dr: Globe2, tfex: Layers3, us: ChartNoAxesCombined, forex: ArrowLeftRight};

export default function MarketNavigation({current}){
  const isProSuite = ['risk', 'calendar', 'developers', 'pro-suite', 'daytrade'].includes(current);
  return (
    <nav className="market-destinations" aria-label="เลือกหน้าตลาด">
      <Link href="/" className="market-home-link" aria-label="หน้าแรก Nugaom">
        <House size={17}/>
      </Link>
      {VISIBLE_MARKET_PAGES.map(m => {
        const Icon = ICONS[m.id];
        return (
          <Link
            key={m.id}
            href={m.href}
            aria-current={current === m.id ? 'page' : undefined}
            style={{'--destination-accent': m.accent}}
          >
            <Icon size={18}/>
            <span>{m.label}</span>
            <small>{m.short}</small>
          </Link>
        );
      })}
      <Link
        href="/risk"
        aria-current={isProSuite ? 'page' : undefined}
        style={{'--destination-accent': '#0284c7'}}
        title="ชุดเครื่องมือวิเคราะห์เชิงลึกระดับสถาบัน (Risk, Calendar, SMC API)"
      >
        <Sparkles size={18}/>
        <span>Pro Suite</span>
        <small>ANALYTICS</small>
      </Link>
      <Link href="/community" aria-current={current === 'community' ? 'page' : undefined}>
        <Users size={18}/>
        <span>ชุมชน</span>
        <small>MEMBERS</small>
      </Link>
      <Link href="/coaches" aria-current={current === 'coaches' ? 'page' : undefined}>
        <Users size={18}/>
        <span>พอร์ตโค้ช</span>
        <small>PAPER</small>
      </Link>
    </nav>
  );
}
