import {storage} from '../storage/database.mjs';
let initialized;
async function ready(){
 if(!initialized)initialized=storage.run('CREATE TABLE IF NOT EXISTS telegram_delivery_log(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL,message_id TEXT)').catch(e=>{initialized=null;throw e;});
 return initialized;
}
export const telegramHistory={
 async list(){await ready();return storage.all('SELECT id,summary,created_at,status,message_id FROM telegram_delivery_log ORDER BY created_at DESC LIMIT 50');},
 async start({id,actor,summary}){await ready();return Boolean((await storage.run("INSERT OR IGNORE INTO telegram_delivery_log VALUES(?,?,?,?,?,NULL)",id,actor,summary.slice(0,200),new Date().toISOString(),'SENDING')).changes);},
 async finish(id,status,messageId){await ready();await storage.run('UPDATE telegram_delivery_log SET status=?,message_id=? WHERE id=?',status,messageId===null?null:String(messageId),id);}
};
