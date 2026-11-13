# Canonical Market Data v1 — Backend implementation review

วันที่ตรวจ: 27 ตุลาคม 2026 (Asia/Bangkok)
สถานะ: **พร้อมตรวจโค้ดในเครื่อง; ยังไม่ผ่าน release/provider-readiness gates และยังไม่พร้อม deploy**

## Repository และขอบเขต

- Repository: `/Users/nuibunpot/Documents/Codex/2026-10-24/1-flow-line-login-stripe-checkout/market-signal-workspace`
- Branch: `fix/cloudflare-login-demo-scanner-ai`; HEAD ก่อนและหลังงาน: `9808dfd`
- Working tree ตอนเริ่มตรวจสะอาด; changes ชุดนี้ยังไม่ staged/committed ไม่มี push/deploy และไม่มีการแก้ production database/environment
- ใช้ contract/schema ที่แนบมาเป็นข้อกำหนด; คำสั่งใน handoff เรื่อง staging ไม่ใช่การอนุญาตให้ commit จากผู้ใช้
- ผู้ใช้ยืนยันให้คง UI ด้วย compatibility adapter หลังตรวจสิทธิ์และ cap พร้อมเปิด canonical API แยก
- ไม่แก้ components, landing, หน้า UI, ราคา, Stripe, plan IDs หรือ membership entitlement definitions

## สิ่งที่เปลี่ยน

### A. Authz boundary

ตรวจ trusted server identity ก่อนเข้าถึง portfolio, holdings, connector และ MT5 owner ingestion รวมถึง demo/sandbox query bypass. Broker portfolio ต้องตรงกับ owner/account binding ฝั่ง server. MT5 แยก namespace `owner:<id>`, ตรวจ expiry/revoke/replay, ปิด local customer sessions บน production handler และเพิ่ม audit ที่ไม่เก็บ raw payload/token.

`POST /api/account` action `portfolio` ตรวจ owner ก่อนเรียก submitPortfolio: ลูกค้าไม่สามารถส่งเลขบัญชี broker ผ่าน enrollment เดิมได้แล้ว. Existing memberships ไม่เปลี่ยน; redeem/renewal ยังทำงานเดิม. **ผลที่ต้องรับทราบ: การสมัคร Trial ผ่านเลขบัญชีเดิมถูกระงับ; ไม่ได้สร้าง flow สมัครใหม่หรือเปลี่ยนสิทธิ์ Trial.**

`GET /api/data-policy` ระบุ customer read-only, broker/credential/CSV disabled และไม่ยืนยัน realtime. ตาราง/ฟอร์มเก่าใน UI ยังอยู่ตามขอบเขตห้ามแก้ UI; backend เป็นผู้ปฏิเสธการใช้งานเหล่านั้น.

### B. Normalize → validate → project → serialize

- Pin Ajv 8.20.0 และ ajv-formats 3.0.1 เป็น direct dependencies; ตรวจ JSON Schema draft 2020-12, allowlisted runtime data extension และ semantic invariants ก่อน serialize
- ไม่แทน source timestamp ด้วยเวลาส่ง response/อ่าน cache; future/missing/stale timestamps ไม่สร้าง signal
- ตรวจ OHLC, bar ordering/duplicates/current bars, negative/nonfinite prices, crossed bid/ask, volume/OI และ history warmup
- Missing/expired/unconfirmed display rights ปิด value-bearing rows ก่อน provider loader; schema/test fixture ไม่ใช้เป็นใบอนุญาตข้อมูล
- Apply stable per-market cap ก่อน query, symbols/favorites, pagination, charts, ledger summary และ diagnostics; page/filter ใช้ค้นได้เฉพาะชุดที่ได้รับสิทธิ์
- Guest ≤1 redacted sample และ 0 full cards; Trial ≤8, Starter ≤3, Pro ≤5, Ultimate ≤8 ต่อ selected-market scan. ข้อมูลมีน้อยกว่านี้ได้; cap ไม่ใช่การรับประกันจำนวนผล
- Customer execution false; performance false เมื่อไม่มี closed-trade evidence; responses ที่ขึ้นกับ entitlement ใช้ private, no-store

### C. Five-market migration

