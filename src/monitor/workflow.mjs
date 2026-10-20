export const FEATURED_LIMIT=5;
export const SCAN_PAGE_SIZE=7;
const stamp=value=>typeof value==='number'?value:Date.parse(value)||0;
export function rankedRadarRows(rows) {
  return [...rows].filter(r=>r.scored&&Number.isFinite(r.scored.totalScore))
    .sort((a,b)=>b.scored.totalScore-a.scored.totalScore||a.symbol.localeCompare(b.symbol));
}
export function pageRows(rows,page=1,size=SCAN_PAGE_SIZE) {
  const pages=Math.max(1,Math.ceil(rows.length/size));
  const current=Math.max(1,Math.min(pages,Math.floor(Number(page))||1));
  return {rows:rows.slice((current-1)*size,current*size),page:current,pages,total:rows.length};
}
export function tradeBucket(record,ledger) {
  if(record.status==='WAITING')return 'waiting';
  if(['OPEN','RUNNER'].includes(record.status))return 'tracking';
  if((ledger==='daytrade'?record.status==='CLOSED':['STOP','CLOSED'].includes(record.status))&&Number.isFinite(record.netR))return 'closed';
  return 'review';
}
export function workflowRecords(daytrade=[],swing=[]) {
  const unique=new Map();
  for(const [ledger,rows] of [['daytrade',daytrade],['swing',swing]])for(const r of rows) {
    if(!r.id)continue;
    const key=`${ledger}:${r.id}`,old=unique.get(key);
    if(old&&stamp(old.updatedAt??old.publishedAt)>stamp(r.updatedAt??r.publishedAt))continue;
    const bucket=tradeBucket(r,ledger);
    unique.set(key,{...r,key,ledger,bucket,outcome:bucket==='closed'?r.netR>0?'win':r.netR<0?'loss':'flat':null});
  }
  return [...unique.values()].sort((a,b)=>stamp(b.updatedAt??b.publishedAt)-stamp(a.updatedAt??a.publishedAt)||a.key.localeCompare(b.key));
}
export function workflowSummary(records) {
  const closed=records.filter(r=>r.bucket==='closed');
  const wins=closed.filter(r=>r.outcome==='win').length,losses=closed.filter(r=>r.outcome==='loss').length;
  return {closed:closed.length,wins,losses,flat:closed.length-wins-losses,winRate:closed.length?wins/closed.length*100:null};
}
