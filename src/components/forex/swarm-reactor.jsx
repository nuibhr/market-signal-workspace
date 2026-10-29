"use client";

import { useEffect, useRef, useState } from "react";
import { SWARM_AGENTS } from "./swarm-engine.mjs";

/**
 * High-tech Canvas-based Living Swarm Reactor
 * Renders the 6 AI agents orbiting around a pulsing reactive core with dynamic energy synapses.
 */
export default function SwarmReactor({
  consensus = "BUY",
  activeAgentId = "edge",
  activeSpeaker = "spotter",
  activeListener = "edge",
  isDebating = false,
  confidence = 88,
  grade = "A+",
  onSelectAgent,
}) {
  const canvasRef = useRef(null);
  const [hoveredAgent, setHoveredAgent] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId;
    let angle = 0;
    let pulsePhase = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = Math.min(width, height) * 0.38;
      const radiusY = radiusX * 0.72; // Elliptical orbit

      ctx.clearRect(0, 0, width, height);

      angle += isDebating ? 0.012 : 0.005;
      pulsePhase += 0.04;

      // 1. Orbital Rings (Background)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(40, 95, 110, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX * 0.65, radiusY * 0.65, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(40, 95, 110, 0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.restore();

      // 2. Calculate 6 Agent Node Positions
      const nodePositions = SWARM_AGENTS.map((agent, index) => {
        const agentAngle = angle + (index * (Math.PI * 2)) / SWARM_AGENTS.length;
        const x = centerX + Math.cos(agentAngle) * radiusX;
        const y = centerY + Math.sin(agentAngle) * radiusY;
        return { ...agent, x, y, agentAngle };
      });

      // 3. Dynamic Synapse Energy Beams between active agents
      if (activeSpeaker && activeListener) {
        const speakerNode = nodePositions.find((n) => n.id === activeSpeaker);
        const listenerNode = nodePositions.find((n) => n.id === activeListener);

        if (speakerNode && listenerNode) {
          ctx.save();
          const gradient = ctx.createLinearGradient(
            speakerNode.x,
            speakerNode.y,
            listenerNode.x,
            listenerNode.y,
          );
          gradient.addColorStop(0, speakerNode.color);
          gradient.addColorStop(1, listenerNode.color);

          // Control point curved through center
          const cpX = centerX + Math.sin(pulsePhase) * 15;
          const cpY = centerY + Math.cos(pulsePhase) * 15;

          ctx.beginPath();
          ctx.moveTo(speakerNode.x, speakerNode.y);
          ctx.quadraticCurveTo(cpX, cpY, listenerNode.x, listenerNode.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2.5 + Math.sin(pulsePhase * 2) * 1;
          ctx.shadowColor = speakerNode.color;
          ctx.shadowBlur = 12;
          ctx.stroke();

          // Traveling energy photon pulse
          const t = (pulsePhase % (Math.PI * 2)) / (Math.PI * 2);
          const px = (1 - t) * (1 - t) * speakerNode.x + 2 * (1 - t) * t * cpX + t * t * listenerNode.x;
          const py = (1 - t) * (1 - t) * speakerNode.y + 2 * (1 - t) * t * cpY + t * t * listenerNode.y;

          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Central Core ("THE REACTOR")
      const corePulse = Math.sin(pulsePhase) * 4;
      const coreRadius = Math.max(26, Math.min(width, height) * 0.1) + corePulse;

      const coreColor =
        consensus === "BUY"
          ? "#10b981"
          : consensus === "SELL"
            ? "#f43f5e"
            : "#f59e0b";

      ctx.save();
      // Outer Glow
      const coreGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        coreRadius * 0.4,
        centerX,
        centerY,
        coreRadius * 2.2,
      );
      coreGlow.addColorStop(0, coreColor);
      coreGlow.addColorStop(0.5, "rgba(10, 30, 40, 0.4)");
      coreGlow.addColorStop(1, "rgba(5, 15, 22, 0)");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Core Sphere
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#07131b";
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.stroke();

      // Core Center Iris Eyes (Sci-fi Eye)
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 8;
      const pupilOffset = Math.sin(pulsePhase * 0.5) * 2;
      ctx.beginPath();
      ctx.roundRect(centerX - 6 + pupilOffset, centerY - 9, 4, 18, 2);
      ctx.roundRect(centerX + 3 + pupilOffset, centerY - 9, 4, 18, 2);
      ctx.fill();

      // Core Status Subtext
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillStyle = coreColor;
      ctx.textAlign = "center";
      ctx.shadowBlur = 0;
      ctx.fillText(
        isDebating ? "DEBATING" : consensus,
        centerX,
        centerY + coreRadius + 16,
      );
      ctx.restore();

      // 5. Render Orbiting 6 Agent Nodes
      nodePositions.forEach((agent) => {
        const isSpeaker = agent.id === activeSpeaker;
        const isSelected = agent.id === activeAgentId;
        const isHovered = agent.id === hoveredAgent;
        const nodeRadius = isSpeaker || isSelected || isHovered ? 16 : 13;

        ctx.save();

        // Node Glow Halo
        if (isSpeaker || isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, nodeRadius * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = agent.glow;
          ctx.fill();
        }

        // Connecting filament to center
        ctx.beginPath();
        ctx.moveTo(agent.x, agent.y);
        ctx.lineTo(centerX, centerY);
        ctx.strokeStyle = agent.color;
        ctx.globalAlpha = isSpeaker ? 0.4 : 0.08;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Node Sphere
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? agent.color : "#091d27";
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = isSpeaker ? 3 : 2;
        ctx.shadowColor = agent.color;
        ctx.shadowBlur = isSpeaker ? 18 : 8;
        ctx.fill();
        ctx.stroke();

        // Agent Name Pill Label
        ctx.font = "700 9px Inter, monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = isSelected ? "#06131c" : agent.color;
        ctx.shadowBlur = 0;
        ctx.fillText(agent.name.slice(0, 3), agent.x, agent.y + 3.5);

        // Subtitle Name below
        ctx.font = "600 10px Inter, system-ui, sans-serif";
        ctx.fillStyle = isSpeaker ? "#ffffff" : "#a8cbd4";
        ctx.fillText(agent.name, agent.x, agent.y + nodeRadius + 13);

        ctx.restore();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [
    consensus,
    activeAgentId,
    activeSpeaker,
    activeListener,
    isDebating,
    confidence,
    hoveredAgent,
  ]);

  return (
    <div style={{ position: "relative", width: "100%", height: "310px", background: "radial-gradient(circle at center, #0c2633 0%, #06141c 70%, #040d12 100%)", borderRadius: "14px", overflow: "hidden", border: "1px solid #1c4756" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }}
      />
      {/* HUD OVERLAY BADGES */}
      <div style={{ position: "absolute", top: "12px", left: "14px", display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: "#0f3642", color: "#65e5c7", border: "1px solid #236577", letterSpacing: "0.5px" }}>
          THE REACTOR · 6 AGENTS SWARM
        </span>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: consensus === "BUY" ? "#064e3b" : consensus === "SELL" ? "#881337" : "#78350f", color: "#e6fff7", border: "1px solid rgba(255,255,255,0.15)" }}>
          GRADE {grade} ({confidence}%)
        </span>
      </div>

      <div style={{ position: "absolute", bottom: "10px", left: "14px", right: "14px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#749ba3" }}>
        <span>6 INDEPENDENT THREADS · ACTIVE CONSENSUS</span>
        <span>XAU/USD INTRADAY CORE</span>
      </div>
    </div>
  );
}
