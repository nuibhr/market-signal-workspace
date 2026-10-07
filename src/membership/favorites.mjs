import { storage, operation as op } from '../storage/database.mjs';
import { ALL_ASSETS } from '../markets/catalog.mjs';
import { randomUUID } from 'node:crypto';
const MAX_FAVORITES=500;
const known=new Set(ALL_ASSETS.map(item=>`${item.id}:${item.symbol}`));
export function validFavorite(market,symbol) { return typeof market==='string'&&typeof symbol==='string'&&known.has(`${market}:${symbol}`); }
export async function memberFavorites(member) {
  return {memberId:member.id,items:await storage.all('SELECT market,symbol FROM customer_favorites WHERE member_id=? ORDER BY created_at,market,symbol',member.id),
    imported:Boolean((await storage.first('SELECT favorites_imported_at FROM customer_preferences WHERE member_id=?',member.id))?.favorites_imported_at)};
}
export async function importFavorites(member,items) {
  if(!Array.isArray(items)||items.length>MAX_FAVORITES)throw new Error('INVALID_FAVORITES');
  const rows=[...new Map(items.filter(item=>item&&validFavorite(item.market,item.symbol)).map(item=>[`${item.market}:${item.symbol}`,{market:item.market,symbol:item.symbol}])).values()];
  const now=new Date().toISOString(),mutation=randomUUID();
  // Import once per LINE account; a retry cannot re-add a favorite the user already removed.
  await storage.batch([
    op(`INSERT INTO customer_preferences (member_id,favorites_imported_at,favorites_import_token) VALUES (?,?,?)
      ON CONFLICT(member_id) DO UPDATE SET favorites_imported_at=excluded.favorites_imported_at,favorites_import_token=excluded.favorites_import_token
      WHERE favorites_imported_at IS NULL`,member.id,now,mutation),
    op(`INSERT OR IGNORE INTO customer_favorites (member_id,market,symbol,created_at)
      SELECT ?,json_extract(value,'$.market'),json_extract(value,'$.symbol'),? FROM json_each(?)
      WHERE EXISTS(SELECT 1 FROM customer_preferences WHERE member_id=? AND favorites_import_token=?)`,member.id,now,JSON.stringify(rows),member.id,mutation),
  ]);
  return memberFavorites(member);
}
export async function setFavorite(member,market,symbol,saved) {
  if(!validFavorite(market,symbol)||typeof saved!=='boolean')throw new Error('INVALID_FAVORITE');
  if(!saved)await storage.run('DELETE FROM customer_favorites WHERE member_id=? AND market=? AND symbol=?',member.id,market,symbol);
  else {
    const result=await storage.first(`INSERT INTO customer_favorites (member_id,market,symbol,created_at)
      SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM customer_favorites WHERE member_id=?)<?
        OR EXISTS(SELECT 1 FROM customer_favorites WHERE member_id=? AND market=? AND symbol=?)
      ON CONFLICT(member_id,market,symbol) DO UPDATE SET symbol=excluded.symbol RETURNING symbol`,
      member.id,market,symbol,new Date().toISOString(),member.id,MAX_FAVORITES,member.id,market,symbol);
    if(!result)throw new Error('FAVORITES_LIMIT');
  }
  return memberFavorites(member);
}