| ตลาด | การทำงานใน backend | ข้อจำกัดจริงที่ยังเหลือ |
|---|---|---|
| Thai | Stable scan 8; SET calendar hook; cap/redaction/fallback gate | Legacy rows ไม่เก็บ quality evidence ครบ จึงไม่ให้ signal; mai computed ยัง 0 |
| DR | Stable scan 6; reject unknown market; mapping/currency/FX/as-of gates ใน normalizer; ตัด avg return ที่ไม่มี trade evidence | Runtime ยังไม่มี verified DR bridge bundle จึงไม่เปิด valuation/signal |
| US | EOD; stock focus แยก ETF rotation; unavailable rows ไม่หายจาก projected snapshot | Calendar/quality evidence สำหรับ canonical signal ยังไม่ครบ; FX conversion ไม่มี proof จึงคืน null |
| TFEX | Native quote/options/candle paths; reference แยก; OI missing = null; cap individual option contracts ก่อน grouping | Freshness policy/quality evidence ยังไม่รับรอง; quote/candidate ไม่ใช่ active/liquid/executable signal |
| Forex | Trusted owner ingest, namespace/heartbeat/quote time/warmup 60 closed 15m gates | ไม่มี owner connection/display evidence ในการตรวจครั้งนี้; runtime quote policy/quality ยังไม่ครบ; generic customer chart ไม่เปิด |

Catalog counts เป็นคนละชุดกับ computation/entitlement: Thai 150 (mai 50) เทียบ planned compute 8 (mai 0), DR 141 เทียบ 6; US catalog 600 เทียบ stock focus 10/ETF rotation 10; TFEX catalog 16; Forex catalog 19. ตัวเลขนี้เป็น inventory ของโค้ด ไม่ใช่ provider coverage ที่พิสูจน์แล้ว. Customer canonical coverage ใช้เฉพาะ entitled projection; catalogTotal=null. เมื่อไม่ได้เรียก provider ให้ computedTotal=0.

### D. API/compatibility

Canonical endpoint: `GET /api/market-data/v1?market=thai|dr|us|tfex|forex`. Primary migrated endpoints รองรับ `format=canonical` และคง legacy response shape ผ่าน adapter.

กลุ่มที่ migrate: DR feed, Thai screener, US desk/watch, TFEX quote/options/candles, quote/market-watch/technical-plan, shared/daily scan, chart/history/us-bars, signals/daytrade/auto-pick และ trade-results/backtest/events. Existing chart endpoints ถูกครอบ authz/entitlement/rights เพราะเป็นช่องทาง bypass ที่เกี่ยวข้องกับ migration.

**พฤติกรรมที่เปลี่ยนและต้อง review ก่อน rollout:**

- `/signals`, `/daytrade`, `/auto-pick` ไม่คืนแผน/active signals/notifications ที่ขาด canonical quality proof; adapters คืน unavailable และ empty arrays ตาม shape เดิม
- Trade history จำกัด stable entitled symbols และจำนวนก่อน filter/summary; plan/outcome/performance fields ที่ไม่มี evidence ถูกปิด. Winrate/backtest ไม่แสดงค่าที่อนุมานจาก daily change
- `market=all` ถูก reject ใน selected-market routes; ไม่สามารถใช้ query/page รวมหลาย scans เพื่อหลบ cap
- Daily-scan customer path เป็นการอ่าน projected snapshot; ไม่เรียก saved-report/manual provider scan แบบเดิม
- Existing customer MT5 token/session ไม่ย้ายเข้า owner namespace อัตโนมัติ
- UI render compatibility ไม่เท่ากับ feature parity: ตอนนี้ signal/performance ที่ไม่มี proof จะ unavailable. หน้าเดิมยังมี copy เกี่ยวกับ broker/live/all-markets และข้อความสิทธิ์บางจุดไม่ตรง canonical cap; ไม่ได้แก้ตามข้อจำกัด UI

### E. Review preview

`NUGAOM_REVIEW_MODE=true` เพิ่ม X-Robots-Tag `noindex, nofollow, noarchive` และใช้ `.next-review`. ตรวจบน 127.0.0.1 กับ SQLite fixtures ใหม่เท่านั้น; ปิด provider rights, owner bindings และ owner receiver. Local review server ถูกปิดหลังตรวจ.

## ผลตรวจล่าสุด

