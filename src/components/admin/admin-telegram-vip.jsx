'use client';

import { useState, useEffect } from 'react';
import {readTelegramSettings} from '../../notifications/telegram-settings.mjs';
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
  UserMinus,
  UserPlus,
  Copy,
  Check,
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

const MARKET_PLAYBOOK_PRESETS = {
  thai: {
    label: '🇹🇭 หุ้นไทย SET100',
    hashtag: '#หุ้นไทย #SET100',
    envHint: 'TELEGRAM_CHAT_ID_THAI / TELEGRAM_THREAD_ID_THAI',
    picks: [
      { symbol: 'DELTA', entry: 126.5, tp1: 139.5, sl: 120.0, note: 'Stage 2 วอลุ่มเข้าจ่อเบรก' },
      { symbol: 'ADVANC', entry: 281.0, tp1: 305.0, sl: 269.0, note: 'ย่อรับแนวรับ ปันผลแกร่ง' },
      { symbol: 'GULF', entry: 61.5, tp1: 67.5, sl: 58.5, note: 'โครงสร้างขาขึ้นชนะตลาด SET' },
    ],
  },
  dr: {
    label: '🌐 DR80 หุ้นโลก',
    hashtag: '#DR80 #หุ้นต่างประเทศ',
    envHint: 'TELEGRAM_CHAT_ID_DR / TELEGRAM_THREAD_ID_DR',
    picks: [
      { symbol: 'NVDA80', entry: 43.8, tp1: 49.5, sl: 41.8, note: 'Fair Value สอดคล้องหุ้นแม่ NASDAQ' },
      { symbol: 'AAPL80', entry: 30.8, tp1: 34.8, sl: 29.5, note: 'สะสมโซนรับปลอดภัย' },
      { symbol: 'BABA80', entry: 5.35, tp1: 6.25, sl: 4.95, note: 'Discount ถูกกว่าหุ้นแม่ฮ่องกง' },
    ],
  },
  tfex: {
    label: '⚡ TFEX & SET50',
    hashtag: '#TFEX #S50 #GO',
    envHint: 'TELEGRAM_CHAT_ID_TFEX / TELEGRAM_THREAD_ID_TFEX',
    picks: [
      { symbol: 'S50Z26', entry: 912.5, tp1: 924.0, sl: 906.5, note: 'LONG ยืนเหนือแนวรับโครงสร้าง 15m/1H' },
      { symbol: 'GOZ26', entry: 2722.0, tp1: 2748.0, sl: 2709.0, note: 'Gold Online Futures ย่อรับตามเทรนด์' },
    ],
  },
  us: {
    label: '🇺🇸 หุ้นอเมริกา US',
    hashtag: '#USStocks #Stage2 #Dime',
    envHint: 'TELEGRAM_CHAT_ID_US / TELEGRAM_THREAD_ID_US',
    picks: [
      { symbol: 'NVDA', entry: 138.0, tp1: 156.0, sl: 129.0, note: 'Stage 2 Leader · ตั้ง GTC 19:30 น.' },
      { symbol: 'PLTR', entry: 61.5, tp1: 71.0, sl: 56.8, note: 'High RS Momentum · Dime! Fractional' },
    ],
  },
  forex: {
    label: '🥇 Forex & Gold',
    hashtag: '#XAUUSD #Forex #ProCopyEA',
    envHint: 'TELEGRAM_CHAT_ID_FOREX / TELEGRAM_THREAD_ID_FOREX',
    picks: [
      { symbol: 'XAUUSD', entry: 2724.5, tp1: 2742.0, sl: 2712.0, note: 'Gold London/NY Pullback · 2R' },
      { symbol: 'EURUSD', entry: 1.0845, tp1: 1.0875, sl: 1.0825, note: 'Dynamic Envelope Rebound' },
    ],
  },
};

