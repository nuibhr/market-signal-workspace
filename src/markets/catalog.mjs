// Dated search catalogue. Membership is separate from price availability.
// SET100: official 2026 H2 constituent snapshot used by the previous scanner.
// mai: user's 50-name initial list; market-cap ranking is still unverified.
// DR80: KTB's 2026-08-14 list plus the 28 new KTB DRs listed 2026-09-09.
import { US_WATCHLIST } from './us-watchlist.mjs';

export const SET100_SYMBOLS = [
  'AAV', 'ADVANC', 'AEONTS', 'AMATA', 'AOT', 'AP', 'AURA', 'AWC', 'BA', 'BAM',
  'BANPU', 'BBL', 'BCH', 'BCP', 'BCPG', 'BDMS', 'BEM', 'BGRIM', 'BH', 'BJC',
  'BLA', 'BTG', 'BTS', 'CBG', 'CCET', 'CENTEL', 'CHG', 'CK', 'COM7', 'CPALL',
  'CPF', 'CPN', 'CRC', 'DELTA', 'DOHOME', 'EA', 'EGCO', 'ERW', 'GFPT', 'GLOBAL',
  'GPSC', 'GULF', 'GUNKUL', 'HANA', 'HMPRO', 'ICHI', 'IRPC', 'IVL', 'JMT', 'JTS',
  'KBANK', 'KCE', 'KKP', 'KTB', 'KTC', 'LH', 'M', 'MEGA', 'MINT', 'MOSHI',
  'MRDIYT', 'MTC', 'OR', 'OSP', 'PLANB', 'PR9', 'PRM', 'PTG', 'PTT', 'PTTEP',
  'PTTGC', 'QH', 'RATCH', 'RCL', 'SAWAD', 'SCB', 'SCC', 'SCGP', 'SIRI', 'SPALI',
  'SPRC', 'STA', 'STECON', 'STGT', 'TASCO', 'TCAP', 'TFG', 'THAI', 'THCOM', 'TIDLOR',
  'TISCO', 'TLI', 'TOA', 'TOP', 'TRUE', 'TTB', 'TU', 'VGI', 'WHA', 'WHAUP',
];

export const MAI_INITIAL_SYMBOLS = [
  'ADB', 'ARIP', 'ASTR', 'AU', 'BBIK', 'BOL', 'CHO', 'CHOW', 'D', 'DITTO',
  'FLOYD', 'FSMART', 'GLORY', 'HUMAN', 'IRCP', 'JSP', 'KCC', 'KUMWEL', 'KUN', 'LIGHT',
  'LIT', 'MASTER', 'MVP', 'NDR', 'NETBAY', 'PJW', 'PLUS', 'PPS', 'PROEN', 'PSGC',
  'PSTC', 'QTC', 'SECURE', 'SELIC', 'SICT', 'SMART', 'SNNP', 'SPA', 'SUN', 'TACC',
  'TAKUNI', 'TEAMG', 'TITLE', 'TM', 'TPCH', 'TRT', 'TSTE', 'UAC', 'WARRIX', 'XO',
];

export const DR80_SYMBOLS = [
  'AAPL80', 'ABBV80', 'ADVANT80', 'AMD80', 'AMZN80', 'ANET80', 'AVGO80', 'BABA80', 'BIDU80', 'BKNG80',
  'BOEING80', 'BRKB80', 'BYDCOM80', 'CAMBRI80', 'CATL80', 'CNRE80', 'COHR80', 'COIN80', 'COSTCO80', 'CRM80',
  'CRWD80', 'CYPC80', 'DBO80', 'DISCO80', 'DOLLARG80', 'ESTEE80', 'FERRARI80', 'GANFENG80', 'GEELY80', 'GEV80',
  'GIGA80', 'GLW80', 'GOLDUS80', 'GOOG80', 'GRAB80', 'HERMES80', 'HOOD80', 'HYGON80', 'IFLYTEK80', 'ISRG80',
  'JD80', 'JLMAG80', 'KO80', 'KUAISH80', 'LITE80', 'LLY80', 'LOREAL80', 'LRCX80', 'MA80', 'MAOGEP80',
  'MEITUAN80', 'META80', 'MICRON80', 'MIDEA80', 'MIXUE80', 'MNSO80', 'MONTAGE80', 'MOUTAI80', 'MP80', 'MRVL80',
  'MSFT80', 'NAURA80', 'NBIS80', 'NEE80', 'NETEASE80', 'NFLX80', 'NIKE80', 'NIKKEI80', 'NONGFU80', 'NOVOB80',
  'NVDA80', 'ORCL80', 'PANW80', 'PEP80', 'PETROCN80', 'PINGAN80', 'PNG80', 'POPMART80', 'RKLB80', 'SANOFI80',
  'SANRIO80', 'SBUX80', 'SCHDER80', 'SHINCHEM80', 'SINGTEL80', 'SNDK80', 'SOFTBANK80', 'SONY80', 'SP500US80', 'SPACEX80',
  'SPBOND80', 'SPCOM80', 'SPENGY80', 'SPFIN80', 'SPHLTH80', 'SPTECH80', 'SUNNY80', 'TEL80', 'TENCENT80', 'TER80',
  'TOYOTA80', 'TRIPCOM80', 'TSLA80', 'UNIQLO80', 'VGT80', 'VICR80', 'VISA80', 'VRT80', 'WMT80', 'WUXIAT80',
  'XIAOMI80', 'ZIJIN80', 'ZJINNO80', 'AJINO80', 'AMEC80', 'CH30080', 'CHAI80', 'CHNEXT80', 'CHSTAR5080', 'DEYE80',
  'HUAHONG80', 'IBIDEN80', 'KIOXIA80', 'LUXSHARE80', 'SUNGROW80', 'AMAT80', 'BE80', 'CAT80', 'CBRS80', 'CRDO80',
  'DELL80', 'FABRINET80', 'HPE80', 'INTEL80', 'PLTR80', 'PWR80', 'QCOM80', 'SEAGATE80', 'TSEMI80', 'TTMI80',
  'AIRBUS80',
];

