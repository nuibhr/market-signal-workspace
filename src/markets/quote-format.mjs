export function quoteDigits(asset, value) {
  if (asset?.id === 'forex') {
    if (asset.symbol.startsWith('XAU/')) return 2;
    if (asset.symbol.startsWith('XAG/')) return 3;
    return asset.symbol.endsWith('/JPY') ? 3 : 5;
  }
  if (asset?.id === 'us') return value < 1 ? 4 : 2;
  return value < 1 ? 5 : 2;
}

export function formatQuotePrice(value, asset) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const digits = quoteDigits(asset, value);
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
