'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {createNotificationInbox} from '../../auto-pick/notification-inbox.mjs';
import {createMonitorAudio} from '../../monitor/audio.mjs';
import {receiveSignalPage,referenceAlertHistorical} from '../../signals/client.mjs';
import {EVENT_LABELS,MARKET_LABELS} from '../../monitor/view.mjs';
const Context=createContext(null);
export const useMonitor=()=>useContext(Context);
const markets=Object.keys(MARKET_LABELS);
const formatTime=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
export default function MonitorProvider({children}) {
  const pathname=usePathname(),active=/^\/(thai|dr|tfex|us|forex|daytrade)(\/|$)/.test(pathname);
  const [revision,setRevision]=useState(0);
  const [snapshots,setSnapshots]=useState({}),[errors,setErrors]=useState({}),[events,setEvents]=useState([]),[enabled,setEnabled]=useState(false),[audio,setAudio]=useState('idle'),[durable,setDurable]=useState(true),[now,setNow]=useState(null);
  const externalBoxes=useRef(new Map());
  const boxes=useRef(new Map()),adapter=useRef(null),sound=useRef(false),identity=useRef(null);
  const speak=(text,done=()=>{},eligible)=>adapter.current?.play(text,done,eligible)??false;
  const toggle=()=>{
    const next=!sound.current||['blocked','failed'].includes(audio);sound.current=next;setEnabled(next);adapter.current?.enable(next);
    if(next)speak('ทดสอบเสียงแจ้งเตือนทุกตลาด');
  };
  useEffect(()=>{
    adapter.current=createMonitorAudio(window,{onState:setAudio,visible:()=>document.visibilityState==='visible'});
    if(!adapter.current.supported)setAudio('unsupported');
    const tick=setInterval(()=>setNow(Date.now()),1000);setNow(Date.now());
    const visible=()=>adapter.current.visible();document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(tick);adapter.current.stop();document.removeEventListener('visibilitychange',visible);};
  },[]);
  useEffect(()=>{
    if(!active)return;
    let disposed=false,timer;const controller=new AbortController(),owner=crypto.randomUUID();
    const request=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const d=await r.json();if(!r.ok)throw Error(d.error||d.code||`HTTP_${r.status}`);return d;};
    const boxFor=scope=>{
      if(!boxes.current.has(scope)){let storage;try{storage=window.localStorage;}catch{setDurable(false);}
        boxes.current.set(scope,createNotificationInbox({scope,owner,storage,historyLimit:1000,locks:navigator.locks,onPersistenceError:()=>setDurable(false)}));}
      return boxes.current.get(scope);
    };
    const consume=async box=>{
      for(let i=0;i<500&&!disposed;i++){
        const e=await box.claim(document.visibilityState==='visible');if(!e)break;
        await box.displayed(e.id);
        if(!referenceAlertHistorical(e)&&e.deliveryVoice==='pending'){
          await box.voice(e.id,sound.current?'attempted':'muted');
          if(sound.current)speak(`${e.symbol} ${MARKET_LABELS[e.market]} ${EVENT_LABELS[e.type]} ราคาอ้างอิง ${e.price??'ไม่ระบุ'}`,value=>box.voice(e.id,value),()=>!referenceAlertHistorical(e));
        }
        await box.dismiss(e.id);
      }
    };
    const poll=async()=>{
      const next={},legacy={},fail={};
      await Promise.all([
        ...markets.map(async market=>{try{const d=await request(`/api/daytrade?market=${market}&compact=1`);if(!disposed)next[market]=d;}catch(e){fail[market]=e.message;}}),
        ...['thai','dr','us'].map(async market=>{try{const d=await request(`/api/signals?market=${market}`);if(!disposed)legacy[market]=d;}catch(e){if(e.message!=='MEMBERSHIP_REQUIRED')fail[`swing-${market}`]=e.message;}})
      ]);
      if(disposed)return;
      const identities=new Set([...Object.values(next),...Object.values(legacy)].map(d=>d.notificationScope.split(':')[1]));
      const clear=async()=>{await Promise.all([...boxes.current.values()].map(b=>b.release()));boxes.current.clear();setEvents([]);adapter.current?.stop();sound.current=false;setEnabled(false);};
      if(identities.size>1||Object.values(fail).includes('SIGN_IN_REQUIRED')){
        await clear();setSnapshots({});setErrors(fail);identity.current=null;
      }else{
        const member=[...identities][0];
        if(member&&identity.current&&identity.current!==member)await clear();
        if(member)identity.current=member;
        for(const [market,d] of Object.entries(next)){
          for(const [scope,old] of boxes.current)if(scope.startsWith('daytrade:')&&scope.endsWith(`:${market}`)&&scope!==d.notificationScope){await old.release();boxes.current.delete(scope);}
          const box=boxFor(d.notificationScope);
          if(d.signalAccess){if(!await box.receiveSnapshot(d.monitorEvents||[]))fail[market]='รอรับแจ้งเตือนชุดถัดไป · รายการเดิมยังอยู่';await consume(box);}
          else {await box.release();boxes.current.delete(d.notificationScope);for(const [scope,old] of boxes.current)if(scope.startsWith('swing:')&&scope.endsWith(`:${market}`)){await old.release();boxes.current.delete(scope);}}
        }
        for(const [market,page] of Object.entries(legacy)){
          try{
            const box=boxFor(page.notificationScope);
            await receiveSignalPage({page,requestCursor:null,inbox:box,expectedScope:page.notificationScope,fetchAfter:after=>request(`/api/signals?market=${market}&after=${after}`)});
            await consume(box);
          }catch(e){fail[`swing-${market}`]=e.message;}
        }
        const allowSignals=Object.values(next).some(d=>d.signalAccess)||Object.keys(legacy).length>0;
        const history=(await Promise.all([...boxes.current.values(),...externalBoxes.current.values()].filter(b=>b.scope.includes(':')||allowSignals&&b.scope===identity.current).map(b=>b.history()))).flat();
        if(!disposed){setSnapshots(next);setErrors(fail);setEvents(history.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
      }
      if(!disposed)timer=setTimeout(poll,15000);
    };poll();
    return()=>{disposed=true;clearTimeout(timer);controller.abort();for(const box of boxes.current.values())box.release();boxes.current.clear();};
  },[active,revision]);
  return <Context.Provider value={{snapshots,errors,events,enabled,audio,durable,now,toggle,speak,refresh:()=>setRevision(v=>v+1),registerInbox:box=>externalBoxes.current.set(box.scope,box)}}>{children}</Context.Provider>;
}
export function SoundControl(){
  const monitor=useMonitor();if(!monitor)return null;
  const label=monitor.audio==='unsupported'?'ไม่รองรับเสียง':['blocked','failed'].includes(monitor.audio)?'เบราว์เซอร์ยังไม่เล่นเสียง · ลองอีกครั้ง':!monitor.enabled?'เสียงปิด':monitor.audio==='speaking'?'กำลังอ่านแจ้งเตือน':monitor.audio==='starting'?'กำลังขอเล่นเสียง':'เสียงเปิด · รอเหตุการณ์';
  return <button className="monitor-sound" type="button" aria-pressed={monitor.enabled} disabled={monitor.audio==='unsupported'} onClick={monitor.toggle} title="ควบคุมเสียงทุกตลาด · การปิดเสียงไม่หยุดสแกนหรือบันทึก">{monitor.enabled?'◖))':'◖×'} <span>{label}</span></button>;
}
export function AlertHistory(){
  const m=useMonitor(),[count,setCount]=useState(20);if(!m)return null;
  return <section className="monitor-history" aria-label="ประวัติแจ้งเตือนทุกตลาด"><header><h3>แจ้งเตือนทุกตลาด</h3><span role="status" aria-live="polite">{m.events.length} รายการที่เก็บในอุปกรณ์นี้ (ล่าสุดไม่เกิน 1,000 ต่อฟีด) · <a href="#section-results">ประวัติแผนบนเซิร์ฟเวอร์ ↗</a></span></header>
    <p>ใช้เงื่อนไขเดิมของ Daytrade และ Swing · เก็บขณะเปิดเว็บ · ปิดเสียงยังบันทึก · เปิดเสียงที่แถบบนเพื่อทดสอบสิทธิของเบราว์เซอร์</p>
    {!m.durable&&<p role="status">อุปกรณ์เก็บประวัติไม่ได้ รีเฟรชอาจได้รับรายการเดิมอีก</p>}
    {Object.keys(m.errors).some(k=>k.startsWith('swing-'))&&<p role="status">ฟีด Swing บางตลาดไม่พร้อม ประวัติเดิมยังอยู่</p>}
    <div className="monitor-history-scroll"><table><thead><tr><th>สินทรัพย์ / ตลาด</th><th>ราคาเหตุการณ์</th><th>เงื่อนไข / กติกา</th><th>เวลาเหตุการณ์</th><th>เสียง</th></tr></thead><tbody>{m.events.slice(0,count).map(e=><tr key={`${e.market}:${e.id}`}><td><a href={`/daytrade?market=${e.market}&symbol=${encodeURIComponent(e.symbol)}`}>{e.symbol}</a><small>{MARKET_LABELS[e.market]}</small></td><td>{Number.isFinite(e.price)?e.price.toLocaleString('en-US',{maximumFractionDigits:6}):'—'}<small>{e.type==='PICK_READY'?'ระดับเข้าแผน':'ราคาอ้างอิง'}</small></td><td>{EVENT_LABELS[e.type]||e.type}<small>{e.mode==='daytrade'?'EMA20/50 · แท่ง 15m':`Swing · ${e.mode||'ตามแผน'}`}</small></td><td>{formatTime(e.priceAt||e.createdAt)}</td><td>{({ended:'เบราว์เซอร์เล่นจบ',muted:'ปิดเสียง',attempted:'พยายามเล่น',blocked:'ถูกบล็อก',historical:'ย้อนหลัง',pending:'รอส่ง',failed:'เล่นไม่สำเร็จ',interrupted:'หยุดกลางทาง'})[e.deliveryVoice]||'ดูบันทึก'}</td></tr>)}</tbody></table></div>
    {!m.events.length&&<p>ยังไม่มีเหตุการณ์ที่รับในอุปกรณ์นี้ · ต้องมีสิทธิสมาชิกเพื่อรับผลสแกน</p>}
    {count<m.events.length&&<button onClick={()=>setCount(n=>n+50)}>ดูเพิ่ม ({m.events.length-count})</button>}
  </section>;
}
