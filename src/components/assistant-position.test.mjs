import test from 'node:test';
import assert from 'node:assert/strict';
import {clampMascot,restoreMascot,saveMascot,chatPlacement,MASCOT_WIDTH,MASCOT_HEIGHT} from './assistant-position.mjs';
test('dragged mascot and restored positions stay reachable after resizing to mobile',()=>{
 const desktop={width:1440,height:900},mobile={width:360,height:640};
 const start=clampMascot({x:1300,y:720},desktop),saved=saveMascot(start,desktop),restored=restoreMascot(saved,mobile);
 assert.ok(restored.x>=8&&restored.x+MASCOT_WIDTH<=352);assert.ok(restored.y>=8&&restored.y+MASCOT_HEIGHT<=632);
 assert.deepEqual(restoreMascot('{bad',mobile),clampMascot(null,mobile));
 assert.deepEqual(restoreMascot('{"x":900,"y":-5}',mobile),clampMascot(null,mobile));
});
test('chat remains inside the viewport near all corners and when the mobile keyboard reduces height',()=>{
 for(const size of [{width:1440,height:900},{width:360,height:640},{width:360,height:300}])for(const position of [{x:0,y:0},{x:2000,y:2000},{x:0,y:2000},{x:2000,y:0}]){
 const p=chatPlacement(clampMascot(position,size),size);assert.ok(p.left>=12&&p.top>=12);assert.ok(p.left+p.width<=size.width-12);assert.ok(p.top+p.height<=size.height-12);
 }
});
