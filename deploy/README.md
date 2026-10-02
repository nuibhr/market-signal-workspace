# ขั้นแรก: โดเมน + เซิร์ฟเวอร์สำหรับ Nugaom AI Pick

ยังไม่ได้ซื้อโดเมน/VPS ยังไม่ได้เปิด tunnel และไฟล์ชุดนี้ยังไม่ได้รันบน Linux server จริง

## โครงสร้างที่เลือก

ลูกค้า → Cloudflare/โดเมน HTTPS → Cloudflare Tunnel → nginx บน localhost:8080 → เว็บ Node บน localhost:3000

เว็บและ scanner worker เป็นคนละ systemd service บน VPS เดียวกัน ใช้ SQLite ใน /var/lib/nugaom ร่วมกัน ส่วนโค้ดอยู่ /opt/nugaom/releases/<version> และ /opt/nugaom/current ชี้ release ที่กำลังใช้งาน

Cloudflare Tunnel เชื่อมออกจาก VPS จึงไม่ต้องเปิดพอร์ตเว็บต่ออินเทอร์เน็ต ใช้ public hostname แบบถาวรของโดเมนที่ถือครอง หลีกเลี่ยง quick tunnel ชั่วคราวสำหรับ LINE production callback

## สิ่งที่ต้องเลือกก่อน

1. ชื่อโดเมนที่ต้องการซื้อ (ผู้ใช้เป็นคนยืนยันชื่อและซื้อ)
2. บัญชี Cloudflare สำหรับจัดการ DNS/Tunnel
3. VPS Linux ที่มี persistent local disk และรันตลอด; เริ่มต้นพิจารณา 2 vCPU/4 GB RAM เป็นประมาณการสำหรับทดลองลูกค้ากลุ่มเล็ก ต้องวัดโหลดจริง ไม่มีการรับรองจำนวนผู้ใช้
4. ผู้ให้บริการ VPS/งบต่อเดือน และพื้นที่เก็บ encrypted backup อีกแห่ง

ไม่ต้องย้ายไป Cloudflare Workers ในขั้นนี้ และไม่ต้องใช้ Mac ที่เปิด dev server เป็นเซิร์ฟเวอร์ลูกค้า

## หลังมี VPS: เตรียม filesystem

ใช้ Linux/systemd และ Node ที่รองรับโค้ดนี้ (>=22.13; เลือก Node LTS จาก official source ก่อนติดตั้ง)

- สร้าง system user/group `nugaom` ไม่มี interactive login
- `/opt/nugaom/releases/`: โค้ดแต่ละเวอร์ชัน
- `/opt/nugaom/current`: symlink ไป release ที่กำลังใช้
- `/var/lib/nugaom/`: owner nugaom, mode 0700, local persistent disk
- `/var/lib/nugaom/backups/`: owner nugaom, mode 0700
- `/etc/nugaom/production.env`: root owner, mode 0600; systemd อ่านแล้วส่ง env ให้โปรเซส
- ติดตั้ง Node ที่ `/usr/bin/node` หรือแก้ ExecStart ให้ตรง path จริง; nginx และ cloudflared จาก official source

นำโค้ดขึ้นจาก Git โดยไม่ส่ง .env.local หรือ data/ ไปใน release ไม่มี API key ใน build artifact

## เตรียม release

1. เช็กเอาต์ Git commit ที่ตกลงจะใช้เข้า release directory
2. รัน `npm ci` และ `npm run build` บน VPS ใน release นั้น; ไม่ใช้ dev server
3. ให้ user nugaom เขียนเฉพาะ runtime `.next` ของ release ได้ (Next cache); โค้ดและ secrets ไม่เปิดให้ผู้ใช้ทั่วไปแก้
4. ตั้ง /opt/nugaom/current ให้ชี้ release นี้
5. คัดลอก `production.env.example` ไป `/etc/nugaom/production.env` แล้วกรอกค่าจริงบน VPS
6. โดเมน APP_ORIGIN และ LINE callback ต้องตรงกันทุกตัวอักษร
7. เก็บ SESSION_SECRET/PORTFOLIO_HASH_SECRET/BACKUP_ENCRYPTION_KEY เดิม หากย้ายข้อมูลจากเครื่องเดิม มิฉะนั้น session/การตรวจ hash/การกู้คืน backup เก่าจะไม่ตรง; ไม่ส่งคีย์ในแชต
8. ถ้าจะเริ่มฐานข้อมูลใหม่จริง จะยังไม่มีสมาชิก/ผลสัญญาณจากเครื่องเดิม อย่าเขียนทับไฟล์เดิมเพื่อย้ายข้อมูล; ต้องตกลงวิธีย้ายก่อน

