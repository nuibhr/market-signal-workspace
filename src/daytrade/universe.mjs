import { ALL_ASSETS } from '../markets/catalog.mjs';

export const CORE_FOREX = Object.freeze(['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','USDCHF','USDCAD','AUDUSD','NZDUSD']);
const exactPair = instrument => instrument.canonical_symbol ||
  (instrument.broker_symbol === `${instrument.currency_base}${instrument.currency_profit}` ? instrument.broker_symbol : null);
// ISO 10383 US equity venues; regional broker folders take precedence over exchange aliases.
const US_VENUES = new Set(['XNYS','ARCX','XASE','XCIS','XCHI','XNAS','XNMS','XNCM','XNGS','BATS']);
// Exact unsuffixed instruments verified in Nasdaq's official symbol directories on 2026-10-16.
// Broker exchange aliases here are not assumed valid for other symbols or servers.
const VERIFIED_US_FUNDS = new Map(Object.entries({VCX:'NYQ',DRAM:'BTQ',NASA:'PCQ',SMH:'NMQ',EWT:'NYS',SOXL:'PCQ',IGV:'NYS',FOTO:'NYS',DXYZ:'NYQ'}));
export function listingRegion(instrument) {
  if(!['share_cfds','etfs'].includes(instrument.category))return 'OTHER';
  const path=instrument.broker_path||'', exchange=(instrument.exchange||'').toUpperCase();
  if(/(?:^|[\\/])(?:UK|EU|AU|HK|CN|KR)(?:[\\/]|$)/i.test(path))return 'OTHER';
  if(/(?:^|[\\/])(?:US(?:\.24H)?|USA|United States)(?:[\\/]|$)/i.test(path))return 'US';
  if(US_VENUES.has(exchange)||/^(?:NASDAQ|NYSE(?: ARCA)?|AMEX|ARCA)$/.test(exchange))return 'US';
  if(['LSE','ASX','HKG','KSC','KOREA EXCHANGE','SHANGHAI STOCK EXCHANGE'].includes(exchange))return 'OTHER';
  if(instrument.category==='etfs'&&/^ETF[\\/]/i.test(path)&&VERIFIED_US_FUNDS.get(instrument.broker_symbol)===exchange)return 'US';
  return 'UNKNOWN';
}
// Currency alone cannot distinguish a US listing from an overseas USD listing.
export const usListing = instrument => listingRegion(instrument)==='US';
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
