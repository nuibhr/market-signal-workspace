import { storage } from '../storage/database.mjs';
export const cloudStorage=()=>process.env.STORAGE_PROVIDER==='d1';
export async function cloudCacheGet(id){
  if(!cloudStorage())return null;
  const row=await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?',id,Date.now());
  try{return row?JSON.parse(row.payload_json):null;}catch{return null;}
}
export async function cloudCachePut(id,value,ttl){
  if(!cloudStorage())return;
  await storage.run('INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at',id,JSON.stringify(value),Date.now()+ttl);
}
