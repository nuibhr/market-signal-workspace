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

function Mascot() {
  return (
    <div className={styles.mascotStage} aria-hidden="true">
      <div className={styles.mascotShadow} />
      <div className={styles.mascot}>
        <span className={styles.hair} />
        <span className={styles.face}>
          <i />
          <i />
          <b />
        </span>
        <span className={styles.body} />
        <span className={styles.legs} />
      </div>
      <span className={styles.spark}>✦</span>
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
  const candles = useMemo(() => demoBars(initialInstrument, timeframe), [timeframe]);

  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [studioTab, setStudioTab] = useState("swarm");
  const [swarmTrigger, setSwarmTrigger] = useState(0);
  const [hitBanner, setHitBanner] = useState(null);
  const [coachPlanMeta, setCoachPlanMeta] = useState(null);
  const [liveCoachNotice, setLiveCoachNotice] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveTick, setLiveTick] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);

  const [plan, setPlan] = useState(INITIAL_PRACTICE_PLAN);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPlans(readPracticePlans());
  }, []);

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
          <div>
            <strong>น้องนักออม</strong>
            <small>เพื่อนร่วมทางในห้องฝึก</small>
          </div>
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
    </div>
  );
}
