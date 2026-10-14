# Nugaom Community — 14 ตุลาคม 2026

ทำใหม่ในแอปเดิมตามคำยืนยันของผู้ใช้ ไม่ได้ import branch community เดิม และไม่เปลี่ยน robot landing หรือ scanner repairs

## ใช้งานในเครื่อง

- เปิด `/community` หลังล็อกอิน LINE หรือเลือก “ห้องสมาชิกและคุยกับทีม” จากหน้าบัญชี/เมนูตลาด
- ห้องนักออม, หุ้นไทย, DR, US และ ETF, TFEX, Forex เปิดให้สมาชิกทดลอง/รายเดือน รวมถึงทีมที่ได้รับบทบาทและแอดมิน ระบบอ่านสถานะสมาชิกปัจจุบันจากฐานข้อมูล ไม่ใช้สิทธิค้างในหน้าเว็บ
- ผู้ที่ล็อกอิน LINE แล้วเปิดหัวข้อส่วนตัวเรื่อง “บัญชีและแพ็กเกจ” หรือ “ข้อมูลและแผน” ได้ แม้สิทธิสมาชิกยังไม่เริ่มหรือหมดอายุ
- `/team` ใช้ได้เฉพาะแอดมินและผู้ที่ได้รับบทบาท marketing/analyst แอดมินเห็นทุกหัวข้อ ทีมเห็นเฉพาะฝ่ายที่รับผิดชอบ เจ้าของหัวข้อเห็นของตนเอง สมาชิกอื่นเห็นเป็นไม่พบหัวข้อ
- แอดมินเข้า `/team` เพื่อค้นหาสมาชิก LINE เดิมและเพิ่ม/ถอนบทบาท ทีมตอบกลับ เปลี่ยนสถานะ ย้ายฝ่าย และปิด/เปิดหัวข้อได้ การย้ายฝ่ายทำให้ทีมเดิมเสียสิทธิอ่านและตอบทันที เวอร์ชันข้อมูลป้องกันการเปลี่ยนสถานะจากข้อมูลค้าง
- ยังไม่มีการมอบหมายสมาชิกจริงเป็นทีมจากงานนี้ แอดมินต้องเลือกผู้รับผิดชอบเอง ไม่แสดงคำอ้างว่าทีมออนไลน์หรือจะตอบทันที

## การส่ง อ่าน และดูแลข้อความ

- เป็น plain text สูงสุด 2,000 ตัวอักษร ไม่มีไฟล์แนบ ไม่ใช้ HTML ที่สมาชิกส่งมาเป็น markup
- เตือนให้ไม่ส่งเลขพอร์ตเต็ม/รหัสผ่าน/คีย์ API ปิดเลข ASCII ยาวที่มี 5–24 หลัก รวมรูปแบบมีช่องว่างหรือขีด ก่อนบันทึก เหลือเพียงท้าย 4 หลัก ไม่ใช่ระบบตรวจความลับทุกชนิด ผู้ใช้ยังต้องไม่ส่งข้อมูลลับ
- รายการหัวข้อและข้อความหน้าละ 7 รายการ เรียงข้อความด้วย sequence ของฐานข้อมูล ไม่ใช้เวลาอย่างเดียว
- รหัสรายการผูกกับ actor และ payload hash การลองซ้ำหลังเน็ตหลุดใช้รายการเดิม ไม่เพิ่มข้อความซ้ำ หน้าเว็บเก็บรายการที่ยังไม่ยืนยันไว้ในหน่วยความจำจนกด retry; ไม่อ้างว่าร่างที่ยังไม่ส่งจะอยู่หลัง reload
- สถานะอ่านเก็บในฐานข้อมูล แยกสมาชิกและช่องทาง โดยเลื่อนไปข้างหน้าเท่านั้นและไม่เกินข้อความที่มีจริง หน้าเว็บอ่าน receipt เมื่อแสดงหน้าและ tab มองเห็น
- ตรวจข้อความใหม่ทุก 30 วินาทีขณะเปิดหน้านี้ มีแถบแจ้งข้อความใหม่และจำนวนยังไม่อ่าน ไม่ใช่ push หลังปิดเว็บ ไม่ผูกกับเสียง AutoPick และไม่ส่งผ่าน LINE OA
- สมาชิกส่งรายงานให้แอดมินได้ แอดมินซ่อน/คืนข้อความ, ตรวจจบรายงาน และพักการส่งในห้องได้ ซ่อนข้อความไม่ลบประวัติ คนทั่วไปไม่เห็นเนื้อหาที่ซ่อน แอดมินยังตรวจผ่านรายงานได้
- community_operations เก็บ actor, action, hash, ผลตอบกลับ และรายละเอียดการเปลี่ยนสิทธิ/สถานะ โดยไม่ทำสำเนา body/subject/reason ใน audit