อย่าเปิด CONFIRMED flags จนยืนยัน persistent storage/สิทธิแสดงข้อมูลจริง ถ้ายังไม่เปิดตลาด worker จะหยุดด้วยข้อความ not configured เป็นพฤติกรรมที่ตั้งใจไว้

## ติดตั้ง services และ Cloudflare

- คัดลอก systemd/* ไป /etc/systemd/system/ และ `systemctl daemon-reload`
- รัน web service ก่อนและตรวจ `/api/health` ที่ localhost:3000
- เปิด nginx ด้วย `nginx.conf` และตรวจ config ก่อน reload
- สร้าง named Cloudflare Tunnel ผ่าน dashboard ภายใต้บัญชีเจ้าของ ติดตั้ง connector เป็น service บน VPS
- Public hostname ของโดเมน → service `http://127.0.0.1:8080`
- เปิด WAF/rate limit ที่ Cloudflare ให้เหมาะกับแพ็กเกจ; nginx limit ปัจจุบันเป็นเพดานรวมของ origin ไม่ใช่ per-user เพราะ tunnel มาจาก localhost
- Cache bypass `/api/*`, `/account*`, `/admin*`; เคารพ Cache-Control/Set-Cookie; อย่าใช้ Cache Everything กับเว็บสมาชิก
- รัน preflight บน VPS: `sudo node --env-file=/etc/nugaom/production.env scripts/production-preflight.mjs` (ภายใน current release)
- ลงทะเบียน callback HTTPS ใน LINE แล้วทดสอบผ่านโดเมนจริง
- เมื่อผ่าน readiness ของตลาดจึง enable/start worker service เพียงหนึ่งตัว และ backup timer

ไฟล์ service มี Restart และจำกัดสิทธิเขียนข้อมูล แต่ต้องตรวจ path/permissions บน VPS จริงก่อนใช้งาน

## การอัปเดตครั้งต่อไป

เตรียม release ใหม่ → build → สำรอง DB → หยุด web/worker ช่วง maintenance → เปลี่ยน current symlink → start ทั้งสอง → ตรวจ health/login/coverage

เก็บ release เดิมเพื่อ rollback โค้ด; หากมี DB schema migration ต้องมีแผน rollback schema/restore แยก ไม่อ้างว่าย้อนโค้ดแล้วฐานข้อมูลจะย้อนเอง ห้าม restore backup เก่าทับ DB ปัจจุบันโดยไม่ตรวจธุรกรรมที่เกิดหลัง backup

## สิ่งที่ยังไม่ได้ตั้งจากเครื่องนี้

- ซื้อโดเมน/VPS, DNS/Tunnel/HTTPS จริง
- ส่ง secrets หรือข้อมูลลูกค้าไป VPS
- กำหนดโอนข้อมูลเดิมหรือเริ่ม DB ใหม่
- เปิดบริการ production, offsite backup, monitoring ภายนอก
- ทดสอบชุด systemd/nginx บน Linux จริง

## การสำรองอัตโนมัติ

backup timer รันทุกวันประมาณ 08:00 เวลาไทย พร้อมชดเชยเมื่อเครื่องเคยดับ; ยังไม่มี automatic pruning ให้ติดตาม disk usage และกำหนด retention หลังเลือก offsite storage เพื่อไม่ลบสำเนาที่ยังไม่ได้คัดลอก

## อ้างอิง

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) และ bundled Next.js self-hosting guide (อ่านแล้วก่อนเตรียมไฟล์)
