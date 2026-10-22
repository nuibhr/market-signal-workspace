'use client';

import React from 'react';

/**
 * AmbientLiquidGlass
 * Ultra-smooth, GPU-accelerated Magic UI Aurora & Liquid Glass ambient background.
 * In Dark Mode: Dark Navy (#080D1B) with Neon Cyan (#22D3EE) & Electric Purple (#8B5CF6) glow,
 * plus a subtle digital wave overlay in empty background space.
 * In Light Mode: Crisp luxury white liquid frosted glass.
 */
export default function AmbientLiquidGlass({ isLight = false }) {
  return (
    <div className={`ambient-liquid-wrap ${isLight ? 'is-light' : 'is-dark'}`} aria-hidden="true">
      <div className="ambient-mesh-canvas">
        <div className="liquid-blob blob-1" />
        <div className="liquid-blob blob-2" />
        <div className="liquid-blob blob-3" />
        <div className="liquid-blob blob-4" />
      </div>
      {!isLight && (
        <div className="magic-digital-waves">
          <svg className="magic-waves-svg" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
            <path d="M0,320 C320,400 460,220 720,290 C980,360 1180,240 1440,300 L1440,900 L0,900 Z" fill="url(#magic-wave-grad)" opacity="0.03" />
            <path d="M0,480 C340,420 520,580 820,500 C1120,420 1260,550 1440,490" stroke="url(#magic-wave-cyan)" strokeWidth="1" strokeDasharray="3 6" opacity="0.22" />
            <path d="M0,640 C280,580 480,710 780,650 C1080,590 1260,680 1440,630" stroke="url(#magic-wave-purple)" strokeWidth="1" opacity="0.16" />
            <defs>
              <linearGradient id="magic-wave-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <linearGradient id="magic-wave-cyan" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
                <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="magic-wave-purple" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                <stop offset="50%" stopColor="#EC4899" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
      <div className="ambient-glass-frost" />
    </div>
  );
}
