'use client';
import styles from './thai-workspace.module.css';
export const THAI_VIEWS=[
 {id:'stage2',hash:'#section-auto-pick',label:'Stage 2',note:'คัดกรองแนวโน้ม'},
 {id:'radar',hash:'#section-radar',label:'Radar เดิม',note:'คะแนน / แผนเฝ้า'},
 {id:'chart',hash:'#chart-panel',label:'กราฟ',note:'ราคาและตัวชี้วัด'},
 {id:'results',hash:'#section-results',label:'100 ไม้',note:'คิว / ผลปิดไม้'},
];
export function thaiViewForHash(hash){return THAI_VIEWS.find(v=>v.hash===hash)?.id??'stage2';}
export default function ThaiWorkspaceNav({view='stage2',symbol,onNavigate,onOpenScanner}){
 return <section id="thai-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นไทย">
  <div className={styles.heading}><div><h1>หุ้นไทย <small>SET100 + mai</small></h1><p>เลือกเครื่องมือ แล้วเปิดกราฟหุ้นที่สนใจ</p></div><span className={styles.symbol}>กำลังดู <b>{symbol}</b></span></div>
  <div className={styles.row}><nav aria-label="เลือกเครื่องมือหุ้นไทย" className={styles.views}>{THAI_VIEWS.map(v=><a key={v.id} href={v.hash} aria-current={view===v.id?'location':undefined} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onNavigate(v.id);}}><b>{v.label}</b><small>{v.note}</small></a>)}</nav><button type="button" className={styles.scan} onClick={onOpenScanner}>สแกนตามสไตล์ ↗</button></div>
 </section>;
}
