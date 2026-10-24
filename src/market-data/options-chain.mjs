export function summarizeOptionChain(rows){
 const complete=rows.filter(r=>Number.isFinite(r.callOi)&&Number.isFinite(r.putOi));
 if(!complete.length)return {totalCallOi:null,totalPutOi:null,pcr:null,maxPain:null,covered:0};
 const totalCallOi=complete.reduce((s,r)=>s+r.callOi,0),totalPutOi=complete.reduce((s,r)=>s+r.putOi,0);
 const payouts=complete.map(r=>({strike:r.strike,payout:complete.reduce((s,x)=>s+Math.max(0,r.strike-x.strike)*x.callOi+Math.max(0,x.strike-r.strike)*x.putOi,0)}));
 return {totalCallOi,totalPutOi,pcr:totalCallOi>0?totalPutOi/totalCallOi:null,maxPain:payouts.sort((a,b)=>a.payout-b.payout||a.strike-b.strike)[0].strike,covered:complete.length};
}
