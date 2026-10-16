// Vantage publishes GMT+2 standard / GMT+3 summer server time. This bounded
// bootstrap is opt-in and also requires an independently observed current clock.
// https://global.vantagehelpcenter.com/hc/es/articles/10955835737871--C%C3%B3mo-cambio-la-hora-que-se-muestra-en-la-plataforma-de-operaciones
// Be conservative during weeks when US and European DST differ: accept neither
// historical interpretation then. This is a broker-policy inference, not an
// independently attested historical UTC feed.
const formatters=new Map();
function zoneOffset(zone,seconds){
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  const p=Object.fromEntries(formatters.get(zone).formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
  return (Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)/1000-seconds)/60;
}
export function historyFloor(clock,config,now){
  const observed=clock?.history_since??Math.floor(now/1000);
  if(config.historyPolicy!=='vantage-season-window-v1'||clock?.status!=='ready'||now-clock.last_at>30000||![120,180].includes(clock.offset_minutes))return observed;
  const current=Math.floor(now/1000),floor=current-7*86400;
  const consistent=t=>zoneOffset('America/New_York',t)+420===clock.offset_minutes&&zoneOffset('Europe/Athens',t)===clock.offset_minutes;
  if(!consistent(current))return observed;
  let earliest=current;
  for(let t=current;t>=floor;t-=3600){if(!consistent(t))break;earliest=t;}
  return Math.min(observed,earliest);
}
