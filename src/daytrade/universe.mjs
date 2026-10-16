import { ALL_ASSETS } from '../markets/catalog.mjs';

export const CORE_FOREX = Object.freeze(['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','USDCHF','USDCAD','AUDUSD','NZDUSD']);
const exactPair = instrument => instrument.canonical_symbol ||
  (instrument.broker_symbol === `${instrument.currency_base}${instrument.currency_profit}` ? instrument.broker_symbol : null);
// Currency alone cannot distinguish a US listing from an overseas USD listing.
export function usListing(instrument) {
  const region = `${instrument.exchange || ''}\\${instrument.broker_path || ''}`;
  return ['share_cfds','etfs'].includes(instrument.category) &&
    /(?:^|[\\/\s_-])(?:US|USA|NASDAQ|NYSE|AMEX|ARCA|United States|US Shares|US Stocks)(?:$|[\\/\s_-])/i.test(region);
}
export function cfdUniverse(instruments, market) {
  return instruments.filter(i => market === 'forex' ? CORE_FOREX.includes(exactPair(i)) : usListing(i))
    .map(i => ({ ...i, market, symbol:i.broker_symbol, name:i.description,
      instrumentId:i.id, point:i.point, instrumentType:i.category === 'etfs' ? 'etf_cfd' : market === 'us' ? 'stock_cfd' : 'spot_cfd',
      underlyingSymbol:i.underlying_symbol || null, volumeSource:market === 'us' ? 'underlying-pending' : 'tick-only' }));
}
export function nativeUniverse(market) {
  return ALL_ASSETS.filter(a => a.id === market && ['thai','dr','tfex'].includes(market))
    .map(a => ({ ...a, market, point:a.tickSize || null, instrumentType:market === 'tfex' ? 'future' : market === 'dr' ? 'dr' : 'stock', volumeSource:'exchange' }));
}
export const canShort = asset => asset.market === 'tfex' ||
  ['us','forex'].includes(asset.market) && asset.trade_mode === 4;
