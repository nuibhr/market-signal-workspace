import YahooFinance from 'yahoo-finance2';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { storage } from '../storage/database.mjs';
let cached,pending;
const native=createSettradeClient();
const silent=()=>{};
const yahoo=new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,logger:{info:silent,warn:silent,error:silent,debug:silent,dir:silent},fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(12000)})});
export function validateSetIndexQuote(q,now=Date.now()){
 const time=new Date(q?.regularMarketTime).getTime();
 if(q?.symbol!=='^SET.BK'||q.quoteType!=='INDEX'||q.currency!=='THB'||q.exchange!=='SET'||
   !Number.isFinite(q.regularMarketPrice)||q.regularMarketPrice<=0||!Number.isFinite(q.regularMarketChangePercent)||!Number.isFinite(time)||time>now)return null;
 return {symbol:'SET',price:q.regularMarketPrice,changePercent:q.regularMarketChangePercent,time,priceAt:new Date(time).toISOString(),source:'Yahoo Finance · SET Index',basis:'provider-quote-minimum-15m'};
}
export async function signalMarketOverview(market){
 if(process.env.SHARED_MARKET_DATA_MODE==='daily')return {index:null,marketStatus:'ข้อมูลส่วนกลางรอบรายวัน',marketStatusAt:null};
 if(!['thai','dr'].includes(market))return null;
 if(cached?.until>Date.now())return cached.value;
 if(pending)return pending;
 pending=(async()=>{
  const value={index:null,marketStatus:null,marketStatusAt:null};
  if(process.env.NODE_ENV!=='production'||process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED==='true'){
   try{const now=Date.now(),quote=await yahoo.quote('^SET.BK'),point=validateSetIndexQuote(quote,now);
    let points=[];
    try{const row=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?','signal-set-index-samples-v1',now);const stored=row?JSON.parse(row.payload_json):[];
      if(Array.isArray(stored))points=stored.filter(p=>p.symbol==='SET'&&p.basis==='provider-quote-minimum-15m'&&Number.isFinite(p.time)&&p.time<=now&&p.time>now-5*86400000&&Number.isFinite(p.price)&&p.price>0&&Number.isFinite(p.changePercent));
    }catch{}
    if(point){points=[...new Map([...points,point].map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time).slice(-60);
      try{await storage.run('INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at','signal-set-index-samples-v1',JSON.stringify(points),now+5*86400000);}catch{}
    }
    value.index=points.filter(p=>p.time<=now-900000).at(-1)||null;
    if(typeof quote.marketState==='string'){value.marketStatus=`Yahoo ${quote.marketState}`;value.marketStatusAt=new Date(now).toISOString();value.marketStatusBasis='Provider marketState; may include intraday break';}
   }catch{/* A missing index is unavailable, never a stock/index proxy. */}
  }
  if(native.configuration.configured&&(process.env.NODE_ENV!=='production'||process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED==='true')){
   try{const quote=await native.getQuote('PTT');if(quote.observedAt&&Date.now()-Date.parse(quote.observedAt)<20*60000){value.marketStatus=quote.marketStatus||null;value.marketStatusAt=quote.observedAt;value.marketStatusBasis='PTT quote marketStatus from Settrade';}}catch{}
  }
  cached={until:Date.now()+60000,value};return value;
 })().finally(()=>{pending=null;});return pending;
}
