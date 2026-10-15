import {ANNOUNCEMENT_TYPES} from './announcements.mjs';
export const EVENT_CURSOR_KEY='nugaom-autopick-last-event';
const LOCK_NAME='nugaom-signal-announcements';

// The visible tab owns announcement delivery. A shared cursor survives reloads;
// Web Locks serialize simultaneous polls in multiple tabs on the HTTPS site.
export async function claimAnnouncements(events,{storage,locks,visible=()=>true,memory={seen:null},now=Date.now()}={}){
  const claim=()=>{
    if(!visible()||!events?.length)return [];
    let seen=memory.seen;
    try{seen=storage?.getItem(EVENT_CURSOR_KEY)??seen;}catch{/* In-memory cursor still prevents repeats in this tab. */}
    const newest=events[0].id;
    let fresh=[];
    if(seen&&seen!==newest){
      const index=events.findIndex(event=>event.id===seen);
      fresh=(index<0?events.slice(0,1):events.slice(0,index)).filter(event=>
        ANNOUNCEMENT_TYPES.has(event.type)&&now-Date.parse(event.createdAt)>=0&&now-Date.parse(event.createdAt)<1800000
        &&(event.market==='us'||!event.barTime||now-(event.barTime+900)*1000<1800000)).reverse();
    }
    memory.seen=newest;
    try{storage?.setItem(EVENT_CURSOR_KEY,newest);}catch{/* Storage may be disabled by the browser. */}
    const priority=fresh.filter(event=>event.type!=='PICK_READY');
    const watch=fresh.filter(event=>event.type==='PICK_READY').at(-1);
    return [...priority,...(watch?[watch]:[])];
  };
  return locks?.request?locks.request(LOCK_NAME,{mode:'exclusive'},claim):claim();
}
