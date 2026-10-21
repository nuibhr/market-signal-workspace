import {cleanBars,features,setupAt,entryPlan,exitOnBar,summarize,SETTINGS,roundPrice} from './engine.mjs';
import {thaiEquityTick} from '../analysis/thai-tick.mjs';

// Predeclared research candidate, not a production strategy or parameter search.
export const NATIVE_RESEARCH_SPEC=Object.freeze({version:'native-quality-net2r-research-v1',minimumMinutesRemaining:90,
  maximumTickPercent:0.5,maximumStopPercent:3,minimumRelativeVolume:1.2,
  minimumBarValue:{thai:500000,dr:100000},maximumChaseATR:0.25,targetNetR:2});
export function minutesToNativeClose(seconds){
  const d=new Date((seconds+7*3600)*1000),m=d.getUTCHours()*60+d.getUTCMinutes();
  return m>=600&&m<750?750-m:m>=840&&m<990?990-m:0;
}
export function nativeCandidateGates(asset,bars,index,setup,entryTime,plan){
  const s=NATIVE_RESEARCH_SPEC,b=bars[index],history=bars.slice(Math.max(0,index-20),index);
  const average=history.reduce((sum,r)=>sum+(r.volume||0),0)/history.length;
  return [
    ['TIME_LEFT',minutesToNativeClose(entryTime)>=s.minimumMinutesRemaining],
    ['TICK_COST',thaiEquityTick(plan.entry)/plan.entry*100<=s.maximumTickPercent],
    ['STOP_DISTANCE',plan.risk/plan.entry*100<=s.maximumStopPercent],
    ['VOLUME',average>0&&b.volume/average>=s.minimumRelativeVolume&&b.close*b.volume>=s.minimumBarValue[asset.market]],
    ['CHASE',plan.entry-setup.trigger<=s.maximumChaseATR*setup.atr],
  ];
}
export function netTargetPlan(asset,plan){
  const fee=plan.feeBps/10000,slip=plan.slippageBps/10000;
  // exit*(1-slip)*(1-fee)-entry*(1+fee) = 2 * initial price risk.
  const target=roundPrice((plan.entry*(1+fee)+2*plan.risk)/((1-slip)*(1-fee)),asset,'up');
  return {...plan,target};
}
export function replayNativeResearch(asset,input,{delaySeconds=900,scanLagSeconds=5,candidate=false,now=Date.now()}={}){
  const bars=cleanBars(input,now),values=features(bars),trades=[],rejections={};
  let active=null,pending=null,cooldown=0;
  const reject=code=>{rejections[code]=(rejections[code]||0)+1;};
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    if(pending&&!active&&b.time>=pending.publishedAt){
      const {setup,index}=pending;let plan=null;
      if(b.volume>0&&b.time<=setup.availableAt+delaySeconds+1800)plan=entryPlan(asset,setup,b.open,{spread:0,slippageBps:5,feeBps:10});
      if(plan&&candidate){const failed=nativeCandidateGates(asset,bars,index,setup,b.time,plan).filter(([,pass])=>!pass);for(const [code] of failed)reject(code);if(failed.length)plan=null;else plan=netTargetPlan(asset,plan);}
      if(plan)active={...setup,market:asset.market,symbol:asset.symbol,plan,entryTime:b.time,status:'OPEN',heldBars:0,lastBar:null,origin:'research-replay'};
      else reject('ENTRY_REJECTED');pending=null;
    }
    if(active){
      active.heldBars++;const result=exitOnBar(asset,active,b,active.lastBar);active.lastBar=b.time;
      if(result){trades.push({...active,...result});active=null;cooldown=SETTINGS.cooldownBars;}
      continue;
    }
    if(pending)continue;
    if(cooldown>0){cooldown--;continue;}
    const setup=setupAt(asset,bars,i,values);
    if(setup)pending={setup,index:i,publishedAt:setup.availableAt+delaySeconds+scanLagSeconds};
  }
  return {trades,rejections,summary:summarize(trades),open:active?1:0};
}
