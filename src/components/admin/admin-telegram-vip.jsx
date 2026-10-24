'use client';

import { useState, useEffect } from 'react';
import {readTelegramSettings} from '../forex/telegram-settings.mjs';
import {
  Send,
  Bot,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Sparkles,
  RefreshCw,
  Sliders,
  History,
  Lock,
  Target,
  ExternalLink,
} from 'lucide-react';
import styles from './admin-telegram-vip.module.css';

const PRESET_SIGNALS = [
  {
    id: 'gold-pullback',
    name: '🥇 XAUUSD Gold London/NY Pullback',
    symbol: 'XAUUSD',
    side: 'BUY',
    strategyName: 'Gold London/NY Trend Pullback',
    entry: 2724.50,
    stopLoss: 2712.00,
    lockBuffer: 2728.50,
    tp1: 2742.00,
    tp2: 2758.00,
    recommendedLot: '0.04 Lot',
  },
  {
    id: 'eurusd-envelope',
    name: '🥈 EURUSD Dynamic Envelope',
    symbol: 'EURUSD',
    side: 'BUY',
    strategyName: 'FX Major Dynamic Envelope',
    entry: 1.0845,
    stopLoss: 1.0825,
    lockBuffer: 1.0853,
    tp1: 1.0875,
    tp2: 1.0895,
    recommendedLot: '0.05 Lot',
  },
  {
    id: 'usdjpy-asian',
    name: '🥉 USDJPY Asian Range Sweep',
    symbol: 'USDJPY',
    side: 'SELL',
    strategyName: 'Asian Range Liquidity Sweep',
    entry: 152.40,
    stopLoss: 152.70,
    lockBuffer: 152.25,
    tp1: 151.95,
    tp2: 151.60,
    recommendedLot: '0.03 Lot',
  },
];

const ANNOUNCEMENT_TEMPLATES = [
  {
    id: 'red-news',
    label: '⚠️ ข่าวกล่องแดง (งดเทรด)',
    title: '⚠️ แจ้งเตือนข่าวกล่องแดงสำคัญ (Red News Blackout)',
    body: '⏰ <b>เวลา 19:30 น. คืนนี้</b> มีการประกาศตัวเลขเศรษฐกิจสหรัฐฯ สำคัญ (US CPI / Non-Farm)\n\n📌 <b>คำแนะนำสำหรับสมาชิก VIP:</b>\n1. งดเปิดไม้ใหม่ทุกกรณีในช่วง 19:00 - 20:30 น.\n2. ไม้ที่ถืออยู่และบวกเกิน +1R ให้ขยับ SL มาดักหน้าทุน (Lock Profit) ทันที\n3. เพื่อความปลอดภัยและรักษากำไร ไม่เสี่ยงกับสเปรดถ่างช่วงข่าวครับ',
  },
  {
    id: 'morning-brief',
    label: '☀️ สรุปเปิดตลาดเช้า',
    title: '☀️ สรุปภาพรวมตลาดและกรอบเฝ้าระวังประจำวัน',
    body: 'อรุณสวัสดิ์สมาชิก VIP ทุกท่านครับ ☀️\n\n📊 <b>เรดาร์โฟกัสวันนี้:</b>\n• <b>XAUUSD (ทองคำ):</b> เฝ้าระวังกรอบสะสม 2,720 - 2,740 รอสัญญาณ Pullback ชัดเจนช่วงตลาดลอนดอน 14:00 น.\n• <b>ตลาดหุ้นไทย:</b> กลุ่มโรงพยาบาลและค้าปลีกยังรักษารูปแบบ Stage 2 ได้แข็งแกร่ง\n• <b>TFEX S50:</b> ยืนเหนือ 910 จุดได้ มีลุ้นเทรนด์ Rebound ต่อ\n\nเตรียมพร้อมรับสัญญาณอัตโนมัติคมชัดวันนี้ครับ!',
  },
  {
    id: 'breakeven-reminder',
    label: '🛡️ เตือนล็อคกำไรหน้าทุน',
    title: '🛡️ แจ้งเตือนด่วน: เลื่อนจุด Stop Loss ล็อคกำไร (Risk-Free Mode)',
    body: '📢 <b>ไม้เทรดทองคำ XAUUSD วิ่งบวกเกิน +1.0R เรียบร้อยแล้ว!</b>\n\n👉 ขอให้สมาชิกทุกท่าน <b>ขยับ Stop Loss ใน MT4/MT5 มาที่ราคาหน้าทุน +0.5R ทันที</b>\n\nไม้นี้ของคุณจะกลายเป็น <b>Risk-Free Trade 100%</b> ไม่มีทางขาดทุนอีกต่อไป นอนหลับสบายหรือปล่อยรันเนอร์ไปเป้าหมาย TP1 ได้เลยครับ 🏆',
  },
  {
    id: 'weekly-report',
    label: '🏆 สรุปผลงานสัปดาห์',
    title: '🏆 สรุปผลงานสัญญาณเทรดประจำสัปดาห์ (Weekly Ledger Report)',
    body: 'สรุปผลงานสัญญาณ Nugaom AI VIP สัปดาห์นี้ครับ:\n\n📈 <b>อัตราชนะ (Win Rate):</b> <code>68.4%</code>\n💰 <b>ผลตอบแทนสุทธิ:</b> <code>+14.80 R</code> (+$1,480.00)\n🛡️ <b>Drawdown สูงสุด:</b> <code>3.8%</code> เท่านั้น\n\nขอบคุณสมาชิกทุกท่านที่ยึดมั่นในวินัย ไม่ Overtrade และทำตามแผนล็อคกำไรอย่างสม่ำเสมอครับ 🎉',
  },
];

