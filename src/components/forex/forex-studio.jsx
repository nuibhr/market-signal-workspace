"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  CircleHelp,
  RotateCcw,
  ChevronRight,
  Save,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Radio,
  Target,
  ShieldAlert,
  Zap,
  Lock,
  Heart,
} from "lucide-react";
import CandlestickChart from "../candlestick-chart.jsx";
import SwarmDebate from "./swarm-debate.jsx";
import { runSwarmDebate } from "./swarm-engine.mjs";
import { analyzeCandles } from "../../analysis/technical.mjs";
import { demoBars } from "./terminal-demo.mjs";
import { resolveInitialInstrument } from "./symbol-universe.mjs";
import {
  calculateStudioPlan,
  planPriceLines,
  readPracticePlans,
  writePracticePlans,
  INITIAL_PRACTICE_PLAN,
  calculateAutoTarget,
  calculateAutoStop,
  invertPlanSide,
  detectChartSetup,
  formatPlanBrief,
  checkPlanHit,
} from "./studio-plan.mjs";
import styles from "./forex-studio.module.css";

const initialInstrument = resolveInitialInstrument("XAU/USD");
const INITIAL_VISIBLE = 60;

const COMPANION_TIPS = [
  {
    icon: "📊",
    status: "วิเคราะห์กราฟ 15m",
    text: "ยินดีต้อนรับสู่ห้องฝึกเทรดทองครับ! วินัยและ Stop Loss สำคัญที่สุด อย่าลืมเช็ค Risk/Reward ก่อนเปิดไม้นะครับ 🎯",
  },
  {
    icon: "🤖",
    status: "สภา AI Swarm 6 ตัว",
    text: "ลองสลับไปแท็บ '6 AI Swarm' ดูสิครับ บอททั้ง 6 กำลังโต้เถียงทิศทางทองกันสดๆ แนะนำดูข้อโต้แย้งของ PRIOR ด้วยนะ!",
  },
  {
    icon: "🎯",
    status: "กลยุทธ์ R:R",
    text: "คำนวณ R:R อย่างน้อย 1:2 เสมอครับ เสี่ยง 1 ส่วนเพื่อกำไร 2 ส่วน แค่ชนะ 40% พอร์ตก็เติบโตอย่างมั่นคงแล้วครับ 📈",
  },
  {
    icon: "⚡",
    status: "เฝ้าระวังข่าว 21:00",
    text: "คืนนี้มี Flash PMI สหรัฐฯ 21:00 น. ช่วงมีข่าวราคามักกระชากและสเปรดกว้าง แนะนำลด Lot หรือรอแท่งปิดนิ่งก่อนครับ ⚠️",
  },
  {
    icon: "🛡️",
    status: "คุมอารมณ์และจิตวิทยา",
    text: "ถ้าตกรถ ห้าม FOMO ไล่ราคาเด็ดขาด! รอ Retest แนวรับ-ต้าน สบายใจและได้แต้มต่อ (Edge) สูงกว่าเยอะครับ",
  },
  {
    icon: "🧘",
    status: "ทักษะการรอคอย",
    text: "ไม่จำเป็นต้องมีออเดอร์ตลอดเวลาครับ การนั่งทับมือรอจังหวะคมๆ ก็คือหนึ่งในกลยุทธ์ของนักเทรดมืออาชีพ",
  },
  {
    icon: "📈",
    status: "โซนปะทะทองคำ",
    text: "Buy Zone วันนี้อยู่แถว $2,645 - $2,648 เป็นจุดสปริงตัวสวย หากแตะแนวแล้วมีสัญญาณ Price Action ค่อยพิจารณาครับ",
  },
  {
    icon: "💡",
    status: "เทคนิคเก็บกำไร",
    text: "แบ่งปิดกำไร (Partial TP) ที่ระยะ 1R หรือ TP1 แล้วเลื่อน SL มาบังทุน จะช่วยให้เทรดได้อย่างสบายใจไร้ความกดดันครับ 💎",
  },
  {
    icon: "💚",
    status: "ให้กำลังใจ",
    text: "การคัตลอสตามแผนไม่ใช่เรื่องน่าอาย แต่คือการปกป้องทุน รักษาวินัยไว้เสมอ น้องนักออมเป็นกำลังใจให้พี่ๆ ทุกคนครับ! ✨",
  },
  {
    icon: "✦",
    status: "จิ้มเพื่อคุยต่อ",
    text: "แตะที่ตัวผมหรือกล่องข้อความได้เรื่อยๆ เลยนะ! ผมมีทริกและกำลังใจดีๆ เตรียมไว้แชร์ให้อีกเพียบเลยครับ 💬",
  },
];

