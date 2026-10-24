const DAY=86400000;
export function extendThirtyDays(currentExpiry,now=Date.now()){
  const current=Date.parse(currentExpiry);
  return new Date(Math.max(now,Number.isFinite(current)?current:now)+30*DAY).toISOString();
}