| Gate | ผล | ขอบเขตหลักฐาน |
|---|---|---|
| `npm test` | PASS 498/498, 0 skipped | Unit/integration fixtures รวม isolated SQLite/D1 และ existing suite |
| `node --test src/market-data/contracts/v1/*.test.mjs` | PASS 40/40 | Schema, caps, safe errors, normalizer, actual route guards, ledger projection |
| `NUGAOM_REVIEW_MODE=true npm run build` | PASS | Local Next build เท่านั้น |
| HTTP matrix | PASS 331/331 | Five markets × tiers, direct owner denial, canonical/legacy, invalid/all market, query/page, charts, ledger rights denial, account denial, data-policy และ noindex HTML |
| Contract examples | PASS 16 examples | 5 markets × full/Guest/rights-unconfirmed + owner-only error; fixed-clock fixtures, isLiveFeed=false |
| `git diff --check` | PASS | Whitespace/conflict check |
| Browser smoke ก่อนการแก้ account/data-policy รอบสุดท้าย | Guest pages ทั้ง 5 render โดยไม่พบ TypeError/ReferenceError/React application error | เคยพบ notificationScope.split error และแก้ adapter พร้อม regression test แล้ว |
| Browser smoke บน final build / Starter | NOT COMPLETED | Local browser use ถูกปิดใน Work settings; ไม่อ้างว่า final browser acceptance ผ่าน |
| Actual provider/license/market-session evidence | NOT VERIFIED | ไม่มี real provider calls หรือ license artifacts ที่รับรองในการตรวจนี้ |
| Full release/preservation gate | NOT PASSED | ต้องปิดรายการด้านล่างก่อน production rollout |

Baseline ที่รันจริงก่อน migration คือ 449 tests. ตัวเลข 512 ใน handoff เป็นผลจากบริบทเก่า ไม่ใช่ baseline ของ checkout นี้. ผลปัจจุบันคือ 498.

## สิ่งที่ยังต้องทำก่อน rollout

1. ตรวจและบันทึก display-license evidence จริงแยกตาม provider/market; ห้ามนำ `FIXTURE_ONLY_NOT_A_LICENSE` จากตัวอย่างไปตั้งค่า runtime
2. ต่อ quality provenance, approved calendars/session rules และ quote freshness policies ให้ runtime adapters; ห้ามตั้ง `qualityVerified=true` เพียงเพื่อทำให้ tests/หน้าจอมีข้อมูล
3. ต่อ DR underlying mapping/FX/currency/as-of proof; ตรวจ TFEX source/OI/contracts และ Forex trusted owner connection/heartbeat/closed-bar warmup กับ source จริง
4. ทดสอบ positive runtime flows ด้วยแหล่งข้อมูลที่มีสิทธิ์ พร้อม stale/fallback/provider-outage scenarios; ปัจจุบัน HTTP matrix พิสูจน์ fail-closed behavior ไม่ใช่ licensed data readiness
5. ตรวจ browser final build ทั้ง Guest/paid และทบทวน UI copy/enrollment ที่ขัดกับ read-only backend ในงาน UI ที่ผู้ใช้อนุมัติแยก; ไม่อ้างว่าฟีเจอร์เดิมครบเพียงเพราะ build ผ่าน
6. Review patch และอนุมัติ commit แยก. Push/deploy ยังไม่ได้รับอนุมัติ

## Runtime configuration ที่เพิ่ม

- `CANONICAL_DISPLAY_RIGHTS_JSON`: per-provider evidence registry (`status`, `markets`, `evidenceId`, `verifiedAt`, `validUntil`); ค่าเริ่มต้น `{}` ปิดสิทธิ์. Config เป็นเพียง pointer/assertion ที่ต้องผ่าน evidence review จริง
- `CANONICAL_OWNER_PORTFOLIOS_JSON`: owner-id → list ของ market/brokerId/accountNo bindings ฝั่ง server; ค่าเริ่มต้น `{}` ปฏิเสธการเข้าถึง
- `CANONICAL_FOREX_OWNER_ID`: owner ที่ server ตรวจ role ได้จริงและมี active `owner:` connection
- `NUGAOM_REVIEW_MODE`: noindex review build เท่านั้น

ไม่มีการ provision configuration เหล่านี้ไป production และไม่มีการสร้างหลักฐานสิทธิ์ข้อมูลขึ้นเอง.
