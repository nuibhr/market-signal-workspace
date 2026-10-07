'use client';
import { useEffect, useRef, useState } from 'react';
import { ALL_ASSETS } from '../markets/catalog.mjs';
const GUEST_KEY='nugaom-ai-pick-favorites';
const GUEST_CLAIM='nugaom-ai-pick-favorites-import-owner';
function guestItems() {
  try {
    const rows=JSON.parse(localStorage.getItem(GUEST_KEY)??localStorage.getItem('nova-favorites')??'[]');
    return Array.isArray(rows)?[...new Set(rows.filter(symbol=>typeof symbol==='string'&&ALL_ASSETS.some(item=>item.symbol===symbol)))]:[];
  }catch{return [];}
}
async function responseItems(response,memberId) {
  if(!response.ok)throw new Error('FAVORITES_UNAVAILABLE');
  const payload=await response.json();
  if(payload.memberId!==memberId||!Array.isArray(payload.items))throw new Error('FAVORITES_UNAVAILABLE');
  return payload;
}
export function useMemberFavorites({ready,memberId,marketId,onNotice}) {
  const [state,setState]=useState({owner:null,items:[],ready:false});
  const owner=memberId??'guest';
  const currentOwner=useRef(owner);currentOwner.current=owner;
  const pending=useRef(new Set());
  const latestState=useRef(state);
  latestState.current=state;
  const writes=useRef(Promise.resolve());
  function publish(next) {latestState.current=next;setState(next);}
  useEffect(()=>{
    if(!ready)return;
    const controller=new AbortController();
    if(!memberId) {
      publish({owner:'guest',items:guestItems(),ready:true});
      const sync=event=>{if(event.key===GUEST_KEY)publish({owner:'guest',items:guestItems(),ready:true});};
      window.addEventListener('storage',sync);
      return()=>{controller.abort();window.removeEventListener('storage',sync);};
    }
    async function load() {
      let payload=await responseItems(await fetch('/api/favorites',{cache:'no-store',signal:controller.signal}),memberId);
      if(!payload.imported) {
        let browserOwner;
        try {
          browserOwner=localStorage.getItem(GUEST_CLAIM);
          if(!browserOwner){localStorage.setItem(GUEST_CLAIM,memberId);browserOwner=memberId;}
        }catch{/* Do not import unclaimed data if this browser cannot remember its owner. */}
        // Remember the claim before sending: even a canceled response may have committed.
        const guest=new Set(browserOwner===memberId?guestItems():[]);
        const items=ALL_ASSETS.filter(item=>guest.has(item.symbol)).map(item=>({market:item.id,symbol:item.symbol}));
        payload=await responseItems(await fetch('/api/favorites',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'import',items}),signal:controller.signal}),memberId);
        // Imported browser data must not be copied into the next person's LINE account.
      }
      if(payload.imported&&currentOwner.current===memberId) {
        try{if(localStorage.getItem(GUEST_CLAIM)===memberId){localStorage.removeItem(GUEST_KEY);localStorage.removeItem('nova-favorites');}}
        catch{/* Storage can be unavailable. */}
      }
      if(!controller.signal.aborted)publish({owner:memberId,items:payload.items,ready:true});
    }
    load().catch(()=>{if(!controller.signal.aborted){publish({owner:memberId,items:[],ready:false});onNotice('ยังโหลดหุ้นโปรดไม่สำเร็จ กรุณารีเฟรชอีกครั้ง');}});
    return()=>controller.abort();
  },[ready,memberId,onNotice]);
  const available=ready&&state.owner===owner&&state.ready;
  const favorites=available?(memberId?state.items.filter(item=>item.market===marketId).map(item=>item.symbol):state.items):[];
  async function toggleFavorite(symbol) {
    if(!available){onNotice('กำลังโหลดหุ้นโปรด กรุณารอสักครู่');return;}
    const key=`${owner}:${marketId}:${symbol}`;
    if(pending.current.has(key))return;
    const saved=memberId?latestState.current.items.some(item=>item.market===marketId&&item.symbol===symbol):latestState.current.items.includes(symbol);
    if(!memberId) {
      const next=saved?latestState.current.items.filter(item=>item!==symbol):[...latestState.current.items,symbol];
      publish({owner:'guest',items:next,ready:true});
      try{
        if(next.length===0||next.length===1&&!saved)localStorage.removeItem(GUEST_CLAIM);
        localStorage.setItem(GUEST_KEY,JSON.stringify(next));
        onNotice(saved?`นำ ${symbol} ออกจากหุ้นโปรดแล้ว`:`บันทึก ${symbol} ในเครื่องนี้แล้ว · เข้าสู่ระบบ LINE เพื่อเก็บตามบัญชี`);
      }
      catch{onNotice('เบราว์เซอร์นี้เก็บรายการถาวรไม่ได้');}
      return;
    }
    pending.current.add(key);
    // Serialize member writes so an older full-list response cannot erase a newer click.
    const job=writes.current.catch(()=>{}).then(async()=>{
      try {
        if(currentOwner.current!==owner)return;
        const payload=await responseItems(await fetch('/api/favorites',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({market:marketId,symbol,saved:!saved})}),memberId);
        if(currentOwner.current===owner) {
          publish({owner,items:payload.items,ready:true});
          onNotice(saved?`นำ ${symbol} ออกจากหุ้นโปรดแล้ว`:`บันทึก ${symbol} ตามบัญชี LINE แล้ว`);
        }
      }catch{if(currentOwner.current===owner)onNotice('ยังบันทึกหุ้นโปรดไม่สำเร็จ กรุณาลองอีกครั้ง');}
      finally{pending.current.delete(key);}
    });
    writes.current=job;
    await job;
  }
  return {favorites,toggleFavorite};
}
