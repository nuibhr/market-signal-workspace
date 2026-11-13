import Link from 'next/link';
import {CandlestickChart, Globe2, ChartNoAxesCombined, Layers3, ArrowLeftRight, House, Users, Sparkles, ShieldCheck} from 'lucide-react';
import {VISIBLE_MARKET_PAGES} from '../markets/market-pages.mjs';

const ICONS = {thai: CandlestickChart, dr: Globe2, tfex: Layers3, us: ChartNoAxesCombined, forex: ArrowLeftRight};

export default function MarketNavigation({current}){
  const isProSuite = ['risk', 'calendar', 'developers', 'pro-suite', 'daytrade'].includes(current);
  const featuredMarkets = VISIBLE_MARKET_PAGES.filter(m => m.featured);
  const otherMarkets = VISIBLE_MARKET_PAGES.filter(m => !m.featured);

  return (
    <nav className="market-destinations" aria-label="เลือกหน้าตลาด">
      <Link href="/" className="market-home-link" aria-label="หน้าแรก Nugaom" title="หน้าแรก Nugaom">
        <House size={16}/>
      </Link>
      {featuredMarkets.map(m => {
        const Icon = ICONS[m.id];
        const isActive = current === m.id;
        return (
          <Link
            key={m.id}
            href={m.href}
            aria-current={isActive ? 'page' : undefined}
            className={`market-nav-link is-featured market-${m.id}`}
            style={{'--destination-accent': m.accent, '--destination-rgb': m.rgb}}
          >
            <Icon size={17} className="market-nav-icon"/>
            <span className="market-nav-name">{m.label}</span>
            {m.tag && (
              <span className="market-badge-pill">
                <span className="market-pulse-dot" />
                {m.tag}
              </span>
            )}
            <small>{m.short}</small>
          </Link>
        );
      })}
      <span className="market-nav-divider" aria-hidden="true" />
      {otherMarkets.map(m => {
        const Icon = ICONS[m.id];
        const isActive = current === m.id;
        return (
          <Link
            key={m.id}
            href={m.href}
            aria-current={isActive ? 'page' : undefined}
            className={`market-nav-link market-${m.id}`}
            style={{'--destination-accent': m.accent, '--destination-rgb': m.rgb}}
          >
            <Icon size={17} className="market-nav-icon"/>
            <span className="market-nav-name">{m.label}</span>
            <small>{m.short}</small>
          </Link>
        );
      })}
      <span className="market-nav-divider" aria-hidden="true" />
      <Link
        href="/open-account"
        aria-current={current === 'open-account' ? 'page' : undefined}
        className="market-nav-link market-open-account"
        style={{'--destination-accent': '#c084fc', '--destination-rgb': '192, 132, 252'}}
        title="เปิดพอร์ต 3 โบรกเกอร์ (Pi, Trinity, ASL) รับสิทธิ์ VIP & Telegram สัญญาณฟรี"
      >
        <ShieldCheck size={17} className="market-nav-icon"/>
        <span className="market-nav-name">เปิดบัญชี</span>
        <span className="market-badge-pill" style={{ background: 'rgba(192, 132, 252, 0.2)', color: '#d8b4fe' }}>
          <span className="market-pulse-dot" style={{ background: '#c084fc' }} />
          VIP ฟรี
        </span>
        <small>PARTNERS</small>
      </Link>
      <span className="market-nav-divider" aria-hidden="true" />
      <Link
        href="/risk"
        aria-current={isProSuite ? 'page' : undefined}
        className="market-nav-link market-pro-suite"
        style={{'--destination-accent': '#0284c7', '--destination-rgb': '2, 132, 199'}}
        title="ชุดเครื่องมือช่วยเทรดมือโปร (Risk, Scanner, Calendar)"
      >
        <Sparkles size={17} className="market-nav-icon"/>
        <span className="market-nav-name">Pro Suite</span>
        <small>ANALYTICS</small>
      </Link>
      <Link
        href="/community"
        aria-current={current === 'community' ? 'page' : undefined}
        className="market-nav-link market-community"
        style={{'--destination-accent': '#ec4899', '--destination-rgb': '236, 72, 153'}}
      >
        <Users size={17} className="market-nav-icon"/>
        <span className="market-nav-name">ชุมชน</span>
        <small>MEMBERS</small>
      </Link>
    </nav>
  );
}
