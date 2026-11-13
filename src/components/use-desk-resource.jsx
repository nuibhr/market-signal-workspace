'use client';
import {readApiJson} from '../security/api-response.mjs';
import {useEffect,useState} from 'react';
export function useDeskResource(url,{interval=60000,enabled=true}={}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!enabled)return;let stopped=false,timer;const controller=new AbortController();setData(null);setError('');
  async function load(){
   if(stopped)return;if(document.visibilityState==='hidden'){timer=setTimeout(load,interval);return;}
   setBusy(true);
   try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])}),d=await readApiJson(r);if(!r.ok)throw Error(d.code||d.error||'SOURCE_UNAVAILABLE');if(!stopped){setData(d);setError('');}}
   catch(e){if(!stopped&&e.name!=='AbortError'){setData(null);setError(e.message);}}
   finally{if(!stopped){setBusy(false);timer=setTimeout(load,interval);}}
  }
  const debounce=setTimeout(load,250);
  return()=>{stopped=true;controller.abort();clearTimeout(debounce);clearTimeout(timer);};
 },[url,enabled,interval,revision]);
 return {data,error,busy,reload:()=>setRevision(v=>v+1)};
}
