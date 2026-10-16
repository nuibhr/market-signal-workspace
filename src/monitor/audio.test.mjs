import test from 'node:test';
import assert from 'node:assert/strict';
import {createMonitorAudio} from './audio.mjs';
const fixture=()=>{const spoken=[],states=[],timers=[];class Utterance{constructor(text){this.text=text;}}const audio=createMonitorAudio({SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>[],cancel(){},speak:u=>spoken.push(u)}},{onState:s=>states.push(s),setTimer:fn=>{timers.push(fn);return timers.length;},clearTimer(){}});return{audio,spoken,states,timers};};
test('one queue retains simultaneous markets and requires native completion before next playback',()=>{
 const {audio,spoken,states}=fixture(),completed=[];audio.enable(true);
 for(const symbol of ['NTES','PTT','NVDA80','S50','XAUUSD'])audio.play(symbol,v=>completed.push([symbol,v]));
 assert.equal(spoken.length,1);assert.equal(audio.pending,5);assert.ok(!states.includes('speaking'));
 for(let i=0;i<5;i++){assert.equal(spoken[i].text,['NTES','PTT','NVDA80','S50','XAUUSD'][i]);spoken[i].onstart();spoken[i].onend();}
 assert.equal(audio.pending,0);assert.equal(completed.length,5);assert.ok(completed.every(([,v])=>v==='ended'));
});
test('mute interrupts only speech; every queued delivery receives an honest outcome',()=>{
 const {audio,spoken}=fixture(),done=[];audio.enable(true);audio.play('NTES',v=>done.push(v));audio.play('PTT',v=>done.push(v));audio.enable(false);
 assert.equal(audio.pending,0);assert.deepEqual(done,['muted','interrupted']);spoken[0].onend();assert.equal(done.length,2);audio.play('TFEX',v=>done.push(v));assert.equal(done.at(-1),'muted');
});
test('browser block retains remaining sounds until user enables; missing callbacks time out as blocked',()=>{
 const {audio,spoken,timers,states}=fixture(),done=[];audio.enable(true);audio.play('NTES',v=>done.push(v));audio.play('PTT',v=>done.push(v));spoken[0].onerror({error:'not-allowed'});assert.deepEqual(done,['blocked']);assert.equal(spoken.length,1);assert.equal(audio.pending,1);
 audio.enable(true);assert.equal(spoken[1].text,'PTT');timers.at(-1)();assert.equal(done.at(-1),'blocked');assert.equal(states.at(-1),'blocked');assert.ok(!done.includes('ended'));
});
test('background tab defers speech and delayed queue never reads an expired event as fresh',()=>{
 let visible=false,fresh=true;const spoken=[];class Utterance{};const audio=createMonitorAudio({SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>[],cancel(){},speak:u=>spoken.push(u)}},{visible:()=>visible});
 const done=[];audio.enable(true);audio.play('NTES',v=>done.push(v),()=>fresh);assert.equal(spoken.length,0);fresh=false;visible=true;audio.visible();assert.equal(spoken.length,0);assert.deepEqual(done,['historical']);audio.stop();
});
