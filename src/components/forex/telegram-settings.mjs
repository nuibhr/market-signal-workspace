// Reuse the settings already saved by the app; never copy them into a server store.
export function readTelegramSettings(storage){
 try{const token=(storage.getItem('nugaom_telegram_token')||'').trim(),chatId=(storage.getItem('nugaom_telegram_chat_id')||'').trim();return token&&chatId?{token,chatId}:null;}catch{return null;}
}
