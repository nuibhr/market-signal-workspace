import { FOREX_SYMBOLS } from "../../markets/catalog.mjs";

export const FOREX_CATEGORIES = Object.freeze([
  { id: "fx", label: "FX" },
  { id: "metals", label: "Metals" },
  { id: "indices", label: "Indices" },
  { id: "energy", label: "Energy" },
  { id: "commodities", label: "Commodities" },
  { id: "crypto_cfds", label: "Crypto CFDs" },
  { id: "share_cfds", label: "Share CFDs" },
  { id: "etfs", label: "ETFs" },
  { id: "bonds", label: "Bonds" },
]);

/**
 * Instrument metadata contract. Unknown terminal properties remain null, never guessed.
 * @typedef {Object} ForexInstrument
 * @property {string} id Stable source/broker/server/symbol-scoped identifier
 * @property {'starter'|'mt5'} source
 * @property {string|null} broker_id
 * @property {string|null} server
 * @property {string} display_symbol
 * @property {string|null} broker_symbol Exact terminal name including suffix; null in guest mode
 * @property {string|null} canonical_symbol Explicit mapping; may be null for an unmapped broker symbol
 * @property {string|null} category One of FOREX_CATEGORIES; null if not yet classified
 * @property {string} description
 * @property {number|null} digits
 * @property {number|null} point
 * @property {number|null} contract_size
 * @property {number|null} volume_min
 * @property {number|null} volume_max
 * @property {number|null} volume_step
 * @property {string|null} currency_base
 * @property {string|null} currency_profit
 * @property {string|null} currency_margin
 * @property {number|null} trade_mode Raw MT5 trade-mode enum; null when unavailable
 * @property {{timezone:string, intervals:Array<{day:number, open:string, close:string}>}|null} session
 */
/**
 * @typedef {Object} SymbolUniverseSnapshot
 * @property {1} schema_version
 * @property {'starter'|'mt5'} source
 * @property {string|null} broker_id
 * @property {string|null} server
 * @property {string|null} synced_at ISO UTC timestamp
 * @property {ForexInstrument[]} instruments Full metadata snapshot, distinct from quotes
 */
export const STARTER_UNIVERSE = Object.freeze(
  FOREX_SYMBOLS.map((symbol) => {
    const [base, profit] = symbol.split("/");
    return Object.freeze({
      id: `starter:${symbol}`,
      source: "starter",
      broker_id: null,
      server: null,
      display_symbol: symbol,
      broker_symbol: null,
      canonical_symbol: symbol.replace("/", ""),
      category: ["XAU", "XAG"].includes(base) ? "metals" : "fx",
      description: `${base === "XAU" ? "Gold" : base === "XAG" ? "Silver" : base} / ${profit === "USD" ? "US Dollar" : profit}`,
      digits: null,
      point: null,
      contract_size: null,
      volume_min: null,
      volume_max: null,
      volume_step: null,
      currency_base: base,
      currency_profit: profit,
      currency_margin: null,
      trade_mode: null,
      session: null,
    });
  }),
);
export const STARTER_SNAPSHOT = Object.freeze({
  schema_version: 1,
  source: "starter",
  broker_id: null,
  server: null,
  synced_at: null,
  instruments: STARTER_UNIVERSE,
});

export function filterUniverse(
  instruments,
  { query = "", category = "all", favorites = null } = {},
) {
  const term = query.trim().toLowerCase();
  return instruments.filter(
    (item) =>
      (category === "all" ||
        (category === "unclassified"
          ? item.category === null
          : item.category === category)) &&
      (!favorites || favorites.includes(item.id)) &&
      (!term ||
        [
          item.display_symbol,
          item.broker_symbol,
          item.canonical_symbol,
          item.description,
        ].some((value) => value?.toLowerCase().includes(term))),
  );
}
export function resolveInitialInstrument(
  symbol,
  instruments = STARTER_UNIVERSE,
) {
  return (
    instruments.find(
      (item) =>
        item.display_symbol === symbol || item.canonical_symbol === symbol,
    ) ?? instruments[0]
  );
}
