"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Send,
  Lock,
} from "lucide-react";
import { SWARM_AGENTS } from "./swarm-engine.mjs";
import SwarmReactor from "./swarm-reactor.jsx";

export default function SwarmDebate({
  debateData,
  onApplyPlan,
  onBroadcastPlan,
  onReconvene,
  soundEnabled = false,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("edge");
  const [showVipModal, setShowVipModal] = useState(false);

  const dialogue = debateData?.dialogue || [];
  const consensus = debateData?.consensus || "STAND_ASIDE";
  const grade = debateData?.grade || "A+";
  const confidence = debateData?.confidence || 88;

  // Step progression during simulation
  useEffect(() => {
    if (!isSimulating) return;
    if (activeStep >= dialogue.length) {
      setIsSimulating(false);
      return;
    }
    const timer = setTimeout(() => {
      setActiveStep((s) => s + 1);
    }, 900);
    return () => clearTimeout(timer);
  }, [isSimulating, activeStep, dialogue.length]);

  const handleStartDebate = () => {
    setActiveStep(0);
    setIsSimulating(true);
    if (onReconvene) onReconvene();
  };

  const currentSpeaker = dialogue[activeStep - 1]?.sender || "spotter";
  const currentListener = dialogue[activeStep - 1]?.target || "edge";

  return (
    <div style={{ display: "grid", gap: "14px", marginTop: "10px" }}>
      {/* 1. THE REACTOR (Canvas Orbit & Synapse Energy) */}
      <SwarmReactor
        consensus={consensus}
        activeAgentId={selectedAgentId}
        activeSpeaker={currentSpeaker}
        activeListener={currentListener}
        isDebating={isSimulating}
        confidence={confidence}
        grade={grade}
        onSelectAgent={setSelectedAgentId}
      />

      {/* 2. SWARM AGENTS ROSTER (6 Pods) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "8px",
        }}
      >
        {SWARM_AGENTS.map((agent) => {
          const isSpeaking = currentSpeaker === agent.id && isSimulating;
          const isSelected = selectedAgentId === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgentId(agent.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "none",
                background: isSpeaking
                  ? "rgba(20, 60, 75, 0.9)"
                  : isSelected
                    ? "#0e2a36"
                    : "#081822",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: agent.color, fontSize: "11px" }}>
                  {agent.name}
                </strong>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: isSpeaking ? agent.color : "#385e68",
                    boxShadow: isSpeaking ? `0 0 8px ${agent.color}` : "none",
                  }}
                />
              </div>
              <small style={{ color: "#8da9b0", fontSize: "10px" }}>
                {agent.role}
              </small>
            </button>
          );
        })}
      </div>

      {/* 3. THE TRACE (Live Swarm Debate Stream) */}
      <div
        style={{
          background: "#071720",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "none",
            paddingBottom: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#7ef3d6",
                letterSpacing: "0.5px",
              }}
            >
              THE TRACE · LIVE DEBATE STREAM
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "#6c939c",
                background: "#0c2530",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {isSimulating ? "⚡ DEBATING..." : "CONSENSUS LOCKED"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartDebate}
            disabled={isSimulating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "linear-gradient(90deg, #1b5b5c, #13424d)",
              border: "none",
              color: "#e6fff9",
              fontSize: "11px",
              fontWeight: 700,
              cursor: isSimulating ? "not-allowed" : "pointer",
            }}
          >
            <Play size={12} />
            <span>{isSimulating ? "กำลังดีเบต..." : "ประชุมสภา AI รอบใหม่"}</span>
          </button>
        </div>

        {/* Dialogue Messages */}
        <div
          style={{
            display: "grid",
            gap: "8px",
            maxHeight: "220px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {dialogue.slice(0, activeStep || dialogue.length).map((item, idx) => {
            const agent =
              SWARM_AGENTS.find((a) => a.id === item.sender) || SWARM_AGENTS[0];
            const isPrior = item.sender === "prior";
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  background: isPrior
                    ? "rgba(65, 20, 30, 0.4)"
                    : "rgba(10, 30, 40, 0.45)",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  borderLeft: `3px solid ${agent.color}`,
                }}
              >
                <div style={{ flexShrink: 0, minWidth: "65px" }}>
                  <strong style={{ color: agent.color, fontSize: "11px" }}>
                    {agent.name}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      fontSize: "9px",
                      color: "#6c8e96",
                    }}
                  >
                    {agent.badge}
                  </span>
                </div>
                <div style={{ flex: 1, fontSize: "11px", color: "#d2ecf0", lineHeight: 1.45 }}>
                  {item.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SWARM CONSENSUS CARD & ACTIONS */}
      <div
        style={{
          background: "linear-gradient(90deg, #0d2c38, #0a212c)",
          border: "none",
          borderRadius: "10px",
          padding: "14px",
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", color: "#8da9b0", fontWeight: 700 }}>
              SWARM CONSENSUS VERDICT
            </div>
            <strong
              style={{
                fontSize: "14px",
                color:
                  consensus === "BUY"
                    ? "#5de3be"
                    : consensus === "SELL"
                      ? "#ff7088"
                      : "#f59e0b",
              }}
            >
              {consensus === "BUY"
                ? "🟢 มติเอกฉันท์: BUY XAU/USD"
                : consensus === "SELL"
                  ? "🔴 มติเอกฉันท์: SELL XAU/USD"
                  : "🟡 มติสภา: STAND ASIDE (อยู่เฉยๆ)"}
            </strong>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: "6px",
                background: "#163f4c",
                color: "#8bf3da",
              }}
            >
              GRADE {grade} ({confidence}%)
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "#c2e1e7",
                background: "#081822",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "none",
              }}
            >
              Lot แนะนำ: <strong>{debateData?.metrics?.recommendedLot || "0.03"}</strong>
            </span>
          </div>
        </div>

        {/* Plan summary numbers */}
        {debateData?.plan && consensus !== "STAND_ASIDE" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              background: "#07161e",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "11px",
            }}
          >
            <div>
              <span style={{ color: "#749ba3" }}>Entry (TAKER):</span>
              <strong style={{ display: "block", color: "#68d2ff" }}>
                ${debateData.plan.entry}
              </strong>
            </div>
            <div>
              <span style={{ color: "#749ba3" }}>SL (CLOSER):</span>
              <strong style={{ display: "block", color: "#ff7b88" }}>
                ${debateData.plan.stop}
              </strong>
            </div>
            <div>
              <span style={{ color: "#749ba3" }}>TP (EDGE):</span>
              <strong style={{ display: "block", color: "#5eead4" }}>
                ${debateData.plan.target}
              </strong>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
          <button
            type="button"
            onClick={() => onApplyPlan && onApplyPlan(debateData.plan)}
            style={{
              flex: 1,
              minHeight: "38px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              background: "#196860",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <Zap size={14} /> นำมติสภา AI มาวางบนกราฟ
          </button>

          <button
            type="button"
            onClick={() => onBroadcastPlan && onBroadcastPlan(debateData.plan)}
            style={{
              minHeight: "38px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              background: "#102d38",
              border: "none",
              borderRadius: "8px",
              color: "#c2e5eb",
              fontSize: "11px",
              fontWeight: 600,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            <Send size={13} /> ถ่ายทอดมติสดให้สมาชิก
          </button>

          <button
            type="button"
            onClick={() => setShowVipModal(true)}
            style={{
              minHeight: "38px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              background: "linear-gradient(90deg, #581c87, #3b0764)",
              border: "none",
              borderRadius: "8px",
              color: "#f3e8ff",
              fontSize: "11px",
              fontWeight: 700,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            <Lock size={13} /> ยิงสัญญาณเข้า Telegram VIP
          </button>
        </div>
      </div>

      {/* VIP MODAL HOOK */}
      {showVipModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setShowVipModal(false)}
        >
          <div
            style={{
              background: "#0a1f29",
              border: "none",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#18454b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6ce7bf",
                marginBottom: "12px",
              }}
            >
              <Sparkles size={24} />
            </div>
            <h3 style={{ color: "#eefaf6", margin: "0 0 8px", fontSize: "18px" }}>
              ปลดล็อก AI Swarm สัญญาณสดเข้า Telegram VIP
            </h3>
            <p style={{ color: "#a5c2c7", fontSize: "12px", lineHeight: 1.6, margin: "0 0 16px" }}>
              รับการแจ้งเตือนมติสภา 6 AI Agents บนกรอบเวลา 15m เรียลไทม์
              พร้อมการคำนวณขนาด Lot ตามทุนพอร์ตของคุณ ส่งตรงเข้า Telegram VIP ทุกไม้
              ไม่ตกรอบตลาดลอนดอนและนิวยอร์ก
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              <a
                href="/account"
                style={{
                  minHeight: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(90deg, #18685e, #1c7c72)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "13px",
                  borderRadius: "10px",
                  textDecoration: "none",
                }}
              >
                ดูแพ็กเกจสมาชิก PRO VIP (เพียง ฿399/เดือน)
              </a>
              <button
                type="button"
                onClick={() => setShowVipModal(false)}
                style={{
                  minHeight: "36px",
                  background: "transparent",
                  border: "none",
                  color: "#749ba3",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                ไว้คราวหลัง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

