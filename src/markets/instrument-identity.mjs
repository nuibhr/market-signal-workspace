import {LOCAL_INSTRUMENT_LOGOS} from './local-logos.mjs';
// Thai/DR images are checked-in static assets, with provenance in sources.json.
// FMP's public endpoint remains available for the existing US broker universe.
// Map listing symbols, never guess a company from its display name or strip an
// arbitrary broker suffix. An unavailable image falls back to a local monogram.
const listing = /^[A-Z0-9][A-Z0-9.-]{0,19}$/;
export function instrumentIdentity({market,symbol='',underlyingSymbol=null,canonical_symbol=null}={}) {
  const raw = String(symbol).toUpperCase();
  const pair = String(canonical_symbol || raw).replace('/', '');
  if(market==='forex')return {label:pair.startsWith('XAU')?'Au':pair.startsWith('XAG')?'Ag':pair.slice(0,3),tone:pair.startsWith('XAU')?'gold':pair.startsWith('XAG')?'silver':'fx',url:null};
  if(market==='tfex')return {label:raw.startsWith('SVF')?'Ag':raw.startsWith('GO')?'Au':'50',tone:raw.startsWith('GO')?'gold':'index',url:null};
  let ticker = null;
  const local=LOCAL_INSTRUMENT_LOGOS[`${market}:${raw}`];
  if(market==='us'){
    const underlying=String(underlyingSymbol||'').toUpperCase();
    const broker=raw.replace(/\.24H$/, '');
    if(listing.test(underlying))ticker=underlying;
    else if(listing.test(broker)&&!broker.includes('.'))ticker=broker;
    else if(/^[A-Z]+\.[AB]$/.test(String(symbol).replace(/\.24H$/, '')))ticker=broker.replace('.', '-');
  }
  return {label:raw.replace(/[^A-Z0-9]/g,'').slice(0,2)||'—',tone:market||'stock',background:local?.background,url:local?.url??(ticker?`https://financialmodelingprep.com/image-stock/${encodeURIComponent(ticker)}.png`:null)};
}
