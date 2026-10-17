import {EVENT_LABELS,MARKET_LABELS} from './view.mjs';
export function tradeReference(event) {
  const ledger=event.ledger||(event.mode==='daytrade'?'daytrade':event.signalId?'swing':null);
  const tradeId=ledger==='daytrade'?event.tradeId||(event.mode==='daytrade'?event.id?.replace(/:(plan|entry|exit|review|expired)$/,''):null):ledger==='swing'?event.signalId:null;
  return ['daytrade','swing'].includes(ledger)&&tradeId&&MARKET_LABELS[event.market]?{ledger,tradeId,market:event.market}:null;
}
export function eventLabel(event) {
  if(event.type==='NEWS')return event.breaking?'Breaking News':event.publicHeadline?'ข่าวตลาดใหม่':'ข่าวสำคัญ';
  if(event.type==='TARGET')return (event.ledger==='swing'||event.signalId)?'ถึง TP1 · ปิดบางส่วน':event.mode==='daytrade'?'ถึง TP · ปิดไม้':'ถึง TP';
  return EVENT_LABELS[event.type]||event.type;
}
export function eventSpeech(event) {
  if(event.type==='NEWS')return `${eventLabel(event)} ${MARKET_LABELS[event.market]} ${event.title}`;
  return `${event.symbol} ${MARKET_LABELS[event.market]} ${event.side||''} ${eventLabel(event)} ราคาอ้างอิง ${event.price??'ไม่ระบุ'}`;
}
export function countedTrade(record,ledger) {
  return Number.isFinite(record.netR)&&(ledger==='daytrade'?record.status==='CLOSED':['STOP','CLOSED'].includes(record.status));
}
export const recordStatus={WAITING:'รอยืนยันเข้า',OPEN:'เข้าแล้ว · ยังติดตาม',RUNNER:'ปิดบางส่วน · ยังติดตาม',CLOSED:'ปิดครบแล้ว',STOP:'ปิดครบที่ Stop',REVIEW:'พักผล · ต้องตรวจข้อมูล',EXPIRED:'หมดอายุ · ไม่ได้เข้า'};