export default function AdminTelegramVip() {
  const [telegramConfig,setTelegramConfig]=useState(null);
  const [activeTab, setActiveTab] = useState('signals'); // 'signals' | 'announcements' | 'logs'
  const [botStatus, setBotStatus] = useState({ configured: false, loading: true });
  const [selectedSignal, setSelectedSignal] = useState(PRESET_SIGNALS[0]);
  const [pricesReviewed,setPricesReviewed]=useState(false);
  const [stage, setStage] = useState('ENTRY'); // 'ENTRY' | 'LOCK_PROFIT' | 'TP1' | 'TP2'
  
  // Custom Announcement State
  const [announcementTitle, setAnnouncementTitle] = useState(ANNOUNCEMENT_TEMPLATES[0].title);
  const [announcementBody, setAnnouncementBody] = useState(ANNOUNCEMENT_TEMPLATES[0].body);

  // Dispatching state
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);

  useEffect(() => {
    const cfg=readTelegramSettings(window.localStorage);setTelegramConfig(cfg);fetchBotStatus(cfg);
  }, []);

  async function fetchBotStatus(override=null) {
    try {
      setBotStatus(prev => ({ ...prev, loading: true }));
      const res = await fetch('/api/alerts/telegram');
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'BOT_STATUS_UNAVAILABLE');
      setHistoryLogs((data.history||[]).map(log=>({id:log.id,time:new Date(log.created_at).toLocaleTimeString('th-TH'),type:'Telegram',target:log.summary,status:log.status,recipient:'VIP · Message '+(log.message_id||'—')})));
      const cfg=override?.token&&override?.chatId?override:telegramConfig;
      let ownValid=false;
      if(!data.configured&&cfg){const checked=await fetch('/api/alerts/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',...cfg})});const verification=await checked.json();ownValid=checked.ok&&verification.ok;}
      setBotStatus({
        configured: data.configured||ownValid,
        serverConfigured: data.configured,
        hasToken: data.hasToken,
        hasChatId: data.hasChatId,
        chatIdMasked: ownValid?cfg.chatId.slice(0,4)+'***':data.chatIdMasked,
        loading: false,
      });
    } catch {
      setBotStatus({ configured: false, loading: false });
    }
  }

  function handleSelectTemplate(tpl) {
    setAnnouncementTitle(tpl.title);
    setAnnouncementBody(tpl.body);
  }

  async function handleDispatchSignal() {
    if (sending) return;
    if(!pricesReviewed){setToast({type:'err',msg:'กรุณาปรับระดับราคาตามข้อมูลจริงและยืนยันก่อนส่ง'});return;}
    setSending(true);
    setToast(null);

    try {
      const payload = {
        ...(!botStatus.serverConfigured&&telegramConfig?telegramConfig:{}),
        action: 'ea-signal',
        operationId: crypto.randomUUID(),
        eaSignal: {
          ...selectedSignal,
          stage,
          time: Math.floor(Date.now() / 1000),
        },
      };

      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.ok) {
        setToast({ type: 'ok', msg: `🚀 ยิงสัญญาณ ${selectedSignal.symbol} (${stage}) เข้า Telegram VIP สำเร็จเรียบร้อย!` });
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: result.error || 'เกิดข้อผิดพลาดในการส่ง' });
      }
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
    } finally {
      setSending(false);
    }
  }

  async function handleDispatchAnnouncement() {
    if (sending) return;
    setSending(true);
    setToast(null);

    try {
      const payload = {
        ...(!botStatus.serverConfigured&&telegramConfig?telegramConfig:{}),
        action: 'announcement',
        operationId: crypto.randomUUID(),
        title: announcementTitle,
        message: announcementBody,
        author: 'ทีมงาน Nugaom AI VIP',
      };

      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.ok) {
        setToast({ type: 'ok', msg: '📢 บรอดแคสต์ประกาศเข้า Telegram VIP สำเร็จเรียบร้อย!' });
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: result.error || 'เกิดข้อผิดพลาดในการส่ง' });
      }
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.telegramVip}>
      {/* Top HUD Cards */}
      <div className={styles.hudGrid}>
        <div className={styles.hudCard}>
          <div className={styles.hudHead}>
            <span className={styles.hudTitle}>
              <Bot size={15} /> สถานะบอทกระจายสัญญาณ
            </span>
            <span className={styles.pulseLed} />
          </div>
          <div className={styles.hudValue}>
            <span>Nugaom Signal Bot</span>
          </div>
          <span className={styles.hudDesc}>
            {botStatus.configured ? `เชื่อมต่อสำเร็จ · ปลายทาง ${botStatus.chatIdMasked || 'VIP Channel'}` : 'ยังไม่พร้อม · ตรวจ Bot Token / สิทธิ์ปลายทาง'}
          </span>
        </div>

        <div className={styles.hudCard}>
          <div className={styles.hudHead}>
            <span className={styles.hudTitle}>
              <Radio size={15} /> โควตา &amp; ค่าใช้จ่าย
            </span>
          </div>
          <div className={styles.hudValue}>
            <span>Telegram Bot API</span>
          </div>
          <span className={styles.hudDesc}>
            ตรวจผลส่งจริงจาก Message ID · มีข้อจำกัดอัตราการส่ง
          </span>
        </div>

        <div className={styles.hudCard}>
          <div className={styles.hudHead}>
            <span className={styles.hudTitle}>
              <Sparkles size={15} /> โหมดส่งด่วน 1 คลิก
            </span>
          </div>
          <div className={styles.hudValue}>
            <span>{botStatus.configured?'Active & Ready':'รอการตั้งค่า'}</span>
          </div>
          <span className={styles.hudDesc}>
            ก๊อปปี้เทรดใน 15 วินาที พร้อมแผนตัดขาดทุน &amp; ล็อคกำไร (+0.5R)
          </span>
        </div>
      </div>

      {/* Segmented Navigation Bar */}
      <div className={styles.segmentedBar}>
        <button
          className={`${styles.segmentBtn} ${activeTab === 'signals' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('signals'); setToast(null); }}
        >
          <Radio size={16} /> ยิงสัญญาณ Pro Copy EA &amp; ตลาดสด
        </button>
        <button
          className={`${styles.segmentBtn} ${activeTab === 'announcements' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('announcements'); setToast(null); }}
        >
          <Megaphone size={16} /> บรอดแคสต์ประกาศสำคัญ VIP
        </button>
        <button
          className={`${styles.segmentBtn} ${activeTab === 'logs' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('logs'); setToast(null); }}
        >
          <History size={16} /> ประวัติการส่ง ({historyLogs.length})
        </button>
      </div>

      {activeTab==='signals'&&<div className={styles.hudCard}>
        <strong>ระดับราคาสำหรับส่งจริง</strong><p>พรีเซ็ตเป็นค่าตั้งต้น ปรับ Entry / SL / เป้าหมายตามข้อมูลปัจจุบันก่อนส่ง</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{[['entry','Entry'],['stopLoss','Stop Loss'],['lockBuffer','Lock Profit'],['tp1','TP1'],['tp2','TP2']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="any" value={selectedSignal[key]} onChange={e=>{setPricesReviewed(false);setSelectedSignal(v=>({...v,[key]:Number(e.target.value)}));}}/></label>)}</div>
        <label><input type="checkbox" checked={pricesReviewed} onChange={e=>setPricesReviewed(e.target.checked)}/>ตรวจระดับราคาจากข้อมูลจริงแล้ว</label>
      </div>}
      {/* Toast Alert */}
      {toast && (
        <div className={`${styles.statusToast} ${toast.type === 'ok' ? styles.statusToastOk : styles.statusToastErr}`}>
          {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Tab 1: Signals Quick Dispatch */}
      {activeTab === 'signals' && (
        <div className={styles.dispatchCard}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>
                <Radio size={18} color="#22d3ee" /> ส่งสัญญาณเทรดสดเข้า Telegram VIP
              </h3>
              <p className={styles.cardSub}>
                เลือกกลยุทธ์และจังหวะของไม้ (เข้าไม้ใหม่, ล็อคกำไร, ปิด 50% หรือรันเนอร์) เพื่อส่งแจ้งเตือนสมาชิกทันที
              </p>
            </div>
          </div>

          {/* Preset Signal Selector */}
          <div className={styles.presetGrid}>
            {PRESET_SIGNALS.map(sig => (
              <div
                key={sig.id}
                className={`${styles.presetItem} ${selectedSignal.id === sig.id ? styles.presetItemSelected : ''}`}
                onClick={() => {setSelectedSignal(sig);setPricesReviewed(false);}}
              >
                <div className={styles.presetTop}>
                  <span className={styles.symbolBadge}>{sig.symbol}</span>
                  <span className={sig.side === 'BUY' ? styles.sideBadgeLong : styles.sideBadgeShort}>
                    {sig.side}
                  </span>
                </div>
                <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>{sig.name}</strong>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Entry: {sig.entry}</span>
                  <span>SL: {sig.stopLoss}</span>
                  <span style={{ color: '#22d3ee' }}>Lock: {sig.lockBuffer}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Stage Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
              เลือกลำดับสถานะของไม้ที่จะแจ้งเตือน:
            </label>
            <div className={styles.stageSelector}>
              {[
                { id: 'ENTRY', label: '① ⚡ เข้าไม้ใหม่ (ENTRY)', color: '#38bdf8' },
                { id: 'LOCK_PROFIT', label: '② 🛡️ ขยับ SL ล็อคกำไร (+0.5R)', color: '#22d3ee' },
                { id: 'TP1', label: '③ 🎯 ถึงเป้า TP1 (เก็บเงินสด 50%)', color: '#10b981' },
                { id: 'TP2', label: '④ 🏁 ถึงเป้า TP2 Runner (จบรอบ)', color: '#a855f7' },
              ].map(s => (
                <button
                  key={s.id}
                  className={`${styles.stagePill} ${stage === s.id ? styles.stagePillActive : ''}`}
                  onClick={() => setStage(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
              ตัวอย่างข้อความที่สมาชิก VIP จะได้รับใน Telegram:
            </label>
            <div className={styles.previewBox}>
              <span className={styles.previewBadge}>Telegram Preview</span>
              {`🤖 NUGAOM AI · PRO COPY EA STABLE SIGNAL 🤖
────────────────────────
📢 สถานะคำสั่ง: ${stage === 'ENTRY' ? '⚡ เข้าไม้ใหม่ (NEW ENTRY)' : stage === 'LOCK_PROFIT' ? '🛡️ ขยับ SL ล็อคกำไรหน้าทุน (LOCK PROFIT)' : stage === 'TP1' ? '🎯 ถึงเป้าหมาย TP1 (เก็บเงินสด 50%)' : '🏁 ปิดรันเนอร์ TP2 (จบรอบเทรนด์)'}
🏆 สินทรัพย์: #${selectedSignal.symbol}
📐 กลยุทธ์: ${selectedSignal.strategyName}
📊 ทิศทาง: ${selectedSignal.side === 'BUY' ? '🟢 BUY' : '🔴 SELL'}

🎯 ราคาเข้า (Entry): ${selectedSignal.entry}
🛑 ตัดขาดทุน (Initial SL): ${selectedSignal.stopLoss}
🛡️ จุดล็อคทุน (Lock Profit @ +1R): ${selectedSignal.lockBuffer} (+0.5R Buffer)
💰 เป้า 1 (TP1 50%): ${selectedSignal.tp1}
🚀 เป้า 2 (TP2 Runner): ${selectedSignal.tp2}
📦 ขนาด Lot แนะนำ: ${selectedSignal.recommendedLot}
────────────────────────
💡 วิธีปฏิบัติใน 15 วินาที:
${stage === 'ENTRY' ? '1. เปิดแอป MT4/MT5 กรอก Entry, SL, TP1 ตามตัวเลขด้านบน\n2. ตั้งเตือนเมื่อราคาแตะจุด Lock Profit เพื่อเลื่อน SL มากันทุน' : stage === 'LOCK_PROFIT' ? `⚠️ กรุณาขยับ Stop Loss ในแอป MT4/MT5 มาที่ ${selectedSignal.lockBuffer} ทันที ไม้นี้จะกลายเป็น Risk-Free 100%` : 'ปิดทำกำไรตามแผน ปลอดภัยและรักษาวินัย'}`}
            </div>
          </div>

          {/* Action Row */}
          <div className={styles.actionRow}>
            <button
              className={styles.dispatchBtn}
              onClick={handleDispatchSignal}
              disabled={sending}
            >
              <Send size={16} />
              {sending ? 'กำลังส่งเข้า Telegram...' : `🚀 ยิงสัญญาณ ${selectedSignal.symbol} เข้า VIP ทันที`}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Admin Announcements */}
      {activeTab === 'announcements' && (
        <div className={styles.dispatchCard}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>
                <Megaphone size={18} color="#22d3ee" /> บรอดแคสต์ประกาศด่วนเข้าห้อง VIP
              </h3>
              <p className={styles.cardSub}>
                ใช้แจ้งเตือนข่าวกล่องแดง, สรุปตลาดรอบเช้า/เย็น, หรือส่งข้อความสำคัญถึงสมาชิกทุกคน
              </p>
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
              เลือกเทมเพลตข้อความสำเร็จรูป:
            </label>
            <div className={styles.templatePills}>
              {ANNOUNCEMENT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  className={styles.templatePill}
                  onClick={() => handleSelectTemplate(tpl)}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message Inputs */}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                หัวข้อประกาศ:
              </label>
              <input
                className={styles.inputField}
                value={announcementTitle}
                onChange={e => setAnnouncementTitle(e.target.value)}
                placeholder="ระบุหัวข้อประกาศ..."
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                เนื้อหาประกาศ (รองรับแท็ก &lt;b&gt;, &lt;code&gt;):
              </label>
              <textarea
                className={styles.inputField}
                rows={5}
                value={announcementBody}
                onChange={e => setAnnouncementBody(e.target.value)}
                placeholder="พิมพ์เนื้อหาที่ต้องการส่ง..."
              />
            </div>
          </div>

          {/* Action Row */}
          <div className={styles.actionRow}>
            <button
              className={styles.dispatchBtn}
              onClick={handleDispatchAnnouncement}
              disabled={sending || !announcementTitle.trim()}
            >
              <Megaphone size={16} />
              {sending ? 'กำลังบรอดแคสต์...' : '📢 บรอดแคสต์ประกาศเข้า Telegram VIP ทันที'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: History Logs */}
      {activeTab === 'logs' && (
        <div className={styles.dispatchCard}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>
                <History size={18} color="#22d3ee" /> ประวัติการส่งข้อความเข้าห้อง VIP
              </h3>
              <p className={styles.cardSub}>
                บันทึกการส่งสัญญาณและประกาศล่าสุดในเซสชันนี้
              </p>
            </div>
          </div>

          <table className={styles.logTable}>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ประเภท</th>
                <th>เป้าหมาย / หัวข้อ</th>
                <th>ปลายทาง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {historyLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{log.time}</td>
                  <td>
                    <span style={{
                      background: log.type === 'EA Signal' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: log.type === 'EA Signal' ? '#22d3ee' : '#a855f7',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}>
                      {log.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.target}</td>
                  <td style={{ color: '#64748b' }}>{log.recipient}</td>
                  <td>
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                      <CheckCircle2 size={13} /> {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