function NugaomVector({ isJumping }) {
  return (
    <svg
      className={`${styles.mascot} ${isJumping ? styles.mascotJumping : ""}`}
      viewBox="0 0 100 128"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="50"
        cy="123"
        rx="26"
        ry="4"
        fill="#041a24"
        opacity="0.3"
        className={styles.mascotShadow}
      />
      <g className={styles.nugaomCharacterBody}>
        <path
          d="M33 94 29 116 46 118 50 102 54 118 71 116 67 94"
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth="2"
        />
        <path d="M31 90q19-10 38 0l-3 20H34z" fill="#0f766e" />
        <path d="m40 87 10 16 10-16" fill="#f0fdf4" />
        <path d="m47 92 3 5 3-5-3-4z" fill="#f59e0b" />
        <g className={styles.nugaomCharacterWave}>
          <path
            d="M65 94q14-5 13-19"
            stroke="#0f766e"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <ellipse
            cx="78"
            cy="72"
            rx="7"
            ry="9"
            fill="#ffd0b4"
            stroke="#b47a61"
            strokeWidth="1.5"
          />
          <path
            d="m75 66-1-6m5 5 1-7"
            stroke="#ffd0b4"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M33 94q-8 6-5 13"
          stroke="#0f766e"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <rect
          x="18"
          y="88"
          width="24"
          height="20"
          rx="3"
          fill="#064e3b"
          stroke="#10b981"
          strokeWidth="1.5"
          transform="rotate(-8 30 98)"
        />
        <line
          x1="22"
          y1="94"
          x2="22"
          y2="101"
          stroke="#10b981"
          strokeWidth="1"
        />
        <rect x="21" y="96" width="2" height="3" fill="#34d399" />
        <line
          x1="27"
          y1="92"
          x2="27"
          y2="99"
          stroke="#10b981"
          strokeWidth="1"
        />
        <rect x="26" y="93" width="2" height="4" fill="#34d399" />
        <line
          x1="32"
          y1="90"
          x2="32"
          y2="98"
          stroke="#fbbf24"
          strokeWidth="1"
        />
        <rect x="31" y="91" width="2" height="3" fill="#f59e0b" />
        <circle cx="34" cy="99" r="4" fill="#4f9c65" opacity="0.3" />
        <ellipse cx="25" cy="107" rx="5.5" ry="4.5" fill="#ffd0b4" />
        <path
          d="M17 45C9 13 36 5 52 10c22-6 40 17 32 38"
          fill="#451a03"
          stroke="#291205"
          strokeWidth="2"
        />
        <ellipse cx="17" cy="57" rx="8" ry="10" fill="#ffc5aa" />
        <ellipse cx="83" cy="57" rx="8" ry="10" fill="#ffc5aa" />
        <ellipse cx="17" cy="57" rx="4" ry="6" fill="#fca5a5" opacity="0.6" />
        <ellipse cx="83" cy="57" rx="4" ry="6" fill="#fca5a5" opacity="0.6" />
        <path
          d="M18 41q32-31 64 0v21c0 38-64 38-64 0z"
          fill="#ffd0b4"
          stroke="#bf8870"
          strokeWidth="1.5"
        />
        <path
          d="M17 46c-7-34 21-42 36-36 25-4 38 16 30 38-13-5-20-16-24-25-7 17-28 21-42 23"
          fill="#5a230b"
        />
        <path
          d="M24 26q10-11 25-10"
          stroke="#8a4422"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <g className={styles.nugaomCharacterEyes}>
          <ellipse cx="35" cy="55" rx="5.5" ry="7.5" fill="#18181b" />
          <ellipse cx="65" cy="55" rx="5.5" ry="7.5" fill="#18181b" />
          <circle cx="37" cy="52" r="2" fill="white" />
          <circle cx="67" cy="52" r="2" fill="white" />
          <circle cx="33" cy="57" r="1" fill="white" opacity="0.8" />
          <circle cx="63" cy="57" r="1" fill="white" opacity="0.8" />
        </g>
        <circle cx="34" cy="55" r="14.5" stroke="#0f172a" strokeWidth="3.2" />
        <circle cx="66" cy="55" r="14.5" stroke="#0f172a" strokeWidth="3.2" />
        <path d="M48.5 54.5h3M18 51l-5-2m69 2 5-2" stroke="#0f172a" strokeWidth="3" />
        <path
          d="M26 49 L32 59"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M58 49 L64 59"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse cx="26" cy="71" rx="7" ry="3.5" fill="#f87171" opacity="0.75" />
        <ellipse cx="74" cy="71" rx="7" ry="3.5" fill="#f87171" opacity="0.75" />
        {isJumping ? (
          <g>
            <path
              d="M42 71 Q50 82 58 71 Z"
              fill="#be123c"
              stroke="#881337"
              strokeWidth="1.5"
            />
            <path
              d="M46 76 Q50 73 54 76 Q50 79 46 76"
              fill="#fda4af"
            />
          </g>
        ) : (
          <path
            d="M42 73q8 6 16 0"
            stroke="#991b1b"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  );
}

function Mascot() {
  const [tipIndex, setTipIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [particles, setParticles] = useState([]);
  const [likes, setLikes] = useState(12);
  const [speaking, setSpeaking] = useState(false);

  const currentTip = COMPANION_TIPS[tipIndex];

  const handleNextTip = (e) => {
    if (e) e.stopPropagation();
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 450);

    playChime("mascot");

    const emojis = ["✨", "💡", "🎯", "📈", "💛", "✦", "+1R"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const pId = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 30) - 15;
    setParticles((prev) => [...prev.slice(-3), { id: pId, emoji, x }]);

    setTipIndex((prev) => (prev + 1) % COMPANION_TIPS.length);
  };

  const handleHeart = (e) => {
    if (e) e.stopPropagation();
    setLikes((l) => l + 1);
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 450);
    playChime("tp");
    const pId = Date.now() + Math.random();
    setParticles((prev) => [...prev.slice(-3), { id: pId, emoji: "❤️", x: 5 }]);
  };

  const handleSpeak = (e) => {
    if (e) e.stopPropagation();
    setSpeaking(true);
    speakThai(currentTip.text);
    setTimeout(() => setSpeaking(false), 2500);
  };

  return (
    <div className={styles.hostPod}>
      <button
        type="button"
        className={styles.mascotStage}
        onClick={handleNextTip}
        title="แตะที่ตัวน้องนักออมเพื่อขอทริกเทรดทองคำใหม่"
        aria-label="น้องนักออม เพื่อนร่วมทาง AI แตะเพื่อขอเคล็ดลับเทรด"
      >
        <div className={styles.mascotAura} />
        <NugaomVector isJumping={isJumping} />
        {particles.map((p) => (
          <span
            key={p.id}
            className={styles.particle}
            style={{ left: `calc(50% + ${p.x}px)` }}
          >
            {p.emoji}
          </span>
        ))}
        <span className={styles.touchHint}>แตะผมสิ 👆</span>
      </button>

      <div
        className={styles.companionBubble}
        onClick={handleNextTip}
        title="คลิกเพื่อสลับคำแนะนำถัดไป"
      >
        <div className={styles.companionHeader}>
          <div className={styles.companionIdentity}>
            <div>
              <strong>น้องนักออม</strong>
              <small>เพื่อนร่วมทางในห้องฝึก</small>
            </div>
            <span className={styles.companionBadge}>AI Companion</span>
          </div>
          <span className={styles.companionStatus}>
            <span className={styles.companionStatusDot} />
            {currentTip.status}
          </span>
        </div>

        <div className={styles.companionQuote} aria-live="polite">
          <p>{currentTip.text}</p>
        </div>

        <div className={styles.companionActions}>
          <button
            type="button"
            className={styles.companionActionBtn}
            onClick={handleNextTip}
            title="แตะเพื่อสลับทริกถัดไป"
          >
            <RotateCcw size={11} />
            <span>ทริกถัดไป ({tipIndex + 1}/{COMPANION_TIPS.length})</span>
          </button>
          <div className={styles.companionRightActions}>
            <button
              type="button"
              className={styles.companionActionBtn}
              onClick={handleSpeak}
              title="ฟังเสียงน้องนักออมอ่านข้อความ"
            >
              <Volume2 size={11} className={speaking ? styles.pulseIcon : ""} />
              <span>{speaking ? "กำลังอ่าน..." : "ฟังเสียง"}</span>
            </button>
            <button
              type="button"
              className={styles.companionHeartBtn}
              onClick={handleHeart}
              title="กดให้กำลังใจน้องนักออม"
            >
              <Heart size={11} fill="currentColor" />
              <span>{likes}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const display = (number, digits = 2) =>
  Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: digits })
    : "—";

function playChime(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "tp") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === "sl") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(329.63, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "mascot") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {}
}

