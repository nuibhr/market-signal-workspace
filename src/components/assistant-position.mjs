export const MASCOT_WIDTH=84,MASCOT_HEIGHT=118;
export function clampMascot(p,viewport){
 const maxX=Math.max(8,viewport.width-MASCOT_WIDTH-8),maxY=Math.max(8,viewport.height-MASCOT_HEIGHT-8);
 return {x:Math.max(8,Math.min(maxX,Number.isFinite(p?.x)?p.x:maxX)),y:Math.max(8,Math.min(maxY,Number.isFinite(p?.y)?p.y:maxY-72))};
}
export function restoreMascot(raw,viewport){
 let saved;try{saved=JSON.parse(raw);}catch{}
 if(!saved||!Number.isFinite(saved.x)||!Number.isFinite(saved.y)||saved.x<0||saved.x>1||saved.y<0||saved.y>1)return clampMascot(null,viewport);
 return clampMascot({x:saved.x*Math.max(1,viewport.width-MASCOT_WIDTH),y:saved.y*Math.max(1,viewport.height-MASCOT_HEIGHT)},viewport);
}
export function saveMascot(p,v){return JSON.stringify({x:p.x/Math.max(1,v.width-MASCOT_WIDTH),y:p.y/Math.max(1,v.height-MASCOT_HEIGHT)});}
export function chatPlacement(p,v){
 const width=Math.min(390,v.width-24),height=Math.max(100,Math.min(610,v.height-142));
 return {left:Math.max(12,Math.min(v.width-width-12,p.x+MASCOT_WIDTH+12+width<=v.width?p.x+MASCOT_WIDTH+12:p.x-width-12)),top:Math.max(12,Math.min(v.height-height-12,p.y-height-12>=12?p.y-height-12:p.y)),width,height};
}
