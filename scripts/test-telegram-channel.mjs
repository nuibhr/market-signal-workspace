import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local if present
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN in environment or .env.local');
  process.exit(1);
}

const arg = process.argv[2];
let targetChatId = arg;

if (!targetChatId || targetChatId === 'staff') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_STAFF;
} else if (targetChatId === 'pi') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_LEADS_PI || process.env.TELEGRAM_CHAT_ID_STAFF;
} else if (targetChatId === 'trinity') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_LEADS_TRINITY || process.env.TELEGRAM_CHAT_ID_STAFF;
} else if (targetChatId === 'asl') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_LEADS_ASL || process.env.TELEGRAM_CHAT_ID_STAFF;
}

if (!targetChatId) {
  console.error('❌ No Chat ID provided.');
  console.log('Usage:');
  console.log('  node scripts/test-telegram-channel.mjs -100xxxxxxxxxx');
  console.log('  node scripts/test-telegram-channel.mjs staff');
  process.exit(1);
}

console.log(`📡 Testing Telegram message to Chat ID: ${targetChatId}...`);

async function run() {
  const payload = {
    chat_id: targetChatId,
    text: `🔔 [ทดสอบระบบ] Nugaom Staff Lead Alert\n✅ การเชื่อมต่อ Telegram Chat สำเร็จเรียบร้อย!\n📅 เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
    parse_mode: 'HTML'
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok) {
      console.log('✅ ส่งข้อความสำเร็จ! (Message sent successfully)');
      console.log(`   Chat Title: "${data.result.chat.title || 'Private'}" (Type: ${data.result.chat.type})`);
      console.log(`   Message ID: ${data.result.message_id}`);
    } else {
      console.error('❌ ส่งข้อความไม่สำเร็จ:', data.description);
      if (data.description.includes('chat not found')) {
        console.log('💡 คำแนะนำ: บอทยังไม่ได้ถูกดึงเข้ากลุ่ม หรือ Chat ID ไม่ถูกต้อง กรุณาดึงบอทเข้ากลุ่มก่อน');
      } else if (data.description.includes('not enough rights')) {
        console.log('💡 คำแนะนำ: กรุณาตั้งให้บอทเป็น Administrator หรือเปิดสิทธิ์ให้ส่งข้อความได้');
      }
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

run();

