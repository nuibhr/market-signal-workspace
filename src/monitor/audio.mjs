import {createSignalSpeaker} from '../auto-pick/speech.mjs';
// One browser adapter queues all markets. Muting changes delivery only.
export function createMonitorAudio(browser,{onState=()=>{},visible=()=>true,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  let enabled=false,paused=false,current=null,timer=null;
  const queue=[];
  const drain=()=>{
    if(!enabled||paused||current||!queue.length||!visible())return;
    current=queue.shift();if(!current.eligible()){const p=current;current=null;p.done('historical');drain();return;}speaker.play(current.text);
  };
  const speaker=createSignalSpeaker(browser,(state,meta)=>{
    clearTimer(timer);onState(state);
    if(state==='starting')timer=setTimer(()=>{const p=current;current=null;paused=true;speaker.stop();onState('blocked');p?.done('blocked');},10000);
    if(state==='idle'&&meta?.reason==='ended'||['blocked','failed','unsupported'].includes(state)){
      const p=current;current=null;if(state!=='idle')paused=true;
      p?.done(meta?.reason==='ended'?'ended':state);if(state==='idle')drain();
    }
  });
  return {
    supported:speaker.supported,
    enable(value){enabled=value;paused=false;if(!value){clearTimer(timer);queue.splice(0).forEach(p=>p.done('muted'));current?.done('interrupted');current=null;speaker.stop();}else drain();},
    play(text,done=()=>{},eligible=()=>true){if(!enabled){done('muted');return false;}queue.push({text,done,eligible});drain();return true;},
    visible:drain,
    stop(){this.enable(false);},
    get enabled(){return enabled;},get pending(){return queue.length+(current?1:0);}
  };
}
