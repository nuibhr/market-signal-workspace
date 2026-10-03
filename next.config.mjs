const headers = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
export default {
  poweredByHeader: false,
  distDir: process.env.NUGAOM_REVIEW_MODE === 'true' ? '.next-review' : '.next',
  // Local databases, SDK runtimes and diagnostics are runtime state, not release files.
  outputFileTracingExcludes: { '/*': ['./data/**/*'] },
  outputFileTracingIncludes: { '/api/admin/webull': [
    './scripts/scan-webull.mjs', './scripts/webull-bars.py', './src/webull-lab/**/*.mjs',
    './src/analysis/technical.mjs', './src/analysis/pivots.mjs', './src/analysis/chart-levels.mjs',
    './src/analysis/us-candles.mjs', './src/markets/us-liquid-500.mjs', './src/markets/us-universe.mjs',
  ] },
  async headers() { return [{ source: '/:path*', headers }]; },
};
