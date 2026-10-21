'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {createNotificationInbox} from '../../auto-pick/notification-inbox.mjs';
import {createMonitorAudio} from '../../monitor/audio.mjs';
import {receiveSignalPage,referenceAlertHistorical} from '../../signals/client.mjs';
import {MARKET_LABELS} from '../../monitor/view.mjs';
import {eventLabel,eventSpeech,tradeReference} from '../../monitor/records.mjs';
import {newsEvents} from '../../monitor/news.mjs';
import {soundPreference,saveSoundPreference,SOUND_PREFERENCE_KEY} from '../../monitor/preferences.mjs';
import TradeRecordDialog from './trade-record.jsx';
const Context=createContext(null);
export const useMonitor=()=>useContext(Context);
const markets=Object.keys(MARKET_LABELS);
const formatTime=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
export default function MonitorProvider({children}) {
  const pathname=usePathname(),active=/^\/(thai|dr|dr-strategy|tfex|us|forex|daytrade)(\/|$)/.test(pathname);
  const [revision,setRevision]=useState(0);
  const [swingSnapshots,setSwingSnapshots]=useState({});
  const [snapshots,setSnapshots]=useState({}),[errors,setErrors]=useState({}),[events,setEvents]=useState([]),[enabled,setEnabled]=useState(true),[audio,setAudio]=useState('idle'),[durable,setDurable]=useState(true),[now,setNow]=useState(null);
  const [newsHistory,setNewsHistory]=useState([]),[newsStatus,setNewsStatus]=useState(null),[newsPolicy,setNewsPolicy]=useState(null),[newsArticles,setNewsArticles]=useState([]),[gestureReady,setGestureReady]=useState(false),[record,setRecord]=useState(null),[toast,setToast]=useState(null);
  const externalBoxes=useRef(new Map());
  const boxes=useRef(new Map()),adapter=useRef(null),sound=useRef(true),identity=useRef(null);
  const speak=(text,done=()=>{},eligible,key)=>adapter.current?.play(text,done,eligible,key)??false;
  const toggle=()=>{
    const next=!sound.current||['blocked','failed'].includes(audio);sound.current=next;setEnabled(next);adapter.current?.enable(next);
    try{saveSoundPreference(window.localStorage,next);}catch{}setGestureReady(true);
    if(next)speak('ทดสอบเสียงแจ้งเตือนทุกตลาด');
  };
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),30000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    adapter.current=createMonitorAudio(window,{onState:setAudio,visible:()=>document.visibilityState==='visible'});
    if(!adapter.current.supported)setAudio('unsupported');
    let storage;try{storage=window.localStorage;}catch{}
    sound.current=soundPreference(storage);setEnabled(sound.current);adapter.current.enable(sound.current);
    const unlock=event=>{if(!event.isTrusted||event.target.closest?.('.monitor-sound'))return;setGestureReady(true);if(sound.current)adapter.current.enable(true);document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};
    document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
    const preference=event=>{if(event.key===SOUND_PREFERENCE_KEY){sound.current=soundPreference(storage);setEnabled(sound.current);adapter.current.enable(sound.current);}};
    window.addEventListener('storage',preference);
    const tick=setInterval(()=>setNow(Date.now()),1000);setNow(Date.now());
    const visible=()=>adapter.current.visible();document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(tick);adapter.current.stop();document.removeEventListener('visibilitychange',visible);document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);window.removeEventListener('storage',preference);};
  },[]);
  useEffect(()=>{
    if(!active)return;
    let disposed=false,timer,storage;try{storage=window.localStorage;}catch{setDurable(false);}
    const controller=new AbortController(),box=createNotificationInbox({scope:'news:public:v1',owner:crypto.randomUUID(),storage,historyLimit:1000,locks:navigator.locks,onPersistenceError:()=>setDurable(false)});
    const poll=async()=>{
      try{
        const r=await fetch('/api/news?alerts=1',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),feed=await r.json();
        if(disposed)return;
        setNewsStatus(r.ok?feed.status:feed.code||'SOURCE_UNAVAILABLE');
        setNewsPolicy(feed.newsPolicy||'source-impact');setNewsArticles((feed.markets||[]).filter(m=>m.status==='available').flatMap(m=>m.articles||[]).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,6));
        if(r.ok){
          await box.receiveSnapshot(newsEvents(feed));
          for(let i=0;i<500&&!disposed;i++){
            const e=await box.claim(document.visibilityState==='visible');if(!e)break;await box.displayed(e.id);if(!referenceAlertHistorical(e))setToast(e);
            if(!referenceAlertHistorical(e)&&e.deliveryVoice==='pending'){
              await box.voice(e.id,sound.current?'attempted':'muted');
              if(sound.current)speak(eventSpeech(e),value=>box.voice(e.id,value),()=>!referenceAlertHistorical(e),e.id);
            }
            await box.dismiss(e.id);
          }
        }
        const history=await box.history();if(!disposed)setNewsHistory(history);
      }catch{if(!disposed){setNewsStatus('SOURCE_UNAVAILABLE');setNewsArticles([]);}}
      if(!disposed)timer=setTimeout(poll,60000);
    };poll();return()=>{disposed=true;controller.abort();clearTimeout(timer);box.release();};
  },[active]);
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
        if(!referenceAlertHistorical(e))setToast(e);
        if(!referenceAlertHistorical(e)&&e.deliveryVoice==='pending'){
          await box.voice(e.id,sound.current?'attempted':'muted');
          if(sound.current)speak(eventSpeech(e),value=>box.voice(e.id,value),()=>!referenceAlertHistorical(e));
        }
        await box.dismiss(e.id);
      }
    };
    const poll=async()=>{
      const next={},legacy={},fail={};
      await Promise.all([
        ...markets.map(async market=>{try{const d=await request(`/api/daytrade?market=${market}&compact=1`);if(!disposed)next[market]=d;}catch(e){fail[market]=e.message;}}),
        ...['thai','dr','us'].map(async market=>{try{const d=await request(`/api/signals?market=${market}&overview=0`);if(!disposed)legacy[market]=d;}catch(e){if(e.message!=='MEMBERSHIP_REQUIRED')fail[`swing-${market}`]=e.message;}})
      ]);
      if(disposed)return;
      const identities=new Set([...Object.values(next),...Object.values(legacy)].map(d=>d.notificationScope.split(':')[1]));
      const clear=async()=>{await Promise.all([...boxes.current.values()].map(b=>b.release()));boxes.current.clear();setEvents([]);setRecord(null);setToast(null);adapter.current?.stop();adapter.current?.enable(sound.current);};
      if(identities.size>1||Object.values(fail).includes('SIGN_IN_REQUIRED')){
        if(identity.current||boxes.current.size)await clear();setSnapshots({});setSwingSnapshots({});setErrors(fail);identity.current=null;
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
            await receiveSignalPage({page,requestCursor:null,inbox:box,expectedScope:page.notificationScope,fetchAfter:after=>request(`/api/signals?market=${market}&after=${after}&overview=0`)});
            await consume(box);
          }catch(e){fail[`swing-${market}`]=e.message;}
        }
        const allowSignals=Object.values(next).some(d=>d.signalAccess)||Object.keys(legacy).length>0;
        const history=(await Promise.all([...boxes.current.values(),...externalBoxes.current.values()].filter(b=>b.scope.includes(':')||allowSignals&&b.scope===identity.current).map(b=>b.history()))).flat();
        if(!disposed){setSnapshots(next);setSwingSnapshots(legacy);setErrors(fail);setEvents(history.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
      }
      if(!disposed)timer=setTimeout(poll,15000);
    };poll();
    return()=>{disposed=true;clearTimeout(timer);controller.abort();for(const box of boxes.current.values())box.release();boxes.current.clear();};
  },[active,revision]);
  return <Context.Provider value={{snapshots,swingSnapshots,errors,events:[...events,...newsHistory].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),newsStatus,newsPolicy,newsArticles,gestureReady,enabled,audio,durable,now,toggle,speak,inspectTrade:setRecord,refresh:()=>setRevision(v=>v+1),registerInbox:box=>externalBoxes.current.set(box.scope,box),cancelSpeech:key=>adapter.current?.cancel(key),isSpeechPending:key=>adapter.current?.has(key)}}>{children}{toast&&<aside className="monitor-event-toast" role="status" aria-live="polite"><button className="monitor-toast-close" type="button" aria-label="ปิดแจ้งเตือน" onClick={()=>setToast(null)}>×</button><strong>{eventLabel(toast)} · {toast.symbol}</strong><p>{toast.type==='NEWS'?toast.title:`${toast.side||''} · ราคาอ้างอิง ${toast.price??'—'} · ${MARKET_LABELS[toast.market]}`}</p>{toast.type==='NEWS'?<a href={toast.url} target="_blank" rel="noopener noreferrer">อ่านจาก {toast.source} ↗</a>:tradeReference(toast)&&<button type="button" onClick={()=>{setRecord(tradeReference(toast));setToast(null);}}>ดูไม้ / สถิติ ↗</button>}<small>ทุกเหตุการณ์เก็บในประวัติแจ้งเตือน</small></aside>}{record&&<TradeRecordDialog key={`${record.ledger}:${record.market}:${record.tradeId}`} reference={record} onClose={()=>setRecord(null)}/>}</Context.Provider>;
}
export function SoundControl(){
  const monitor=useMonitor();if(!monitor)return null;
  const label=monitor.audio==='unsupported'?'ไม่รองรับเสียง':['blocked','failed'].includes(monitor.audio)?'เบราว์เซอร์ยังไม่เล่นเสียง · ลองอีกครั้ง':!monitor.enabled?'เสียงปิด':monitor.audio==='speaking'?'กำลังอ่านแจ้งเตือน':monitor.audio==='starting'?'กำลังขอเล่นเสียง':!monitor.gestureReady?'เสียงเปิด · แตะหน้าเว็บครั้งแรก':'เสียงเปิด · รอเหตุการณ์';
  return <button className="monitor-sound" type="button" aria-pressed={monitor.enabled} disabled={monitor.audio==='unsupported'} onClick={monitor.toggle} title="ควบคุมเสียงทุกตลาด · การปิดเสียงไม่หยุดสแกนหรือบันทึก">{monitor.enabled?'◖))':'◖×'} <span>{label}</span></button>;
}
export function AlertHistory(){
  const m=useMonitor(),[count,setCount]=useState(20);if(!m)return null;
  return <section className="monitor-history" aria-label="ประวัติแจ้งเตือนทุกตลาด"><header><h3>แจ้งเตือนทุกตลาด</h3><span role="status" aria-live="polite">{m.events.length} รายการที่เก็บในอุปกรณ์นี้ (ล่าสุดไม่เกิน 1,000 ต่อฟีด) · <a href="#section-results">ประวัติแผนบนเซิร์ฟเวอร์ ↗</a></span></header>
    <p>เข้า–ออกและสถิติอ้างอิงรหัสไม้เดียวกัน · หนึ่งไม้นับผลปิดครั้งเดียว · ปิดเสียงยังเก็บบันทึก · ข่าวสำคัญแยกจากผลเทรด</p>
    <p role="status">ข่าวไทย / US: {m.newsStatus==='available'?'ตรวจข่าวใหม่ทุก 60 วินาที':m.newsStatus==='partial'?'บางแหล่งข่าวไม่พร้อม':m.newsStatus?'แหล่งข่าวยังไม่พร้อม':'กำลังตรวจแหล่งข่าว'} · {m.newsPolicy==='fresh-public-headlines'?'RSS สาธารณะจาก InfoQuest / CNBC · แจ้งหัวข้อข่าวใหม่ พร้อมที่มา': 'Breaking News จากแหล่งข่าว หรือความสำคัญ 4–5/5'} · ขณะเปิดเว็บ</p>
    {m.newsArticles?.length>0&&<details className="monitor-news-latest"><summary>ข่าวล่าสุดจากแหล่งข้อมูล ({m.newsArticles.length})</summary><ul>{m.newsArticles.map(a=><li key={`${a.source}:${a.id}`}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.title} ↗</a><small>{a.source} · {formatTime(a.publishedAt)}</small></li>)}</ul></details>}
    {!m.durable&&<p role="status">อุปกรณ์เก็บประวัติไม่ได้ รีเฟรชอาจได้รับรายการเดิมอีก</p>}
    {Object.keys(m.errors).some(k=>k.startsWith('swing-'))&&<p role="status">ฟีด Swing บางตลาดไม่พร้อม ประวัติเดิมยังอยู่</p>}
    <div className="monitor-history-scroll"><table><thead><tr><th>สินทรัพย์ / ตลาด</th><th>ราคา / ข่าว</th><th>เหตุการณ์ / บันทึก</th><th>เวลาเหตุการณ์</th><th>เสียง</th></tr></thead><tbody>{m.events.slice(0,count).map(e=>{const ref=tradeReference(e);return <tr key={`${e.ledger||e.mode}:${e.market}:${e.id}`}><td><b>{e.symbol}</b><small>{MARKET_LABELS[e.market]} {e.side}</small></td><td>{e.type==='NEWS'?<a href={e.url} target="_blank" rel="noopener noreferrer">{e.title} ↗</a>:Number.isFinite(e.price)?e.price.toLocaleString('en-US',{maximumFractionDigits:6}):'—'}<small>{e.type==='NEWS'?e.source:e.type==='PICK_READY'?'ระดับเข้าแผน':'ราคาอ้างอิง'}</small></td><td>{eventLabel(e)}<small>{e.type==='NEWS'?'ข่าว · ไม่นับสถิติเทรด':e.mode==='daytrade'?'EMA20/50 · แท่ง 15m':e.signalId?`Swing · ${e.mode}`:'Auto Pick รุ่นเดิม'}</small>{ref&&<button type="button" onClick={()=>m.inspectTrade(ref)}>ดูไม้ / สถิติ ↗</button>}</td><td>{formatTime(e.priceAt||e.createdAt)}</td><td>{({ended:'เบราว์เซอร์เล่นจบ',muted:'ปิดเสียง',attempted:'พยายามเล่น',blocked:'ถูกบล็อก',historical:'ย้อนหลัง',pending:'รอส่ง',failed:'เล่นไม่สำเร็จ',interrupted:'หยุดกลางทาง'})[e.deliveryVoice]||'ดูบันทึก'}</td></tr>;})}</tbody></table></div>
    {!m.events.length&&<p>ยังไม่มีเหตุการณ์ใหม่ในอุปกรณ์นี้ · สัญญาณเทรดใช้สิทธิสมาชิก · ข่าวใหม่เก็บขณะเปิดเว็บ</p>}
    {count<m.events.length&&<button onClick={()=>setCount(n=>n+50)}>ดูเพิ่ม ({m.events.length-count})</button>}
  </section>;
}
