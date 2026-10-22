'use client';

import React from 'react';
import MagicParticleWave from './magic-particle-wave.jsx';

/**
 * AmbientLiquidGlass
 * Ultra-smooth, GPU-accelerated Magic UI Aurora & Liquid Glass ambient background.
 * In Dark Mode:
 *   - Dark Navy (#080D1B) with Aurora Gradient (#22D3EE, #6366F1, #8B5CF6)
 *   - 3D Particle Wave Mesh (AI Data Flow Canvas)
 *   - Multi-Layer Neon Flowing Waves (glowing energy streams)
 * In Light Mode:
 *   - Crisp luxury white liquid frosted glass
 */
export default function AmbientLiquidGlass({ isLight = false }) {
  return (
    <div className={`ambient-liquid-wrap ${isLight ? 'is-light' : 'is-dark'}`} aria-hidden="true">
      {/* 1. Fluid Aurora Blobs */}
      <div className="ambient-mesh-canvas">
        <div className="liquid-blob blob-1" />
        <div className="liquid-blob blob-2" />
        <div className="liquid-blob blob-3" />
        <div className="liquid-blob blob-4" />
      </div>

      {/* 2. Dark Mode Futuristic AI Terminal Effects */}
      {!isLight && (
        <>
          {/* 3D Particle Wave Mesh Canvas */}
          <MagicParticleWave />

          {/* Multi-Layer Neon Flowing Waves */}
          <div className="magic-neon-waves">
            <svg className="magic-neon-svg" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
              {/* Diffused Energy Glow Mesh */}
              <path
                d="M-40,420 C240,490 380,310 680,380 C980,450 1140,290 1480,350 L1480,900 L-40,900 Z"
                fill="url(#neon-aura-fill)"
                opacity="0.04"
              />

              {/* Wave Stream 1: Primary Neon Cyan Flowing Ribbon */}
              <path
                className="neon-wave-path neon-wave-cyan"
                d="M-50,560 C260,490 440,670 780,590 C1120,510 1260,640 1490,570"
              />

              {/* Wave Stream 2: Electric Purple Harmonic Wave */}
              <path
                className="neon-wave-path neon-wave-purple"
                d="M-50,680 C320,600 520,770 860,700 C1180,630 1320,730 1490,670"
              />

              {/* Wave Stream 3: Streaming Digital Energy Pulses (Dashed Flow) */}
              <path
                className="neon-wave-path neon-wave-pulse"
                d="M-50,610 C290,540 480,720 820,640 C1150,560 1290,690 1490,620"
              />

              {/* Wave Stream 4: Neon Pink / Indigo Deep Horizon Wave */}
              <path
                className="neon-wave-path neon-wave-accent"
                d="M-50,780 C240,730 460,840 760,790 C1060,740 1280,820 1490,770"
              />

              <defs>
                {/* Aurora Fill Gradient */}
                <linearGradient id="neon-aura-fill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" />
                  <stop offset="50%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>

                {/* Neon Cyan Gradient */}
                <linearGradient id="neon-grad-cyan" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
                  <stop offset="25%" stopColor="#22D3EE" stopOpacity="0.85" />
                  <stop offset="75%" stopColor="#6366F1" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </linearGradient>

                {/* Electric Purple Gradient */}
                <linearGradient id="neon-grad-purple" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                  <stop offset="30%" stopColor="#8B5CF6" stopOpacity="0.75" />
                  <stop offset="70%" stopColor="#EC4899" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </linearGradient>

                {/* Flowing Pulse Gradient */}
                <linearGradient id="neon-grad-pulse" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
                  <stop offset="45%" stopColor="#22D3EE" stopOpacity="0.95" />
                  <stop offset="80%" stopColor="#38BDF8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                </linearGradient>

                {/* Accent Gradient */}
                <linearGradient id="neon-grad-accent" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#EC4899" stopOpacity="0" />
                  <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </>
      )}

      {/* 3. Frost / Micro-grid layer */}
      <div className="ambient-glass-frost" />
    </div>
  );
}
