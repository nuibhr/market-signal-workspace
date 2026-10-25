export function sharedMarketRows(assets,records,env=process.env){
 const byId=new Map(records.map(r=>[r.instrument_id,r]));
 return assets.map(a=>{
  const r=byId.get(a.instrumentId),source=r?.source||'';
  let allowed=env.NODE_ENV!=='production';
  if(!allowed){
   if(source.includes('Yahoo'))allowed=env.YAHOO_DISPLAY_RIGHTS_CONFIRMED==='true';
   else if(source.includes('Financial Modeling Prep'))allowed=env.FMP_DISPLAY_RIGHTS_CONFIRMED==='true';
   else if(/Settrade|TFEX|Open API/i.test(source))allowed=(a.id==='tfex'?env.TFEX_DISPLAY_RIGHTS_CONFIRMED:env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED)==='true';
  }
  const available=allowed&&r?.symbol===a.symbol&&Number.isFinite(r?.price)&&r.price>0&&Number.isFinite(r.price_ms);
  return {symbol:a.symbol,name:a.name,market:a.id,instrumentId:a.instrumentId,price:available?r.price:null,changePercent:available&&r.previous_price>0?(r.price/r.previous_price-1)*100:null,source:available?source:null,priceAt:available?new Date(r.price_ms).toISOString():null,snapshotAt:available?r.snapshot_at||null:null,status:available?'available':'unavailable'};
 });
}
