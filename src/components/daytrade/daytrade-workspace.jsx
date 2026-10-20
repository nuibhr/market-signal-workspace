'use client';
import Link from 'next/link';
import MarketNavigation from '../market-navigation.jsx';
import MemberAvatar from '../member-avatar.jsx';
import DaytradePanel from './daytrade-panel.jsx';
import DrStrategyRadar from '../dr/dr-strategy-radar.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import {SoundControl} from '../monitor/monitor-provider.jsx';
import styles from './daytrade.module.css';
const markets=[['thai','หุ้นไทย'],['dr','DR'],['tfex','TFEX'],['forex','Forex / Metals']];
export default function DaytradeWorkspace({ market = 'thai', initialSymbol = null, viewer = null }) {
  const isRadar = ['thai', 'dr'].includes(market);

  return (
    <main className={styles.workspace}>
      <MarketNavigation current={market} />
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            NUGAOM / {market === 'us' ? 'US CFD DESK' : market === 'dr' ? 'DR STRATEGY DESK' : market === 'thai' ? 'THAI EQUITIES DESK' : 'DAYTRADE DESK'}
          </span>
          <h1>
            {market === 'us' ? 'US CFD Command Center' : market === 'dr' ? 'DR Strategy Command Center' : market === 'thai' ? 'Thai Equities Command Center' : 'Daytrade Command Center'}
          </h1>
          <p>สแกนจากราคาจริง · แผนเดียวต่อสินทรัพย์ · จุดเข้า SL/TP และประวัติครบในหน้าเดียว</p>
        </div>
        <div className="monitor-header-actions">
          <SoundControl />
          <Link href="/account">{viewer ? <MemberAvatar account={viewer} /> : 'เข้าสู่ระบบ LINE ↗'}</Link>
        </div>
      </header>
      <ProToolsNav current="daytrade" />
      <nav className={styles.tabs} aria-label="ตลาดเดย์เทรด">
        {markets.map(([id, name]) => (
          <Link key={id} href={`/daytrade?market=${id}`} aria-current={market === id ? 'page' : undefined}>
            {name}
          </Link>
        ))}
        <Link href="/forex">เชื่อม MT5 ↗</Link>
      </nav>
      {isRadar ? (
        <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', padding: '0 1rem 3rem' }}>
          <DrStrategyRadar
            currentMarket={market}
            onSelectSymbol={(item) => {
              const targetMarket = (item.market === 'SET' || item.id === 'thai') ? 'thai' : 'dr';
              window.location.href = `/${targetMarket}?symbol=${encodeURIComponent(item.symbol)}#chart-panel`;
            }}
          />
        </div>
      ) : (
        <DaytradePanel key={market} market={market} initialSymbol={initialSymbol} />
      )}
    </main>
  );
}
