'use client';

import React from 'react';

/**
 * AmbientLiquidGlass
 * Ultra-smooth, GPU-accelerated ethereal liquid ambient background.
 * Provides subtle motion without distracting from trading charts.
 */
export default function AmbientLiquidGlass({ isLight = true }) {
  return (
    <div className={`ambient-liquid-wrap ${isLight ? 'is-light' : 'is-dark'}`} aria-hidden="true">
      <div className="ambient-mesh-canvas">
        <div className="liquid-blob blob-1" />
        <div className="liquid-blob blob-2" />
        <div className="liquid-blob blob-3" />
        <div className="liquid-blob blob-4" />
      </div>
      <div className="ambient-glass-frost" />
    </div>
  );
}
