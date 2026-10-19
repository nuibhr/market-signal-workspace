'use client';
import Link from 'next/link';
import MarketNavigation from '../market-navigation.jsx';
import MemberAvatar from '../member-avatar.jsx';
import DaytradePanel from './daytrade-panel.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import {SoundControl} from '../monitor/monitor-provider.jsx';
import styles from './daytrade.module.css';
const markets=[['thai','หุ้นไทย'],['dr','DR'],['tfex','TFEX'],['us','US CFDs'],['forex','Forex / Metals']];
export default function DaytradeWorkspace({market='us',initialSymbol=null,viewer=null}){
  return <main className={styles.workspace}><MarketNavigation current={market}/><header className={styles.hero}><div><span className={styles.eyebrow}>NUGAOM / {market==='us'?'VANTAGE US CFD DESK':'DAYTRADE DESK'}</span><h1>{market==='us'?'US CFD Command Center':'Daytrade Command Center'}</h1><p>สแกนจากราคาจริง · แผนเดียวต่อสินทรัพย์ · จุดเข้า SL/TP และประวัติครบในหน้าเดียว</p></div><div className="monitor-header-actions"><SoundControl/><Link href="/account">{viewer?<MemberAvatar account={viewer}/>: 'เข้าสู่ระบบ LINE ↗'}</Link></div></header><ProToolsNav current="daytrade" /><nav className={styles.tabs} aria-label="ตลาดเดย์เทรด">{markets.map(([id,name])=><Link key={id} href={id==='us'?'/us':`/daytrade?market=${id}`} aria-current={market===id?'page':undefined}>{name}</Link>)}<Link href="/forex">เชื่อม MT5 ↗</Link></nav><DaytradePanel key={market} market={market} initialSymbol={initialSymbol}/></main>;
}