export default function AdminTelegramVip() {
  const [telegramConfig,setTelegramConfig]=useState(null);
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'signals' | 'announcements' | 'members' | 'logs'
  const [botStatus, setBotStatus] = useState({ configured: false, loading: true });
  const [selectedSignal, setSelectedSignal] = useState(PRESET_SIGNALS[0]);
  const [pricesReviewed,setPricesReviewed]=useState(false);
  const [stage, setStage] = useState('ENTRY'); // 'ENTRY' | 'LOCK_PROFIT' | 'TP1' | 'TP2'
  const [playbookCategory, setPlaybookCategory] = useState('thai');
  const [playbookRound, setPlaybookRound] = useState('morning_0930');
  const [topicThreadId, setTopicThreadId] = useState('');
  
  // Custom Announcement State
  const [announcementTitle, setAnnouncementTitle] = useState(ANNOUNCEMENT_TEMPLATES[0].title);
  const [announcementBody, setAnnouncementBody] = useState(ANNOUNCEMENT_TEMPLATES[0].body);

  // Member Management & Auto-Kick State
  const [inviteMemberName, setInviteMemberName] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const [kickUserId, setKickUserId] = useState('');
  const [kickingMember, setKickingMember] = useState(false);

  const [batchKickInput, setBatchKickInput] = useState('');
  const [batchKicking, setBatchKicking] = useState(false);

  // Dispatching state
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);

  async function handleGenerateInvite() {
    if (generatingInvite) return;
    setGeneratingInvite(true);
    setToast(null);
    try {
      const payload = {
        action: 'create-invite',
        memberName: inviteMemberName.trim() || 'VIP Member',
        memberLimit: 1,
        ...(!botStatus.serverConfigured && telegramConfig ? telegramConfig : {}),
      };
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.inviteLink) {
        setCreatedInviteLink(data.inviteLink);
        setToast({ type: 'ok', msg: `🎉 สร้าง One-Time Invite Link 1 สิทธิ์สำเร็จ: ${data.inviteLink}` });
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: data.error || 'สร้างลิงก์ไม่สำเร็จ' });
      }
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function handleKickMember() {
    if (kickingMember || !kickUserId.trim()) return;
    if (!confirm(`ยืนยันการเตะ Telegram User ID: ${kickUserId} ออกจากกลุ่ม VIP? (บอทจะสั่งเตะออก แต่ไม่แบนถาวร)`)) return;
    setKickingMember(true);
    setToast(null);
    try {
      const payload = {
        action: 'kick-member',
        userId: kickUserId.trim(),
        ...(!botStatus.serverConfigured && telegramConfig ? telegramConfig : {}),
      };
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ type: 'ok', msg: `✅ เตะสมาชิก User ID: ${kickUserId} ออกจากกลุ่ม VIP เรียบร้อยแล้ว (ไม่แบนถาวร)` });
        setKickUserId('');
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: data.error || 'เตะสมาชิกไม่สำเร็จ' });
      }
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
    } finally {
      setKickingMember(false);
    }
  }

  async function handleBatchKick() {
    if (batchKicking) return;
    const userIds = batchKickInput.split(/[\n, ]+/).map(s => s.trim()).filter(Boolean);
    if (!userIds.length) {
      setToast({ type: 'err', msg: 'กรุณาระบุ Telegram User ID อย่างน้อย 1 รายการ' });
      return;
    }
    if (!confirm(`ยืนยันการเตะสมาชิกหมดโปร ${userIds.length} คนออกจากกลุ่ม VIP?`)) return;
    setBatchKicking(true);
    setToast(null);
    try {
      const payload = {
        action: 'auto-kick-expired',
        userIds,
        ...(!botStatus.serverConfigured && telegramConfig ? telegramConfig : {}),
      };
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ type: 'ok', msg: `✅ สั่งบอทเตะสมาชิกหมดโปรสำเร็จ ${data.kickedCount} / ${userIds.length} คน` });
        setBatchKickInput('');
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: data.error || 'ทำรายการไม่สำเร็จ' });
      }
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
    } finally {
      setBatchKicking(false);
    }
  }

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

  async function handleDispatchPlaybook() {
    if (sending) return;
    setSending(true);
    setToast(null);
    const preset = MARKET_PLAYBOOK_PRESETS[playbookCategory] || MARKET_PLAYBOOK_PRESETS.thai;
    try {
      const payload = {
        ...(!botStatus.serverConfigured && telegramConfig ? telegramConfig : {}),
        action: 'market-playbook',
        operationId: crypto.randomUUID(),
        category: playbookCategory,
        round: playbookRound,
        picks: preset.picks,
        topicThreadId: topicThreadId ? Number(topicThreadId) : null,
      };
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.ok) {
        setToast({
          type: 'ok',
          msg: `🚀 ส่งโพย [${preset.label}] รอบ ${playbookRound === 'morning_0930' ? '09:30 น.' : playbookRound === 'afternoon_1330' ? '13:30 น.' : '17:30 น.'} เข้า Telegram VIP สำเร็จ!`,
        });
        await fetchBotStatus();
      } else {
        setToast({ type: 'err', msg: result.error || 'ส่งโพยแยกหมวดหมู่ไม่สำเร็จ' });
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
          className={`${styles.segmentBtn} ${activeTab === 'categories' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('categories'); setToast(null); }}
        >
          <Target size={16} /> แยกหมวดหมู่โพย (หุ้นไทย · DR · TFEX · US · Forex)
        </button>
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
          className={`${styles.segmentBtn} ${activeTab === 'members' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('members'); setToast(null); }}
        >
          <UserMinus size={16} /> สมาชิก VIP &amp; ระบบเตะคนหมดโปร (Auto-Kick)
        </button>
        <button
          className={`${styles.segmentBtn} ${activeTab === 'logs' ? styles.segmentBtnActive : ''}`}
          onClick={() => { setActiveTab('logs'); setToast(null); }}
        >
          <History size={16} /> ประวัติการส่ง ({historyLogs.length})
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className={styles.dispatchCard}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>
                <Target size={18} color="#34d399" /> ระบบแยกหมวดหมู่แจ้งเตือน Telegram (หุ้นไทย · DR80 · TFEX · US · Forex)
              </h3>
              <p className={styles.cardSub}>
                จำแนกหมวดหมู่ได้ 3 รูปแบบพร้อมกัน: ① ป้ายหัวข้อ + Hashtag อัตโนมัติ (<code>#หุ้นไทย</code>, <code>#DR80</code>, <code>#TFEX</code>) · ② แยก Topic ในห้อง Supergroup เดียว (<code>message_thread_id</code>) · ③ แยกห้องแชทตามตลาด (<code>TELEGRAM_CHAT_ID_THAI</code> / <code>_DR</code> / <code>_TFEX</code>)
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.45rem', fontWeight: 600 }}>
              1. เลือกหมวดหมู่ตลาดที่ต้องการส่งโพย:
            </label>
            <div className={styles.stageSelector}>
              {Object.entries(MARKET_PLAYBOOK_PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.stagePill} ${playbookCategory === key ? styles.stagePillActive : ''}`}
                  onClick={() => setPlaybookCategory(key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.45rem', fontWeight: 600 }}>
              2. เลือกรอบเวลาแจ้งเตือนประจำวัน (09:30 · 13:30 · 17:30 น.):
            </label>
            <div className={styles.stageSelector}>
              {[
                { id: 'morning_0930', label: '🌅 09:30 น. โพยเช้า (เช้านี้เล่นอะไรดี?)' },
                { id: 'afternoon_1330', label: '☀️ 13:30 น. โพยบ่าย (บ่ายนี้เล่นอะไรดี?)' },
                { id: 'evening_1730', label: '🌙 17:30 น. หุ้นการบ้านเย็นนี้ (เฝ้าพรุ่งนี้)' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`${styles.stagePill} ${playbookRound === r.id ? styles.stagePillActive : ''}`}
                  onClick={() => setPlaybookRound(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Topic Thread ID (สำหรับกลุ่มเปิด Topics · เว้นว่างเพื่อส่งห้องหลัก):</span>
              <input
                type="number"
                min="1"
                placeholder="เช่น 2, 5, 8"
                value={topicThreadId}
                onChange={(e) => setTopicThreadId(e.target.value)}
                style={{ width: '120px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#fff', border: 'none' }}
              />
            </label>
            <small style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
              ENV แยกห้อง/Topic อัตโนมัติ: <code>{MARKET_PLAYBOOK_PRESETS[playbookCategory]?.envHint}</code>
            </small>
          </div>

          <div className={styles.previewBox} style={{ marginBottom: '14px' }}>
            <span className={styles.previewBadge}>Preview · {MARKET_PLAYBOOK_PRESETS[playbookCategory]?.label}</span>
            {`📣 [${MARKET_PLAYBOOK_PRESETS[playbookCategory]?.label}]
${playbookRound === 'morning_0930' ? '🌅 รอบเช้า 09:30 น. · เช้านี้เล่นอะไรดี?' : playbookRound === 'afternoon_1330' ? '☀️ รอบบ่าย 13:30 น. · บ่ายนี้เล่นอะไรดี?' : '🌙 รอบเย็น 17:30 น. · หุ้นการบ้านเฝ้าพรุ่งนี้'}
────────────────────────
${(MARKET_PLAYBOOK_PRESETS[playbookCategory]?.picks || []).map((p, i) => `${i + 1}. #${p.symbol} (${p.note})\n   🟢 แนวรับ/จุดเข้า: ${p.entry} | 🎯 TP1: ${p.tp1} | 🔴 จุดคัท SL: ${p.sl}`).join('\n')}
────────────────────────
🏷️ หมวดหมู่: ${MARKET_PLAYBOOK_PRESETS[playbookCategory]?.hashtag}`}
          </div>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.dispatchBtn}
              onClick={handleDispatchPlaybook}
              disabled={sending}
            >
              <Send size={16} />
              {sending ? 'กำลังส่งเข้า Telegram...' : `🚀 ส่งโพย ${MARKET_PLAYBOOK_PRESETS[playbookCategory]?.label} เข้า Telegram ทันที`}
            </button>
          </div>
        </div>
      )}

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

      {/* Tab: VIP Membership Access & Auto-Kick */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Generate 1-Time VIP Invite Link */}
          <div className={styles.dispatchCard}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.cardTitle}>
                  <UserPlus size={18} color="#22d3ee" /> สร้างลิงก์เข้ากลุ่ม VIP เฉพาะคน (One-Time Invite Link)
                </h3>
                <p className={styles.cardSub}>
                  สร้างลิงก์เชิญเข้ากลุ่มแบบจำกัด 1 สิทธิ์ (Member Limit: 1) ลิงก์จะหมดอายุทันทีเมื่อมีคนกดเข้า 1 คน ป้องกันการแอบนำไปแชร์ต่อ
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '240px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                  ชื่อสมาชิก / รหัสลูกค้า / หมายเหตุ
                </label>
                <input
                  type="text"
                  placeholder="เช่น สมชาย ใจดี (Pro 399฿)"
                  value={inviteMemberName}
                  onChange={e => setInviteMemberName(e.target.value)}
                  className={styles.inputField}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                type="button"
                className={styles.dispatchBtn}
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '10px 18px' }}
                disabled={generatingInvite || !botStatus.configured}
                onClick={handleGenerateInvite}
              >
                <UserPlus size={16} /> {generatingInvite ? 'กำลังสร้างลิงก์…' : 'สร้างลิงก์ 1 สิทธิ์'}
              </button>
            </div>

            {createdInviteLink && (
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase' }}>
                    🎉 ONE-TIME INVITE LINK พร้อมใช้งาน:
                  </span>
                  <code style={{ fontSize: '0.9rem', color: '#38bdf8', wordBreak: 'break-all' }}>{createdInviteLink}</code>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={styles.dispatchBtn}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', background: copiedLink ? '#059669' : '#334155' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(createdInviteLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                  </button>
                  <a
                    href={createdInviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.dispatchBtn}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ExternalLink size={14} /> เปิด Telegram
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Auto-Kick Expired Member */}
          <div className={styles.dispatchCard}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.cardTitle}>
                  <UserMinus size={18} color="#f43f5e" /> สั่งบอทเตะสมาชิกหมดโปร (Auto-Kick Desk)
                </h3>
                <p className={styles.cardSub}>
                  เตะสมาชิกที่ขาดต่ออายุออกจากกลุ่ม VIP ทันที โดยใช้ระบบ <code>banChatMember</code> และ <code>unbanChatMember</code> เพื่อไม่ให้เป็นการแบนถาวร (สมาชิกสามารถกลับเข้ากลุ่มได้เมื่อต่ออายุใหม่)
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '240px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                  Telegram User ID ของสมาชิกที่ต้องการเตะ
                </label>
                <input
                  type="text"
                  placeholder="เช่น 123456789 (ตัวเลข User ID ของ Telegram)"
                  value={kickUserId}
                  onChange={e => setKickUserId(e.target.value)}
                  className={styles.inputField}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                type="button"
                className={styles.dispatchBtn}
                style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', padding: '10px 18px' }}
                disabled={kickingMember || !kickUserId.trim() || !botStatus.configured}
                onClick={handleKickMember}
              >
                <UserMinus size={16} /> {kickingMember ? 'กำลังเตะ…' : 'เตะออกจากกลุ่ม VIP'}
              </button>
            </div>

            <div style={{ marginTop: '14px', padding: '12px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.45)', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>
              💡 <strong>หลักการทำงานของบอท:</strong> บอทจะทำการแบนและปลดแบนในเสี้ยววินาที ทำให้สมาชิกหลุดออกจากกลุ่ม VIP ทันที แต่จะไม่ติด Blacklist ในกลุ่ม ทำให้สามารถใช้ลิงก์ใหม่กลับเข้ามาได้ทันทีเมื่อชำระเงินต่ออายุในรอบถัดไป
            </div>
          </div>

          {/* Card 3: Batch Kick Expired Members */}
          <div className={styles.dispatchCard}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.cardTitle}>
                  <UserMinus size={18} color="#f59e0b" /> เตะสมาชิกหมดโปรแบบชุด (Batch Auto-Kick)
                </h3>
                <p className={styles.cardSub}>
                  วางรายการ Telegram User ID ของสมาชิกที่หมดโปรหลายคนพร้อมกัน (คั่นด้วยบรรทัดใหม่หรือเครื่องหมายจุลภาค)
                </p>
              </div>
            </div>

            <div>
              <textarea
                rows={3}
                placeholder="100123456&#10;100654321&#10;100987654"
                value={batchKickInput}
                onChange={e => setBatchKickInput(e.target.value)}
                className={styles.inputField}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={styles.dispatchBtn}
                  style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', padding: '10px 18px' }}
                  disabled={batchKicking || !batchKickInput.trim() || !botStatus.configured}
                  onClick={handleBatchKick}
                >
                  <UserMinus size={16} /> {batchKicking ? 'กำลังเตะเป็นชุด…' : 'เตะสมาชิกที่หมดโปรทั้งหมด'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: History Logs */}
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