## API และข้อมูล

`/api/community` GET overview/channel/admin และ POST ตรวจ session, membership/role/ownership, origin, JSON byte limit และ rate limit ทุกครั้ง คำตอบ private/no-store ไม่มี LINE ID, portfolio hash หรือ sender ID ใน message payload

Migration `0008_community.sql` เพิ่ม community_rooms, community_staff, support_threads, community_messages, community_reads, community_reports, community_operations; SQLite และ D1 ใช้ SQL เดียวกัน ไม่แก้ migration 0007 หรือ signal ledger

ฐานข้อมูล local apply version 8 แล้ว เฉพาะห้องเริ่มต้น 6 ห้องเป็น template ไม่มีข้อความ/สมาชิกทดสอบใส่ในฐานข้อมูลลูกค้า Migration บน Cloud จริงยังไม่ apply และไม่มี deploy รอบนี้

เครื่องมือ D1 cutover รวมตารางใหม่ใน manifest, snapshot และ verification ปลายทางต้องว่าง ยกเว้นห้อง template ที่ตรงกับ seed ทุกช่องและยังไม่ถูกแก้ สามารถ upsert configuration ห้องจาก snapshot ได้ แต่ยังปฏิเสธปลายทางที่มีข้อมูลลูกค้า ข้อความนำเข้าเก่าที่ applied=1 ไม่เล่น trigger เปลี่ยนสถานะหัวข้อหรือเพิ่ม version ซ้ำ

## หลักฐานและงานค้าง

ชุดทดสอบรวม 84/84 ผ่าน รวม community 22 tests/subtests บน SQLite และ native local D1: membership ปัจจุบัน, private inbox/ทีม, revoke/transfer, operation retry/conflict, unread cursor, pagination, moderation/locks, immutable message content, encrypted recovery และ cutover

HTTP anonymous community/team redirect เข้าหน้าบัญชี; GET API เป็น 401 private/no-store, write จากอีก origin เป็น 403 และ write origin ที่ตั้งค่าไว้แต่ไม่มี session เป็น 401

ต้องทดสอบ UI ด้วยบัญชี LINE สมาชิก/ทีมจริง, มือถือ และการ reload/เน็ตหลุดจริงก่อนเปิดลูกค้า Browser visual verification ยังไม่ได้ทำตามข้อจำกัด automation ที่บันทึกไว้ ไม่อ้างว่าภาพ/interaction บนอุปกรณ์จริงผ่านแล้ว

สิทธิแสดงข้อมูล, provider availability, แผน Cloudflare, customer cutover/restore, hosted LINE consent และเสียงจริงยังเป็นเงื่อนไข production เว็บ Cloud ยัง maintenance และ scanner ยังปิดตามสถานะเดิม

## รีวิวก่อนรวม main

รีวิวและแก้ confirmation ของ send ที่บันทึกแล้วหลัง lock/close และเปลี่ยนการแจ้งข้อความใหม่ไปใช้ incoming sequence ตามสิทธิ แทนยอด unread รวม ชุดล่าสุดผ่าน 88/88 ดู `docs/code-review-2026-10-14.md` สำหรับหลักฐานปัจจุบันและส่วนที่ยังไม่พร้อม
