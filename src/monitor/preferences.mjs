const KEY='nugaom-monitor-sound-v1';
export function soundPreference(storage) {try{return storage?.getItem(KEY)!=='off';}catch{return true;}}
export function saveSoundPreference(storage,enabled) {try{storage?.setItem(KEY,enabled?'on':'off');}catch{}}
export const SOUND_PREFERENCE_KEY=KEY;