function speakThai(text) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {}
}

export default function ForexStudio() {
  const [timeframe, setTimeframe] = useState("1h");
  const [liveCandles, setLiveCandles] = useState(null);
  const candles = useMemo(
    () => (Array.isArray(liveCandles) && liveCandles.length >= 25 ? liveCandles : demoBars(initialInstrument, timeframe)),
    [liveCandles, timeframe],
  );

  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [studioTab, setStudioTab] = useState("swarm");
  const [swarmTrigger, setSwarmTrigger] = useState(0);
  const [showMobileStickyVip, setShowMobileStickyVip] = useState(true);
  const [hitBanner, setHitBanner] = useState(null);
  const [coachPlanMeta, setCoachPlanMeta] = useState(null);
  const [liveCoachNotice, setLiveCoachNotice] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveTick, setLiveTick] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);
  const [liveBacktest, setLiveBacktest] = useState(null);

  const [plan, setPlan] = useState(INITIAL_PRACTICE_PLAN);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPlans(readPracticePlans());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof fetch !== "function") return;
    const controller = new AbortController();
    fetch(`/api/forex/studio/plans?candles=1&symbol=XAU/USD&timeframe=${encodeURIComponent(timeframe)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (controller.signal.aborted || !data || !Array.isArray(data.bars) || data.bars.length < 25) return;
        setLiveCandles(data.bars);
        setVisible(data.bars.length);
        if (data.backtest && typeof data.backtest === "object") {
          setLiveBacktest(data.backtest);
        }
        if (Number.isFinite(data.price)) {
          setLiveTick({ symbol: "XAU/USD", price: data.price, status: "live_market" });
        }
        if (data.plan?.entry && data.plan?.stop && data.plan?.target) {
          setPlan((current) => ({
            ...current,
            title: data.plan.title || current.title,
            side: data.plan.side || current.side,
            entry: String(data.plan.entry),
            stop: String(data.plan.stop),
            target: String(data.plan.target),
            condition: data.plan.condition || current.condition,
          }));
          setCoachPlanMeta({
            coach: data.plan.coach || "น้องนักออม AI · Yahoo Finance Live",
            syncedAt: data.plan.updatedAt || data.asOf || new Date().toISOString(),
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [timeframe]);

  // EventSource Live Feed Connection
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    let es;
    try {
      es = new EventSource("/api/forex/studio/stream");
      es.onopen = () => setLiveConnected(true);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "tick") {
            setLiveTick(payload);
          } else if (payload.type === "coach_plan" && payload.plan) {
            setLiveCoachNotice(payload.plan);
            setCoachPlanMeta({
              coach: payload.plan.coach,
              syncedAt: payload.plan.updatedAt || new Date().toISOString(),
            });
            if (soundEnabled) {
              playChime("tp");
              speakThai("มีแผนวิเคราะห์สดใหม่จากโค้ชค่ะ");
            }
          }
        } catch {}
      };
      es.onerror = () => {
        setLiveConnected(false);
      };
    } catch {
      setLiveConnected(false);
    }
    return () => {
      es?.close();
    };
  }, [soundEnabled]);

  const bars = useMemo(() => candles.slice(0, visible), [candles, visible]);
  const analysis = useMemo(() => {
    if (!bars || bars.length < 50) return null;
    return analyzeCandles(
      bars,
      null,
      timeframe === "15m" ? "15 นาที" : "1 ชั่วโมง",
      { timeframe },
    );
  }, [bars, timeframe]);
  const priceLines = useMemo(
    () => planPriceLines(plan),
    [plan.entry, plan.stop, plan.target],
  );
  const result = useMemo(() => calculateStudioPlan(plan), [plan]);
  const swarmDebateData = useMemo(() => {
    return runSwarmDebate(bars, timeframe, plan.balance);
  }, [bars, timeframe, plan.balance, swarmTrigger]);

  const update = (name, value) => {
    setPlan((current) => ({ ...current, [name]: value }));
    setMessage("");
    setHitBanner(null);
  };

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf);
    setVisible(INITIAL_VISIBLE);
    setIsPlaying(false);
    setHitBanner(null);
    setActiveSetup(null);
    setMessage(
      `⏱️ สลับกรอบเวลาเป็น ${
        tf === "15m" ? "15 นาที (Daytrade)" : "1 ชั่วโมง (Intraday Structure)"
      }`,
    );
  };

  // Replay Automation Loop
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = Math.max(120, Math.floor(1000 / speed));
    const timer = setInterval(() => {
      setVisible((currentVisible) => {
        if (currentVisible >= candles.length) {
          setIsPlaying(false);
          return currentVisible;
        }
        const next = currentVisible + 1;
        const currentBar = candles[next - 1];
        const hit = checkPlanHit(plan, currentBar);

        if (hit.tpHit) {
          setHitBanner({
            type: "tp",
            text: `🎯 ชนเป้าหมาย Take Profit ($${plan.target}) แล้วค่ะ! (+${
              result.rewardRatio ? result.rewardRatio.toFixed(1) : 2
            }R)`,
          });
          if (soundEnabled) {
            playChime("tp");
            speakThai("ถึงเป้าหมายกำไรแล้วค่ะ");
          }
          setIsPlaying(false);
        } else if (hit.slHit) {
          setHitBanner({
            type: "sl",
            text: `🛑 ชนจุดตัดขาดทุน Stop Loss ($${plan.stop}) ให้ทบทวนความเสี่ยง`,
          });
          if (soundEnabled) {
            playChime("sl");
            speakThai("ชนจุดตัดขาดทุนค่ะ ให้ทบทวนแผน");
          }
          setIsPlaying(false);
        } else if (hit.entryHit) {
          setHitBanner({
            type: "entry",
            text: `⚡ แท่งนี้ผ่านจุดเข้า Entry ($${plan.entry}) แล้ว!`,
          });
          if (soundEnabled) playChime("entry");
        }
        return next;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isPlaying, speed, plan, soundEnabled, result.rewardRatio, candles]);

  const handleSideSwitch = (nextSide) => {
    const inverted = invertPlanSide(plan, nextSide);
    setPlan(inverted);
    setMessage("");
  };

  const handleAutoTarget = (rr) => {
    const target = calculateAutoTarget(plan, rr);
    if (target) {
      update("target", target);
      setMessage(`🎯 ล็อกเป้าหมาย ${rr}R ($${target}) อัตโนมัติ`);
    } else {
      setMessage("กรอก Entry และ SL ก่อนเพื่อคำนวณเป้าหมาย R อัตโนมัติ");
    }
  };

  const handleAutoStop = () => {
    const currentBar = bars.at(-1);
    const stop = calculateAutoStop(plan, currentBar);
    if (stop) {
      update("stop", stop);
      setMessage(`🛡️ ตั้งจุดตัดขาดทุน SL ($${stop}) ตามโครงสร้างราคาอัตโนมัติ`);
    } else {
      setMessage("กรอกราคา Entry ก่อนคำนวณ SL อัตโนมัติ");
    }
  };

  const handleAutoDraft = () => {
    const setup = detectChartSetup(bars, timeframe);
    if (setup) {
      setPlan(setup);
      setActiveSetup(setup);
      setMessage(`✨ น้องนักออมร่างแผน ${setup.setupName}: ${setup.summary}`);
      setHitBanner(null);
      if (soundEnabled) {
        playChime("entry");
        speakThai(`ร่างแผน ${setup.setupName} ให้เรียบร้อยค่ะ`);
      }
    }
  };

  const handleCopyBrief = async () => {
    const brief = formatPlanBrief(plan, result);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(brief);
        setMessage("📋 คัดลอกสรุปแผนเรียบร้อย นำไปแชร์ใน LINE หรือบันทึกได้ทันที");
      } else {
        setMessage("เบราว์เซอร์ไม่รองรับการคัดลอกลง Clipboard อัตโนมัติ");
      }
    } catch {
      setMessage("คัดลอกไม่สำเร็จ");
    }
  };

  const handleFetchCoachPlan = async () => {
    try {
      setMessage("📡 กำลังดึงแผนวิเคราะห์ล่าสุดจากโค้ช...");
      const res = await fetch("/api/forex/studio/plans", { cache: "no-store" });
      const data = await res.json();
      if (data?.plan) {
        setPlan(data.plan);
        setActiveSetup({
          setupName: "แผนวิเคราะห์สดจากโค้ช",
          summary: data.plan.condition || "แผนจากโค้ชน้องนักออม",
          atr: "4.2",
        });
        setCoachPlanMeta({
          coach: data.plan.coach,
          syncedAt: data.syncedAt || new Date().toISOString(),
        });
        setMessage(`📡 ดึงแผนวิเคราะห์สดจาก "${data.plan.coach || "โค้ช"}" สำเร็จ!`);
        if (soundEnabled) playChime("entry");
      }
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อดึงแผนจากโค้ชได้");
    }
  };

  const handleApplyCoachNotice = () => {
    if (liveCoachNotice) {
      setPlan(liveCoachNotice);
      setActiveSetup({
        setupName: liveCoachNotice.title || "แผนวิเคราะห์สดจากโค้ช",
        summary: liveCoachNotice.condition || "แผนจากโค้ชน้องนักออม",
        atr: "4.2",
      });
      setHitBanner(null);
      setMessage(`⚡ นำแผนสดจาก "${liveCoachNotice.coach || "โค้ช"}" มาใช้บนกราฟเรียบร้อย`);
      setLiveCoachNotice(null);
    }
  };

  const handleBroadcastCoachPlan = async () => {
    try {
      setMessage("📡 กำลังส่งข้อมูลถ่ายทอดแผนสด...");
      const res = await fetch("/api/forex/studio/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plan,
          title:
            plan.title ||
            `แผนวิเคราะห์สด XAU/USD (${
              timeframe === "15m" ? "15m Daytrade" : "1H Swing"
            })`,
          coach: "โค้ชน้องนักออม AI & ห้องถ่ายทอดสด",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("📡 ถ่ายทอดแผนสดไปยังผู้เข้าชมทุกคนเรียบร้อยแล้ว!");
        if (soundEnabled) {
          playChime("tp");
          speakThai("ถ่ายทอดแผนสดเรียบร้อยค่ะ");
        }
      } else {
        setMessage(data.message || "ไม่สามารถถ่ายทอดแผนได้");
      }
    } catch {
      setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อถ่ายทอดแผน");
    }
  };

  const handleApplySwarmPlan = (swarmPlan) => {
    if (!swarmPlan) return;
    setPlan({
      ...plan,
      title: swarmPlan.title,
      side: swarmPlan.side,
      entry: swarmPlan.entry,
      stop: swarmPlan.stop,
      target: swarmPlan.target,
      balance: swarmPlan.balance,
      riskPercent: swarmPlan.riskPercent,
      condition: swarmPlan.condition,
    });
    setActiveSetup({
      setupName: swarmPlan.title,
      summary: swarmPlan.condition,
      atr: swarmDebateData?.metrics?.atr || "3.5",
    });
    setStudioTab("chart");
    setMessage(`⚡ นำมติสภา AI Swarm (${swarmDebateData?.grade || "A+"}) มาวางบนกราฟเรียบร้อย!`);
    if (soundEnabled) {
      playChime("tp");
      speakThai(`นำมติสภา ${swarmPlan.side === "buy" ? "ซื้อ" : "ขาย"} มาวางบนกราฟเรียบร้อยค่ะ`);
    }
  };

  const handleBroadcastSwarmPlan = async (swarmPlan) => {
    if (!swarmPlan) return;
    try {
      setMessage("📡 กำลังส่งข้อมูลถ่ายทอดมติสภา AI สด...");
      const res = await fetch("/api/forex/studio/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...swarmPlan,
          coach: `สภา AI Swarm (6 Agents · Grade ${swarmDebateData?.grade || "A+"})`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("📡 ถ่ายทอดมติสภา AI สู่สมาชิกทุกคนเรียบร้อยแล้ว!");
        if (soundEnabled) {
          playChime("tp");
          speakThai("ถ่ายทอดมติสภา AI เรียบร้อยค่ะ");
        }
      } else {
        setMessage(data.message || "ไม่สามารถถ่ายทอดแผนได้");
      }
    } catch {
      setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อถ่ายทอดแผน");
    }
  };

  const save = (event) => {
    event.preventDefault();
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const next = [
      {
        id: String(Date.now()) + "-" + Math.random().toString(36).slice(2),
        plan: { ...plan },
      },
      ...plans,
    ].slice(0, 20);
    if (writePracticePlans(next)) {
      setPlans(next);
      setMessage("บันทึกแล้วในเบราว์เซอร์เครื่องนี้");
    } else {
      setMessage("บันทึกไม่ได้: เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล");
    }
  };

  const remove = (id) => {
    const next = plans.filter((item) => item.id !== id);
    if (writePracticePlans(next)) {
      setPlans(next);
      setMessage("ลบแผนจากเบราว์เซอร์แล้ว");
    } else {
      setMessage("ลบไม่ได้: เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล");
    }
  };

  return (
    <div className={styles.studio}>
      <section className={styles.studioHead}>
        <div>
          <div className={styles.eyebrow}>
            <span /> FOREX LIVE STUDIO{" "}
            <span className={styles.examplePill}>ข้อมูลจำลอง</span>
          </div>
          <h1>วางแผนทองคำบนกราฟ</h1>
          <p>
            ห้องฝึกซ้อมและวิเคราะห์กราฟทองคำ XAU/USD
            พร้อมระบบจำลองการเดินแท่งราคาและการบริหารความเสี่ยงอัตโนมัติ
          </p>
        </div>
        <div className={styles.host}>
          <Mascot />
        </div>
      </section>

      <div className={styles.notice}>
        <CircleHelp size={16} />
        <p>
          <strong>โหมดฝึก:</strong> ราคากราฟและแผนเริ่มต้นเป็นข้อมูลจำลอง
          ไม่ใช่ข้อมูลตลาดจริง แผนที่บันทึกอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น
          ทุกคนที่ใช้เบราว์เซอร์นี้อาจเห็นได้ และยังไม่ได้แชร์ให้สมาชิก
        </p>
      </div>

      {/* 1. TRACK RECORD BANNER — only validated (forward-recorded) results are shown */}
      <div className={styles.trackRecordBanner} aria-label="สถิติมติสภา AI ย้อนหลัง 30 วัน">
        <div className={styles.trackRecordLeft}>
          <Sparkles size={14} className={styles.pulseIcon} />
          <span>สถิติมติสภา AI SWARM (XAU/USD · ไม้ปิดจริง):</span>
        </div>
        <div className={styles.trackRecordStats}>
          <div className={styles.trackStatItem}>
            <span>Win Rate:</span>
            <strong className={styles.trackStatPositive}>
              {liveBacktest?.validated && liveBacktest.closed > 0 ? `${liveBacktest.winRate.toFixed(1)}%` : "—"}
            </strong>
            <small style={{ color: "#749ba3", fontSize: "10px" }}>
              {liveBacktest?.validated && liveBacktest.closed > 0 ? `(${liveBacktest.wins}W - ${liveBacktest.losses}L)` : "(ยังไม่มีไม้ปิดจริง)"}
            </small>
          </div>
          <div className={styles.trackStatItem}>
            <span>กำไรสะสม:</span>
            <strong className={styles.trackStatPositive}>
              {liveBacktest?.validated && liveBacktest.closed > 0 ? `${liveBacktest.netR >= 0 ? "+" : ""}${liveBacktest.netR.toFixed(1)} R` : "—"}
            </strong>
          </div>
          <div className={styles.trackStatItem}>
            <span>Profit Factor:</span>
            <strong>{liveBacktest?.validated && Number.isFinite(liveBacktest.profitFactor) ? liveBacktest.profitFactor.toFixed(2) : "—"}</strong>
          </div>
          <div className={styles.trackStatItem}>
            <span>Max DD:</span>
            <strong>{liveBacktest?.validated && liveBacktest.closed > 0 ? `${liveBacktest.maxDrawdownR.toFixed(1)} R` : "—"}</strong>
          </div>
        </div>
      </div>

      {/* MODE TAB BAR: SWARM vs CHART */}
      <div className={styles.modeTabBar}>
        <button
          type="button"
          className={`${styles.modeTabBtn} ${
            studioTab === "swarm" ? styles.modeTabBtnActive : ""
          }`}
          onClick={() => setStudioTab("swarm")}
        >
          <Zap size={15} className={styles.pulseIcon} />
          <span>6 AI AGENTS SWARM (THE REACTOR)</span>
          <span className={styles.hotBadge}>INSANE</span>
        </button>
        <button
          type="button"
          className={`${styles.modeTabBtn} ${
            studioTab === "chart" ? styles.modeTabBtnActive : ""
          }`}
          onClick={() => setStudioTab("chart")}
        >
          <span>📊 กราฟราคา & REPLAY (PRACTICE CHART)</span>
        </button>
      </div>

      <div className={styles.workbench}>
        {/* PANEL กราฟ & REPLAY AUTOMATION */}
        <section className={styles.panel} aria-labelledby="chart-title">
          <div className={styles.heading}>
            <div>
              <span className={styles.overline}>
                {studioTab === "swarm" ? "QUANT REVOLUTION" : "PRACTICE CHART"}
              </span>
              <h2 id="chart-title">
                {studioTab === "swarm"
                  ? "6 AI AGENTS SWARM · THE REACTOR"
                  : `XAU/USD · ${
                      timeframe === "15m"
                        ? "15 นาที (Daytrade)"
                        : "1 ชั่วโมง (Structure)"
                    }`}
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className={`${styles.livePill} ${liveConnected ? "" : styles.livePillOffline}`}>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: liveConnected ? "#68e7bf" : "#ff7070",
                  }}
                />
                {liveConnected
                  ? liveTick
                    ? `LIVE $${liveTick.price}`
                    : "LIVE FEED"
                  : "STANDALONE"}
              </span>
              <span className={styles.timeframeGroup}>
                <button
                  type="button"
                  className={`${styles.timeframeBtn} ${
                    timeframe === "15m" ? styles.timeframeBtnActive : ""
                  }`}
                  onClick={() => handleTimeframeChange("15m")}
                >
                  15m
                </button>
                <button
                  type="button"
                  className={`${styles.timeframeBtn} ${
                    timeframe === "1h" ? styles.timeframeBtnActive : ""
                  }`}
                  onClick={() => handleTimeframeChange("1h")}
                >
                  1H
                </button>
              </span>
              {studioTab === "chart" && (
                <button
                  type="button"
                  className={`${styles.smartBtn} ${showEma ? styles.smartBtnActive : ""}`}
                  onClick={() => setShowEma((v) => !v)}
                  title="เปิด/ปิดเส้น EMA20 (ส้ม) และ EMA50 (ม่วง)"
                >
                  📈 EMA 20/50
                </button>
              )}
            </div>
          </div>

          {/* LIVE COACH NOTICE BANNER */}
          {liveCoachNotice && (
            <div className={styles.coachLiveNotice} role="alert">
              <div className={styles.coachNoticeLeft}>
                <Radio size={16} className={styles.pulseIcon} />
                <div>
                  <strong>📡 มีแผนวิเคราะห์สดใหม่จากโค้ช: {liveCoachNotice.title}</strong>
                  <small>
                    {liveCoachNotice.side?.toUpperCase()} · เข้า {liveCoachNotice.entry} | SL {liveCoachNotice.stop} | TP {liveCoachNotice.target}
                  </small>
                </div>
              </div>
              <div className={styles.coachNoticeActions}>
                <button
                  type="button"
                  className={styles.applyCoachBtn}
                  onClick={handleApplyCoachNotice}
                >
                  ⚡ ใช้งานแผนนี้ทันที
                </button>
                <button
                  type="button"
                  className={styles.dismissNoticeBtn}
                  onClick={() => setLiveCoachNotice(null)}
                  aria-label="ปิดการแจ้งเตือน"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div style={{ display: studioTab === "swarm" ? "block" : "none" }}>
            <SwarmDebate
              debateData={swarmDebateData}
              onApplyPlan={handleApplySwarmPlan}
              onBroadcastPlan={handleBroadcastSwarmPlan}
              onReconvene={() => setSwarmTrigger((t) => t + 1)}
              soundEnabled={soundEnabled}
            />
          </div>

          <div style={{ display: studioTab === "chart" ? "block" : "none" }}>
            <div className={styles.chart}>
              <CandlestickChart
                symbol="XAUUSD"
                timeframe={timeframe}
                bars={bars}
                priceLines={priceLines}
                analysis={analysis}
                indicators={{ ema20: showEma, ema50: showEma, volume: true }}
                chartRange="all"
                source="ข้อมูลจำลอง"
              />
            </div>
            <p className={styles.planFoot}>
              เส้น Entry, SL, TP เปลี่ยนตามข้อมูลในแบบฟอร์ม · กราฟโดย{" "}
              <a
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noreferrer"
              >
                TradingView Lightweight Charts™
              </a>
            </p>

            {/* HIT NOTIFICATION BANNER */}
            {hitBanner && (
              <div
                className={`${styles.hitBanner} ${
                  hitBanner.type === "tp"
                    ? styles.hitBannerTp
                    : hitBanner.type === "sl"
                      ? styles.hitBannerSl
                      : styles.hitBannerEntry
                }`}
              >
                <Zap size={16} />
                <span>{hitBanner.text}</span>
              </div>
            )}

            {/* AUTOMATION CONTROL BAR */}
            <div className={styles.automationBar}>
              <div className={styles.automationRow}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => setIsPlaying((p) => !p)}
                    aria-label={isPlaying ? "หยุดชั่วคราว" : "เล่นแท่งเทียนอัตโนมัติ"}
                  >
                    {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    <span>{isPlaying ? "หยุดชั่วคราว" : "เล่นอัตโนมัติ"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVisible(INITIAL_VISIBLE);
                      setIsPlaying(false);
                      setHitBanner(null);
                    }}
                    disabled={visible === INITIAL_VISIBLE}
                    aria-label="เริ่มจำลองใหม่จากแท่งที่ 60"
                  >
                    <RotateCcw size={14} /> เริ่มใหม่
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisible((n) => Math.min(candles.length, n + 1))}
                    disabled={visible === candles.length || isPlaying}
                    aria-label="ก้าวไปข้างหน้า 1 แท่ง"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={styles.speedGroup}>
                    {[1, 2, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`${styles.speedBtn} ${
                          speed === s ? styles.speedBtnActive : ""
                        }`}
                        onClick={() => setSpeed(s)}
                      >
                        {s}x
                      </button>
                    ))}
                  </span>

                  <button
                    type="button"
                    className={styles.smartBtn}
                    onClick={() => setSoundEnabled((v) => !v)}
                    title="เปิด/ปิด เสียงแจ้งเตือนของน้องนักออม"
                    aria-pressed={soundEnabled}
                  >
                    {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    <span>{soundEnabled ? "เสียงเปิด" : "เสียงปิด"}</span>
                  </button>
                </div>
              </div>

              {/* TIMELINE SCRUBBER */}
              <div className={styles.scrubberContainer}>
                <span>
                  แท่ง {visible} / {candles.length} ({timeframe})
                </span>
                <input
                  type="range"
                  className={styles.scrubber}
                  min={30}
                  max={candles.length}
                  value={visible}
                  onChange={(e) => {
                    setVisible(Number(e.target.value));
                    setHitBanner(null);
                  }}
                  aria-label="เลื่อนแถบเวลาแท่งเทียน"
                />
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* 2. TODAY'S GOLD BATTLE ZONES */}
          <div className={styles.battleZonesCard} aria-labelledby="battle-zones-title">
            <div className={styles.battleZonesHead}>
              <span id="battle-zones-title">🎯 TODAY'S GOLD BATTLE PLAN · คีย์เลเวลทองคำประจำวัน</span>
              <span style={{ fontSize: "10px", color: "#68d2ff" }}>London &amp; NY Sessions Active</span>
            </div>
            <div className={styles.battleZonesGrid}>
              <div className={styles.battleZoneItem}>
                <span>🟢 โซนดัก Buy (Asian Low Sweep)</span>
                <strong style={{ color: "#6ce7bf" }}>{liveBacktest?.buyZone || "$2645.00 - $2648.50"}</strong>
              </div>
              <div className={styles.battleZoneItem}>
                <span>🔴 โซนระวังแรงทุบ Sell (London High)</span>
                <strong style={{ color: "#ff8292" }}>{liveBacktest?.sellZone || "$2668.00 - $2672.00"}</strong>
              </div>
              <div className={styles.battleZoneItem}>
                <span>⚠️ เฝ้าระวังข่าวเศรษฐกิจคืนนี้</span>
                <strong style={{ color: "#fbbf24" }}>21:00 น. US Flash PMI</strong>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL ฟอร์มวางแผน & SMART PRESETS */}
        <section className={styles.panel} aria-labelledby="plan-title">
          <div className={styles.heading}>
            <div>
              <span className={styles.overline}>TRADE PLAN · PRECISION</span>
              <h2 id="plan-title">สร้างแผนตัวอย่าง</h2>
            </div>
          </div>

          <form className={styles.form} onSubmit={save}>
            {/* ปุ่ม AI ASSISTANT AUTO-DRAFT */}
            <button
              type="button"
              className={styles.autoDraftBtn}
              onClick={handleAutoDraft}
            >
              <Sparkles size={16} /> ให้น้องนักออมร่างแผนคมๆ ({timeframe === "15m" ? "Daytrade 15m" : "Swing 1H"})
            </button>

            {/* SHARP SETUP CARD */}
            {activeSetup && (
              <div className={styles.setupCard}>
                <div className={styles.setupCardHeader}>
                  <span>⚡ {activeSetup.setupName}</span>
                  <span>ATR: ±${activeSetup.atr}</span>
                </div>
                <p className={styles.setupCardDesc}>{activeSetup.summary}</p>
              </div>
            )}

            <label>
              ชื่อแผน
              <input
                maxLength={60}
                value={plan.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </label>

            {/* ฝั่งแผนพร้อมระบบ Invert อัตโนมัติ */}
            <div>
              <span style={{ fontSize: "11px", color: "#b8ccce" }}>ฝั่งแผน</span>
              <div className={styles.presetRow}>
                <button
                  type="button"
                  className={`${styles.smartBtn} ${
                    plan.side === "buy" ? styles.smartBtnActive : ""
                  }`}
                  onClick={() => handleSideSwitch("buy")}
                >
                  🟢 ซื้อ (BUY)
                </button>
                <button
                  type="button"
                  className={`${styles.smartBtn} ${
                    plan.side === "sell" ? styles.smartBtnActive : ""
                  }`}
                  onClick={() => handleSideSwitch("sell")}
                >
                  🔴 ขาย (SELL)
                </button>
              </div>
            </div>

            <div className={styles.formRow}>
              <label>
                จุดเข้า · Entry ($)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={plan.entry}
                  onChange={(e) => update("entry", e.target.value)}
                />
              </label>
              <label>
                ตัดขาดทุน · SL ($)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={plan.stop}
                  onChange={(e) => update("stop", e.target.value)}
                />
              </label>
            </div>

            {/* AUTO SL BUTTON */}
            <div className={styles.presetRow}>
              <button
                type="button"
                className={styles.smartBtn}
                onClick={handleAutoStop}
              >
                <ShieldAlert size={13} /> คำนวณ SL โครงสร้าง {timeframe} + ATR
              </button>
            </div>

            <label>
              เป้าหมาย · TP ($)
              <input
                type="number"
                min="0.000001"
                step="any"
                required
                value={plan.target}
                onChange={(e) => update("target", e.target.value)}
              />
            </label>

            {/* SMART TARGET PRESETS (2R / 3R) */}
            <div className={styles.presetRow}>
              <button
                type="button"
                className={styles.smartBtn}
                onClick={() => handleAutoTarget(2)}
              >
                <Target size={13} /> ล็อกเป้าคม 2.0R อัตโนมัติ
              </button>
              <button
                type="button"
                className={styles.smartBtn}
                onClick={() => handleAutoTarget(3)}
              >
                <Target size={13} /> ล็อกเป้า 3.0R
              </button>
            </div>

            <div className={styles.formRow}>
              <label>
                ทุนสมมติ ($)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={plan.balance}
                  onChange={(e) => update("balance", e.target.value)}
                />
              </label>
              <label>
                เสี่ยงต่อแผน (%)
                <input
                  type="number"
                  min="0.000001"
                  max="100"
                  step="any"
                  required
                  value={plan.riskPercent}
                  onChange={(e) => update("riskPercent", e.target.value)}
                />
              </label>
            </div>

            {/* QUICK RISK PRESETS */}
            <div className={styles.presetRow}>
              <span style={{ fontSize: "10px", color: "#87a4a9" }}>เลือกความเสี่ยงด่วน:</span>
              {[0.5, 1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.smartBtn} ${
                    Number(plan.riskPercent) === p ? styles.smartBtnActive : ""
                  }`}
                  onClick={() => update("riskPercent", String(p))}
                >
                  {p}%
                </button>
              ))}
            </div>

            <label>
              ขนาดสัญญา · ออนซ์ต่อ 1 lot
              <input
                type="number"
                min="0.000001"
                step="any"
                required
                value={plan.unitsPerLot}
                onChange={(e) => update("unitsPerLot", e.target.value)}
              />
            </label>

            <label>
              เงื่อนไขที่ต้องทบทวน
              <textarea
                maxLength={160}
                rows={2}
                value={plan.condition}
                onChange={(e) => update("condition", e.target.value)}
              />
            </label>

            {/* RESULTS LIVE REGION */}
            <div className={styles.results} aria-live="polite">
              {result.error ? (
                <p className={styles.error}>{result.error}</p>
              ) : (
                <>
                  <div>
                    <span>เงินที่เสี่ยง</span>
                    <strong>${display(result.riskAmount)}</strong>
                  </div>
                  <div>
                    <span>ขนาดตามสูตร</span>
                    <strong>{display(result.theoreticalLots, 4)} lot</strong>
                  </div>
                  <div>
                    <span>เป้าหมาย / ความเสี่ยง</span>
                    <strong>{display(result.rewardRatio)} R</strong>
                  </div>
                </>
              )}
            </div>

            <p className={styles.planFoot}>
              ผลประมาณการสำหรับ XAU/USD และทุนสกุล USD ตามขนาดสัญญาที่กรอก ไม่รวม
              spread, commission, slippage และข้อกำหนดขนาด lot ของโบรกเกอร์
            </p>

            <div className={styles.actionGroup}>
              <button className={styles.primary} type="submit">
                <Save size={15} /> บันทึกในเครื่อง
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCopyBrief}
              >
                <Copy size={15} /> คัดลอกสรุปแผน
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleFetchCoachPlan}
              >
                <Radio size={15} /> ดึงแผนจากโค้ช
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleBroadcastCoachPlan}
                title="ถ่ายทอดแผนสดไปยังสมาชิกทุกคนผ่าน Live Stream"
              >
                <Radio size={15} /> ถ่ายทอดแผนสด
              </button>
            </div>
            <span className={styles.feedback} role="status">
              {message}
            </span>
          </form>

          {coachPlanMeta && (
            <div className={styles.liveCoachBox}>
              <span>
                📡 แผนถ่ายทอดสดโดย: <strong>{coachPlanMeta.coach}</strong>
              </span>
              <small>
                {new Date(coachPlanMeta.syncedAt).toLocaleTimeString("th-TH")}
              </small>
            </div>
          )}
        </section>
      </div>

      {/* SAVED PLANS SECTION */}
      <section className={styles.panel} aria-labelledby="saved-plans-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.overline}>SAVED ON THIS DEVICE</span>
            <h2 id="saved-plans-title">แผนที่บันทึกในเบราว์เซอร์</h2>
          </div>
          <span className={styles.tag}>{plans.length} / 20</span>
        </div>
        {plans.length === 0 ? (
          <p className={styles.description}>
            ยังไม่มีแผนที่บันทึก กรอกแผนแล้วกดบันทึกเพื่อกลับมาดูภายหลัง
          </p>
        ) : (
          <ul className={styles.savedList}>
            {plans.map((item) => (
              <li key={item.id}>
                <button
                  className={styles.loadPlan}
                  type="button"
                  onClick={() => {
                    setPlan(item.plan);
                    setMessage("เปิดแผนที่บันทึกแล้ว");
                    setHitBanner(null);
                  }}
                >
                  <strong>{item.plan.title || "แผนไม่มีชื่อ"}</strong>
                  <span>
                    {item.plan.side === "buy" ? "BUY" : "SELL"} · Entry{" "}
                    {item.plan.entry} · SL {item.plan.stop} · TP{" "}
                    {item.plan.target}
                  </span>
                </button>
                <button
                  className={styles.deletePlan}
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`ลบ ${item.plan.title || "แผนไม่มีชื่อ"}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.planFoot}>
          ข้อมูลอยู่ในเบราว์เซอร์นี้ อาจหายเมื่อล้างข้อมูลเบราว์เซอร์
          และไม่ได้ผูกกับบัญชีสมาชิก
        </p>
      </section>

      {/* 3. MOBILE STICKY VIP CONVERSION BAR */}
      {showMobileStickyVip && (
        <div className={styles.mobileStickyVipBar} role="complementary" aria-label="แถบสมัครสมาชิก VIP">
          <div className={styles.mobileVipText}>
            <Sparkles size={16} className={styles.pulseIcon} />
            <div>
              <strong>⚡ ไม่พลาดไม้ทองคำ 15m ลอนดอน/นิวยอร์ก</strong>
              <small>รับมติสภา 6 AI สดยิงตรงเข้า Telegram VIP ทุกไม้</small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a href="/account" className={styles.mobileVipBtn}>
              <Lock size={12} /> ปลดล็อก PRO VIP (฿399/ด.)
            </a>
            <button
              type="button"
              className={styles.mobileVipClose}
              onClick={() => setShowMobileStickyVip(false)}
              aria-label="ปิดแถบแจ้งเตือน"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
