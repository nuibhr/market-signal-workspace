'use client';
import {useEffect,useRef,useState} from 'react';
import {clampMascot,restoreMascot,saveMascot,chatPlacement} from './assistant-position.mjs';
const KEY='nugaom-assistant-position-v1';
const viewport=()=>({width:window.innerWidth,height:window.visualViewport?.height??window.innerHeight});
export default function useDraggableMascot(){
 const [position,setPosition]=useState(null),[size,setSize]=useState(null),[dragging,setDragging]=useState(false);
 const current=useRef(null),drag=useRef(null),suppressClick=useRef(false);
 function place(next,persist=false){const v=viewport(),p=clampMascot(next,v);current.current=p;setPosition(p);if(persist)try{window.localStorage.setItem(KEY,saveMascot(p,v));}catch{}}
 useEffect(()=>{
   let raw;try{raw=window.localStorage.getItem(KEY);}catch{}
   const v=viewport();setSize(v);place(restoreMascot(raw,v));
   const resized=()=>{const next=viewport();setSize(next);place(current.current);};
   window.addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);
   return()=>{window.removeEventListener('resize',resized);window.visualViewport?.removeEventListener('resize',resized);};
 },[]);
 const pointer={
   onPointerDown(e){if(!e.isPrimary||e.button!==0||!current.current)return;suppressClick.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:current.current,moved:false};e.currentTarget.setPointerCapture(e.pointerId);},
   onPointerMove(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>6)d.moved=true;if(d.moved){suppressClick.current=true;setDragging(true);place({x:d.start.x+dx,y:d.start.y+dy});}},
   onPointerUp(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;if(d.moved)place(current.current,true);drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);},
   onPointerCancel(){if(drag.current?.moved)place(current.current,true);drag.current=null;setDragging(false);suppressClick.current=true;},
   onLostPointerCapture(){drag.current=null;setDragging(false);},
 };
 function keyDown(e){const steps={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(e.key==='Home'){e.preventDefault();place(clampMascot(null,viewport()),true);}else if(steps[e.key]&&current.current){e.preventDefault();const [x,y]=steps[e.key];place({x:current.current.x+x,y:current.current.y+y},true);}}
 return {position,dragging,pointer,keyDown,canClick:e=>e.detail===0||!suppressClick.current,chatStyle:position&&size?chatPlacement(position,size):undefined};
}