export const TFEX_SYMBOLS = ['S50U26', 'GOU26', 'SVFU26'];
export const FOREX_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'CAD/JPY', 'NZD/JPY',
  'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'XAU/USD', 'XAG/USD',
];
export const US_STOCKS = US_WATCHLIST.filter(item => item.kind === 'stock');
export const US_ETFS = US_WATCHLIST.filter(item => item.kind === 'etf');
export const INTERNATIONAL_SYMBOLS = US_WATCHLIST.map(item => item.symbol);
export const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

const DISPLAY_NAMES = {
  PTT: 'ปตท.', AOT: 'ท่าอากาศยานไทย', DELTA: 'เดลต้า อีเลคโทรนิคส์',
  AAPL80: 'Apple DR', NVDA80: 'NVIDIA DR',
  S50U26: 'SET50 Futures · Sep 2026', GOU26: 'Gold Online Futures · Sep 2026',
  SVFU26: 'Silver Online Futures · Sep 2026',
  NVDA: 'NVIDIA', AAPL: 'Apple', SPY: 'SPDR S&P 500 ETF',
  BTCUSDT: 'Bitcoin / Tether · Spot', ETHUSDT: 'Ethereum / Tether · Spot',
  'XAU/USD': 'Gold / US Dollar', 'XAG/USD': 'Silver / US Dollar',
};
const DEMO_PRICES = {
  'EUR/USD': '1.08426', 'GBP/USD': '1.27184', 'USD/JPY': '149.382',
  'AUD/USD': '0.65428', 'XAU/USD': '2,345.70',
  NVDA: '142.68', AAPL: '211.30', SPY: '588.44',
  BTCUSDT: '64,280.50', ETHUSDT: '2,485.20',
};
const GROUPS = [
  { id: 'thai', label: 'หุ้นไทย', detail: 'SET100 · mai 50', sections: [
    { id: 'SET100', label: 'SET100 · snapshot 2026 H2', symbols: SET100_SYMBOLS },
    { id: 'MAI_INITIAL', label: 'mai 50 · รอยืนยันอันดับ Market Cap', symbols: MAI_INITIAL_SYMBOLS },
  ] },
  { id: 'dr', label: 'DR', detail: 'DR80 · KTB', sections: [
    { id: 'DR80', label: 'DR80 · snapshot 25 ก.ย. 2026', symbols: DR80_SYMBOLS },
  ] },
  { id: 'tfex', label: 'TFEX', detail: 'ทอง · เงิน · SET50', sections: [
    { id: 'TFEX', label: 'TFEX · สัญญาที่ตรวจราคาได้', symbols: TFEX_SYMBOLS },
  ] },
  { id: 'us', label: 'หุ้นอเมริกา', detail: 'หุ้น 200 · ETF 50', sections: [
    { id: 'US_STOCKS', label: 'หุ้นสหรัฐฯ · watchlist 200', symbols: US_STOCKS.map(item => item.symbol) },
    { id: 'US_ETFS', label: 'ETF · watchlist 50', symbols: US_ETFS.map(item => item.symbol) },
  ] },
  { id: 'forex', label: 'Forex', detail: 'คู่เงิน · โลหะสปอต', sections: [
    { id: 'FOREX', label: 'Forex · รายการเริ่มต้น', symbols: FOREX_SYMBOLS },
  ] },
  { id: 'crypto', label: 'คริปโต', detail: 'Spot · รอง', sections: [
    { id: 'CRYPTO_SPOT', label: 'Crypto Spot · รายการเริ่มต้น', symbols: CRYPTO_SYMBOLS },
  ] },
];

export const MARKET_GROUPS = GROUPS.map(group => ({
  ...group,
  sections: group.sections.map(section => ({
    ...section,
    assets: section.symbols.map(symbol => ({
      id: group.id,
      symbol,
      instrumentId: `${section.id}:${symbol}`,
      sectionId: section.id,
      name: group.id === 'us' ? US_WATCHLIST.find(item => item.symbol === symbol)?.name ?? symbol : DISPLAY_NAMES[symbol] ?? symbol,
      theme: group.id === 'us' ? US_WATCHLIST.find(item => item.symbol === symbol)?.theme ?? null : null,
      price: group.id === 'us' || group.id === 'forex' ? '—' : DEMO_PRICES[symbol] ?? '—',
      change: '—',
      source: '—',
      feed: group.id === 'thai' || group.id === 'dr' ? 'settrade-daily' : group.id === 'us' || group.id === 'forex' ? 'fmp-quote' : 'unconnected',
    })),
  })),
}));

export const MARKET_ASSETS = Object.fromEntries(MARKET_GROUPS.map(group => [group.id, group.sections.flatMap(section => section.assets)]));
export const ALL_ASSETS = MARKET_GROUPS.flatMap(group => group.sections.flatMap(section => section.assets));
export const SETTRADE_SYMBOLS = new Set(ALL_ASSETS.filter(asset => asset.feed === 'settrade-daily').map(asset => asset.symbol));
