export const MARKET_LABELS={thai:'หุ้นไทย',dr:'DR',tfex:'TFEX',us:'US CFD',forex:'Forex / Metals'};
export const EVENT_LABELS={PICK_READY:'พบแผน · รอยืนยันเข้า',ENTRY:'เข้าเงื่อนไขแล้ว',TARGET:'ถึง TP',STOP:'ถึง SL',EXIT:'จบแผน',AMBIGUOUS:'พักผล · ตรวจลำดับราคา',DATA_GAP:'ข้อมูลขาดช่วง',EXPIRED:'แผนหมดอายุ',NEAR_STOP:'ใกล้ Stop',STOP_MOVED:'เลื่อน Stop',SESSION_END:'จบช่วงติดตาม'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
// Display only: the scanner remains the sole authority for condition evaluation.
export function monitorRow(row,market,connection,now=Date.now()) {
  const quote=row.quote,quoteAt=quote?.time*1000;
  const quoteFresh=connection==='connected'&&finite(quote?.price)&&finite(quoteAt)&&now-quoteAt>=0&&now-quoteAt<=30000;
  const barAt=row.latestBar?(row.latestBar+900)*1000:null;
  const barFresh=finite(row.price)&&barAt!==null&&now-barAt>=0&&now-barAt<=30*60000&&!row.stale;
  const quality=quoteFresh?'Real-time':!finite(row.price)?'Unavailable':barFresh?'Delayed':'Stale';
  const evaluationValid=barFresh&&row.status==='READY'&&(!['us','forex'].includes(market)||connection==='connected');
  const plan=row.monitorPlan,target=plan?.entry??null,price=quoteFresh?quote.price:row.price;
  const distance=finite(target)&&finite(price)&&target!==0?(target-price)/target*100:null;
  const touched=distance!==null&&(plan?.side==='SHORT'?price<=target:price>=target);
  const met=evaluationValid&&Boolean(row.side||plan?.status==='OPEN');
  return {...row,market,quality,price,priceKind:quoteFresh?'Bid quote':'ปิดแท่ง 15m',sourceTime:quoteFresh?quoteAt:barAt,receivedAt:quoteFresh?quote.received_at:row.receivedAt,
    evaluationPrice:row.price,target,distance,touched,met,abnormal:!evaluationValid,
    condition:!evaluationValid?'ตรวจเงื่อนไขไม่ได้':met?plan?.status==='OPEN'?'เข้าเงื่อนไขแล้ว':'เข้าเงื่อนไขเทคนิค · รอแท่งเข้า':touched?'แตะระดับราคา · รอเงื่อนไขครบ':plan?'รอแท่งเข้า':'รอเงื่อนไข'};
}
export function filterRows(rows,{query='',group='all',status='all'}={}) {
  return rows.filter(r=>(group==='all'||r.market===group||group==='etf'&&r.kind==='etf_cfd')&&`${r.symbol} ${r.name}`.toLowerCase().includes(query.trim().toLowerCase())&&
    (status==='all'||status==='met'&&r.met||status==='abnormal'&&r.abnormal||status==='waiting'&&!r.met&&!r.abnormal||status==='near'&&r.near===true))
    .sort((a,b)=>(a.met?0:a.near===true?1:2)-(b.met?0:b.near===true?1:2)||a.symbol.localeCompare(b.symbol)||a.market.localeCompare(b.market));
}
// Project the existing forward records, including intermediate entry/exit fields.
// No ledger writes, invented price-crossing conditions, or replay records.
export function forwardEvents(records) {
  return records.flatMap(t=>{
    const base={symbol:t.symbol,market:t.market,mode:'daytrade',rule:'daytrade-trend-15m-v1',detail:'ตามเทรนด์ EMA20/50 · ยืนยันแท่งปิด 15m · ราคาอ้างอิง',stopLoss:t.plan?.stop??t.stop,tp1:t.plan?.target};
    const event=(type,at,price,stage)=>({...base,id:`${t.id}:${stage}`,type,price,createdAt:new Date(at).toISOString(),priceAt:new Date(at).toISOString()});
    const out=[event('PICK_READY',t.publishedAt,t.trigger,'plan')];
    if(t.entryTime&&t.plan)out.push(event('ENTRY',t.entryTime*1000,t.plan.entry,'entry'));
    if(t.exitTime)out.push(event(t.status==='REVIEW'?t.reason==='AMBIGUOUS_TP_SL'?'AMBIGUOUS':'DATA_GAP':t.reason==='TP'?'TARGET':['SL','SL_GAP'].includes(t.reason)?'STOP':'EXIT',t.exitTime*1000,t.exit??null,'exit'));
    return out;
  });
}
