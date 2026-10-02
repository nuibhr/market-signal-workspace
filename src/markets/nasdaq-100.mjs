// Nasdaq 100 securities: official Nasdaq snapshot dated 2026-05-01, adjusted for
// the five additions/removals effective 2026-06-22. Review against Nasdaq before
// the next constituent change; this static list is not a live index feed.
// Sources: https://www.nasdaq.com/docs/2026/05/04/NDX.pdf
// https://ir.nasdaq.com/news-releases/news-release-details/nasdaq-100-indexr-june-2026-quarterly-changes
export const NASDAQ100_AS_OF = '2026-06-22';

export const NASDAQ100_SYMBOLS = Object.freeze([
  'ADBE', 'AMD', 'ABNB', 'ALNY', 'GOOGL', 'GOOG', 'AMZN', 'AEP', 'AMGN', 'ADI',
  'AAPL', 'AMAT', 'APP', 'ARM', 'ASML', 'ADSK', 'ADP', 'AXON', 'BKR', 'BKNG',
  'AVGO', 'CDNS', 'CTAS', 'CSCO', 'CCEP', 'CMCSA', 'CEG', 'CPRT', 'CSGP', 'COST',
  'CRWD', 'CSX', 'DDOG', 'DXCM', 'FANG', 'DASH', 'EA', 'EXC', 'FAST', 'FER',
  'FTNT', 'GEHC', 'GILD', 'HON', 'IDXX', 'ALAB', 'INTC', 'INTU', 'ISRG', 'KDP',
  'KLAC', 'KHC', 'LRCX', 'LIN', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP', 'MU',
  'MSFT', 'MDLZ', 'MPWR', 'MNST', 'NFLX', 'NVDA', 'NXPI', 'ORLY', 'ODFL', 'PCAR',
  'PLTR', 'PANW', 'PAYX', 'PYPL', 'PDD', 'PEP', 'QCOM', 'REGN', 'ROP', 'ROST',
  'SNDK', 'STX', 'SHOP', 'SBUX', 'MSTR', 'SNPS', 'TMUS', 'TTWO', 'TSLA', 'TXN',
  'TRI', 'VRTX', 'WMT', 'WDC', 'WDAY', 'WBD', 'XEL', 'CRWV', 'NBIS', 'RKLB', 'TER',
]);
