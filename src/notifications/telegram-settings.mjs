// Read local admin telegram test credentials from browser storage
export function readTelegramSettings(storage) {
  try {
    const token = (storage.getItem('nugaom_telegram_token') || '').trim();
    const chatId = (storage.getItem('nugaom_telegram_chat_id') || '').trim();
    return token && chatId ? { token, chatId } : null;
  } catch {
    return null;
  }
}
