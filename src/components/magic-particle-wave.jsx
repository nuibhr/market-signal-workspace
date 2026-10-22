'use client';

import { useEffect, useRef } from 'react';

/**
 * MagicParticleWave
 * High-performance 3D Particle Wave Mesh for Futuristic AI Terminal aesthetic.
 * Renders an undulating cybernetic particle grid using HTML5 Canvas (30-60fps).
 * Automatically throttled, pauses when tab is hidden, respects prefers-reduced-motion.
 */
export default function MagicParticleWave() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = 0;
    let height = 0;
    let time = 0;
    let lastTime = performance.now();
    let isVisible = true;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isReduced = mediaQuery.matches;

    // Grid configuration: 36 columns x 14 rows
    const COLS = 36;
    const ROWS = 14;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    resize();

    function render(now) {
      if (!isVisible) return;
      
      animId = requestAnimationFrame(render);

      // Throttle to max 35fps for zero CPU impact during active chart interaction
      const elapsed = now - lastTime;
      if (elapsed < 1000 / 35) return;
      lastTime = now;

      if (!isReduced) {
        time += Math.min(elapsed / 1000, 0.05) * 0.75;
      }

      ctx.clearRect(0, 0, width, height);

      // Base placement: Lower half & bottom-right flowing forward in 3D perspective
      const originX = width * 0.52;
      const originY = height * 0.65;
      const spacingX = width / (COLS * 0.85);
      const spacingY = (height * 0.45) / ROWS;

      const points = [];

      // Calculate 3D grid points
      for (let r = 0; r < ROWS; r++) {
        points[r] = [];
        const depthFactor = 0.5 + (r / ROWS) * 0.8; // Perspective scaling
        const rowY = originY + (r - ROWS * 0.3) * spacingY;

        for (let c = 0; c < COLS; c++) {
          const colX = (c - COLS * 0.5) * spacingX * depthFactor + originX;

          // Multi-frequency wave calculation (Organic AI data flow)
          const wave1 = Math.sin(c * 0.28 + time * 0.9 + r * 0.15) * 18;
          const wave2 = Math.cos(r * 0.38 - time * 0.7 + c * 0.12) * 14;
          const wave3 = Math.sin((c + r) * 0.18 + time * 0.5) * 10;
          
          const y = rowY + (wave1 + wave2 + wave3) * depthFactor;
          points[r][c] = { x: colX, y, depth: depthFactor };
        }
      }

      // Draw subtle connecting mesh lines
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = points[r][c];

          // Horizontal connect
          if (c < COLS - 1) {
            const nextP = points[r][c + 1];
            const alpha = Math.max(0.02, 0.12 * p.depth);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nextP.x, nextP.y);
            ctx.stroke();
          }

          // Vertical connect
          if (r < ROWS - 1) {
            const nextP = points[r + 1][c];
            const alpha = Math.max(0.015, 0.08 * p.depth);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nextP.x, nextP.y);
            ctx.stroke();
          }

          // Draw Glowing Particles at intersections
          const isKeyNode = (c % 2 === 0 && r % 2 === 0);
          const radius = (isKeyNode ? 1.6 : 0.9) * p.depth;
          const pAlpha = isKeyNode ? 0.35 * p.depth : 0.18 * p.depth;

          // Color gradient: Cyan on left to Purple/Pink on right
          const colorRatio = c / COLS;
          let fillStyle;
          if (colorRatio < 0.45) {
            fillStyle = `rgba(34, 211, 238, ${pAlpha})`;
          } else if (colorRatio < 0.75) {
            fillStyle = `rgba(99, 102, 241, ${pAlpha})`;
          } else {
            fillStyle = `rgba(139, 92, 246, ${pAlpha})`;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = fillStyle;
          ctx.fill();

          // Subtle glow around key nodes
          if (isKeyNode && p.depth > 0.8) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * 2.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 211, 238, ${pAlpha * 0.2})`;
            ctx.fill();
          }
        }
      }

      // If user requested reduced motion, stop after one frame
      if (isReduced) {
        cancelAnimationFrame(animId);
      }
    }

    const onVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible && !isReduced) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animId);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="magic-particle-canvas" aria-hidden="true" />;
}
