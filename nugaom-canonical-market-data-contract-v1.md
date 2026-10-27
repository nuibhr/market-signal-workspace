# Nugaom Canonical Market Data Contract v1

**สถานะ:** ข้อเสนอสำหรับออกแบบและส่งต่อ implementation — ยังไม่ใช่ runtime contract ที่ deploy แล้ว
**วันที่จัดทำ:** 26 ตุลาคม 2026
**ขอบเขตตลาด:** Thai SET/mai, DR, US equities/ETFs, TFEX, Forex/CFD
**ไฟล์ JSON Schema:** [`schemas/nugaom-market-data-envelope.v1.schema.json`](schemas/nugaom-market-data-envelope.v1.schema.json)

## 1. เป้าหมายและหลักการ

ใช้ envelope เดียวกันระหว่าง backend adapter, API route และ customer UI เพื่อให้ทุกตลาดสื่อความหมายของข้อมูลตรงกัน โดยไม่บังคับให้ข้อมูลภายในของหุ้น, DR, futures, options หรือ Forex มี field รายละเอียดเหมือนกัน

ข้อกำหนดหลัก:

1. แยก **มีข้อมูลหรือไม่**, **ข้อมูลสดแค่ไหน**, **ใช้ได้เพื่อวัตถุประสงค์ใด**, **provider พร้อมหรือไม่**, และ **สิทธิ์แสดงผลยืนยันหรือไม่** ออกจากกัน ไม่ใช้ status string เดียวแทนทุกเรื่อง
2. `generatedAt` คือเวลาที่ Nugaom สร้าง response เท่านั้น ไม่ใช่เวลา quote/bar และห้ามใช้แทน `dataAsOf` หรือ `observedAt`.
3. `receivedAt` คือเวลาที่ระบบ Nugaom รับข้อมูลจาก source; หากส่งต่อ cache ต้องรักษาเวลารับต้นทาง ไม่เขียนทับเป็นเวลาที่อ่าน cache.
4. ถ้า source ไม่มี timestamp ที่เชื่อถือได้ ให้ `observedAt`/`dataAsOf` เป็น `null` และ freshness เป็น `UNKNOWN`; ห้ามเติมเวลาปัจจุบัน.
5. `REALTIME_*` ต้องหมายถึงข้อมูลที่ provider ส่งเป็น real-time ตามสิทธิ์ที่ยืนยันได้ ไม่ใช่ polling ถี่, cache ใหม่ หรือ `generatedAt` ใหม่.
6. Rights/config/provider response/data quality เป็นสถานะแยกกัน: environment flag หรือ code branch เพียงอย่างเดียวไม่ใช่หลักฐานสิทธิ์แสดงผล.
7. ใช้ fail-closed: rights ไม่ยืนยันหรือ provider ไม่พร้อม → `BLOCKED`/`UNAVAILABLE` หรือ `CHART_ONLY` ตามสิทธิ์และลักษณะข้อมูล; ห้ามสร้างสัญญาณ current จาก fallback.
8. Schema นี้ไม่เปิด customer broker connection, portfolio sync, order placement หรือรับ credentials ลูกค้า. ลูกค้าดูผลที่ผ่าน server-side projection เท่านั้น; owner/internal ingestion ต้องแยก route, role, tenant และ storage boundary.
9. การ refresh ใช้ backend-owned direct pull/connector ที่ได้รับอนุญาตและ server cache ตามนโยบาย provider; ไม่ให้ browser ยิง provider โดยตรง และไม่ต้องเพิ่ม webhook เว้นแต่ provider บังคับ.

## 2. Envelope ระดับ API

ตัวอย่างโครงสร้างโดยย่อ:

```json
{
  "schemaVersion": "nugaom.market-data.v1",
  "requestId": "req_fixture_001",
  "snapshotId": "snap_fixture_001",
  "market": "dr",
  "selectedScope": { "market": "dr", "kind": "MARKET_SCAN" },
  "status": {
    "availability": "UNAVAILABLE",
    "freshness": "UNKNOWN",
    "usability": "BLOCKED",
    "provider": "NOT_CONFIGURED",
    "rights": "UNCONFIRMED",
    "codes": ["UNAVAILABLE", "BLOCKED", "DISPLAY_RIGHTS_NOT_CONFIRMED"]
  },
  "timestamps": {
    "dataAsOf": null,
    "observedAt": null,
    "receivedAt": null,
    "generatedAt": "2026-10-26T12:00:00.000Z"
  },
  "freshness": {
    "state": "UNKNOWN",
    "basis": "UNKNOWN",
    "ageSeconds": null,
    "maxAgeSeconds": null,
    "evaluatedAt": "2026-10-26T12:00:00.000Z",
    "policyId": "dr-daily-v1"
  },
  "session": {
    "state": "CLOSED",
    "closed": true,
    "timezone": "Asia/Bangkok",
    "calendarId": "SET"
  },
  "providers": [],
  "coverage": {
    "disclosureScope": "ENTITLED_PROJECTION",
    "catalogTotal": null,
    "computedTotal": 0,
    "availableTotal": 0,
    "visibleTotal": 0,
    "visibleFullCards": 0,
    "visibleRedactedSamples": 0,
    "staleTotal": 0,
    "unavailableTotal": 0,
    "chartOnlyTotal": 0
  },
  "entitlement": {
    "tier": "GUEST",
    "selectedMarket": "dr",
    "maxFullCards": 0,
    "fullCardsReturned": 0,
    "redactedSampleLimit": 1,
    "redactedSamplesReturned": 0,
    "resolvedServerSide": true
  },
  "records": []
}
```

> ตัวอย่างนี้เป็น **fixture อธิบาย contract เท่านั้น** ไม่ใช่ผลจาก provider, ไม่ใช่ quote จริง และไม่ยืนยัน DR rights. เวลาที่ใส่เป็น fixed test time เพื่อแสดงรูปแบบเท่านั้น.

### 2.1 ความหมาย field ระดับบน

| Field | ความหมาย / กฎ |
|---|---|
| `schemaVersion` | version ของ contract; breaking change ให้เพิ่ม major version ใหม่ |
| `requestId` | correlation ID สำหรับ API/audit; ห้ามบรรจุ secret หรือข้อมูลบัญชี |
| `snapshotId` | ID ของชุดข้อมูลต้นทาง/normalization ที่ทำซ้ำและตรวจสอบได้ |
| `market` | `thai`, `dr`, `us`, `tfex`, `forex` |
| `selectedScope` | ตลาด/ชนิดการสแกนที่ผู้ใช้เลือก; ต้องยืนยันกับ route ฝั่ง server ไม่รับเป็นสิทธิ์จาก client |
| `status` | สรุปสถานะ 5 มิติและรหัสสาเหตุ; ดูหัวข้อ 3 |
| `timestamps` | แยก effective time, source observation, Nugaom receipt และ response generation; row-level เป็นเวลาหลักของแต่ละ instrument |
| `freshness` | ผลคำนวณอายุข้อมูลจาก policy ต่อ source/data-kind/session ไม่ใช้ค่า threshold เดียวทุกตลาด |
| `session` | สถานะตลาดและ timezone ตาม exchange calendar; Forex/CFD อาจเป็น `NOT_APPLICABLE`/`UNKNOWN` ตามข้อมูลที่พิสูจน์ได้ |
| `providers` | รายชื่อ source ที่เกี่ยวข้องพร้อม provider/data mode/rights status; ไม่มี URL ที่มี key, token หรือ credential |
| `coverage` | counts ที่เปิดเผยได้ใน scope นี้เท่านั้น; counters ต่างมิติอาจซ้อนทับกันและไม่จำเป็นต้องบวกรวม |
| `entitlement` | server-resolved visibility cap ของ scan ที่เลือก; ห้ามเชื่อ `tier`/cap ที่ส่งจาก client |
| `records` | records ที่ server อนุญาตให้ส่งกลับหลัง rights, scope, entitlement และ redaction projection |

## 3. Canonical state model และ status codes

ห้ามมี enum เดียวที่พยายามอธิบายทุกอย่าง เช่น `status=stale` แล้วไม่มีทางบอกได้ว่าข้อมูลยังใช้เปิด chart ได้หรือไม่ ให้ใช้ 5 แกนแยกกัน:

### 3.1 `status.availability`

- `AVAILABLE` — มี record ที่ผ่านสิทธิ์/ขอบเขตและส่งให้ caller ได้อย่างน้อยหนึ่งรายการ.
- `PARTIAL` — มีทั้ง record ที่ส่งได้และ record ที่ขาด/ถูกปฏิเสธใน scope เดียวกัน; ต้องมี counters และ reason codes.
- `UNAVAILABLE` — ไม่มีข้อมูลที่ส่งให้ caller ใช้ได้ หรือ rights/provider/config ขวางการส่งข้อมูล.

### 3.2 `status.freshness`

- `FRESH` — ผ่าน freshness policy ที่กำหนดตาม market, data kind, expected close, exchange calendar และ source.
- `STALE` — มีข้อมูล แต่เกิน freshness policy; โดยปริยายห้าม signal/performance eligibility.
- `UNKNOWN` — ไม่มี timestamp หรือ policy ตัดสินไม่ได้; ห้ามถือว่า fresh.
- `NOT_APPLICABLE` — ใช้เฉพาะ metadata ที่ไม่ใช่ข้อมูลตามเวลา ไม่ควรใช้กับราคา/แท่ง.

### 3.3 `status.usability`

- `SIGNAL_ELIGIBLE` — ผ่าน rights, provider, freshness, session และ quality gates ของ signal แบบเจาะจงตลาด; ไม่ได้แปลว่าเป็นคำแนะนำหรือคำสั่งเทรด.
- `CHART_ONLY` — อนุญาตแสดงกราฟ/ประวัติ แต่ห้ามใช้สร้างสัญญาณหรือ performance claim.
- `DISPLAY_ONLY` — แสดงค่า/สถานะได้ แต่ยังไม่มีสิทธิ์หรือคุณสมบัติพอสำหรับ chart analysis/signal.
- `BLOCKED` — ห้ามใช้หรือส่ง value data ออก เช่น rights denied/unconfirmed หรือ provider data invalid.

### 3.4 `status.provider`

`READY`, `DEGRADED`, `UNAVAILABLE`, `NOT_CONFIGURED`, `UNKNOWN`.

`READY` หมายถึงมีการตอบสนองตาม contract เท่านั้น ไม่ได้ยืนยัน data quality, freshness, display rights หรือ signal eligibility; ต้องดูแกนอื่นร่วมด้วย.

### 3.5 `status.rights`

`CONFIRMED`, `UNCONFIRMED`, `DENIED`, `EXPIRED`, `UNKNOWN`.

- ใช้ `CONFIRMED` เฉพาะเมื่อมี evidence/การตั้งค่าที่ระบบกำหนดให้เป็น source of truth.
- `UNCONFIRMED`, `DENIED`, `EXPIRED` ต้อง fail closed สำหรับการแสดงผลที่เกี่ยวข้อง; อย่าส่ง raw provider data มาให้ client แล้วหวังให้ UI ซ่อนเอง.
- `UNKNOWN` ไม่เท่ากับอนุญาต.

### 3.6 `status.codes` — codes ที่เครื่องอ่านได้

`status.codes` ระดับ envelope เป็น array ของสถานะ/สาเหตุรวม; อาจมีหลายตัวพร้อมกัน เช่น `STALE` + `CHART_ONLY` + `SOURCE_TIMEOUT` หาก cache เก่ายังเปิด chart ได้แต่ห้ามสแกน. ในแต่ละ record ฟิลด์ `statusCodes` ใช้ใส่เฉพาะรหัสที่เจาะจงกับ instrument นั้น; `record.status` ยังคงมี state 5 มิติ. ห้าม frontend อนุมานเหตุผลจาก HTTP code อย่างเดียว.

| Code | ความหมาย / การใช้งาน |
|---|---|
| `AVAILABLE` | มีข้อมูลที่ส่งได้ใน scope |
| `PARTIAL` | ชุดข้อมูลบางส่วนพร้อม บางส่วนไม่พร้อม |
| `STALE` | ข้อมูลเกิน freshness policy |
| `UNAVAILABLE` | ไม่มีข้อมูล usable/ส่งได้ |
| `CHART_ONLY` | อนุญาตเฉพาะการแสดง chart/history |
| `DISPLAY_ONLY` | แสดงสถานะ/ข้อมูลที่จำกัดได้ แต่ไม่ใช้ chart signal หรือ performance ตาม eligibility |
| `BLOCKED` | ห้ามใช้/ส่ง value data ใน scope นี้ |
| `SIGNAL_ELIGIBLE` | record ผ่าน policy ให้ใช้คำนวณ signal เท่านั้น ไม่ใช่คำแนะนำหรือคำสั่ง |
| `DISPLAY_RIGHTS_NOT_CONFIRMED` | ยังยืนยันสิทธิ์ display ไม่ได้ |
| `DISPLAY_RIGHTS_DENIED` | สิทธิ์ถูกปฏิเสธ |
| `DISPLAY_RIGHTS_EXPIRED` | หลักฐาน/สัญญาสิทธิ์หมดอายุ |
| `SOURCE_NOT_CONFIGURED` | provider ยังไม่ถูกตั้งค่า |
| `SOURCE_UNAVAILABLE` | provider ไม่พร้อม/ตอบไม่สำเร็จ |
| `SOURCE_TIMEOUT` | provider เกิน timeout |
| `SOURCE_RATE_LIMITED` | ถูกจำกัด request โดย provider |
| `PROVIDER_DEGRADED` | source ตอบแต่คุณภาพ/coverage ไม่ครบ |
| `UNKNOWN_FRESHNESS` | ไม่มี timestamp/policy พอจะตัดสินความสด |
| `MISSING_SOURCE_TIMESTAMP` | response ไม่มี source observation time ที่จำเป็น |
| `FUTURE_TIMESTAMP` | timestamp อยู่ในอนาคตเกิน tolerance |
| `STALE_QUOTE` | quote เกิน age policy |
| `STALE_BAR` | แท่งล่าสุดเก่ากว่า expected closed bar |
| `INCOMPLETE_BAR` | แท่งยังไม่ปิดหรือ field ไม่ครบ |
| `WRONG_SESSION` | ข้อมูลไม่ตรง expected exchange session |
| `INSUFFICIENT_HISTORY` | จำนวน/ช่วงประวัติไม่พอสำหรับ algorithm ที่กำหนด |
| `INVALID_OHLC` | OHLC ไม่ผ่าน consistency checks |
| `DUPLICATE_DATA` | มี record/bar ซ้ำใน snapshot เดียว |
| `QUALITY_REJECTED` | ข้อมูลไม่ผ่าน market-specific validation |
| `NOT_MAPPED` | ไม่พบ canonical instrument/underlying mapping |
| `MISSING_UNDERLYING` | คำนวณ DR/derived value ไม่ได้เพราะไม่มี underlying |
| `MISSING_FX` | ไม่มี FX reference ที่ผ่านสิทธิ์และเวลา |
| `AS_OF_NOT_ALIGNED` | timestamp ขององค์ประกอบที่นำมาเทียบไม่สอดคล้องกัน |
| `CURRENCY_MISMATCH` | หน่วยเงิน/contract multiplier ไม่ตรงกัน |
| `WARMUP_REQUIRED` | ยังไม่ครบ warm-up data window (เช่น Forex 60 แท่งปิดตาม rule ที่อนุมัติ) |
| `ENTITLEMENT_REQUIRED` | ไม่มีสิทธิ์สำหรับ full result; ใช้กับ response ที่ไม่มี protected rows เท่านั้น |
| `INVALID_MARKET` | market ไม่อยู่ใน enum |
| `INVALID_SYMBOL` | symbol ไม่อยู่ใน server-side allowlist/contract |
| `PARTIAL_DATA` | records บางส่วนขาดหรือ reject |
| `UNKNOWN` | สาเหตุยังจำแนกไม่ได้; ห้ามแนบ raw provider error ให้ client |

**กติกา:** `status.codes` ห้ามมี credential/provider payload; codes ต้องเป็น allowlist แบบ stable. เพิ่ม code ใหม่แบบ backward-compatible; ห้ามเปลี่ยนความหมายเดิมโดยไม่เปลี่ยน version.

## 4. Timestamp, freshness และ session rules

| Timestamp | นิยาม | ถ้าหายไป |
|---|---|---|
| `dataAsOf` | เวลาที่ข้อมูลตลาดมีผล/สิ้นสุดจริง เช่น close time ของแท่ง หรือ effective time ของ quote | `null`; อย่าแทนด้วย `receivedAt` |
| `observedAt` | source timestamp ที่ provider แนบว่า quote/snapshot ถูกสังเกตเมื่อใด | `null`; freshness เป็น `UNKNOWN` หากจำเป็นต่อการตัดสิน |
| `receivedAt` | เวลาที่ระบบ ingest รับ payload จาก source รอบนั้น | `null` หากไม่มีหลักฐาน; ห้ามอ้าง `generatedAt` |
| `generatedAt` | เวลาที่ API normalize และสร้าง response | บังคับมี; ไม่ใช่เวลาตลาด |

Freshness object ใช้ `basis` ระบุหลักฐานที่ใช้ เช่น `DATA_AS_OF`, `OBSERVED_AT`, `BAR_CLOSE_AT`, `HEARTBEAT_AT`, `UNKNOWN`; ต้องมี `evaluatedAt`, `ageSeconds`, `maxAgeSeconds` และ `policyId`. หากมี timestamp อนาคต ให้ `UNKNOWN` หรือ `UNAVAILABLE` พร้อม `FUTURE_TIMESTAMP`; ห้าม clamp เป็นอายุศูนย์แล้วแสดง FRESH.

Freshness threshold ต้องเป็น policy แยกตาม market + data kind + timeframe + exchange calendar/provider terms. ตัวอย่างเช่น daily bar ใช้ expected closed session/holiday calendar; Forex quote ใช้ quote timestamp/heartbeat policy; ไม่ใช้ “ทุกอย่างไม่เกิน 30 วินาที” หรืออายุ cache อย่างเดียวแทนความหมายของข้อมูล.

## 5. Instrument record

แต่ละ record ใน `records[]` มี:

- `instrument`: canonical `instrumentId`, `symbol`, `market`, `assetType`, optional `displayName`, `currency`, `exchange`, และ optional `underlying` mapping สำหรับ DR.
- `status`: state 5 มิติระดับ record; `statusCodes` เป็นเหตุ/quality codes ที่เจาะจงกับ record นั้น.
- `timestamps`, `freshness`, `session`, `source`: ใช้ semantics เดียวกับ envelope; per-row source สำคัญเมื่อมี mixed providers.
- `source`: `{providerId, type, dataMode, sourceTimestampKnown, isLiveFeed, rightsStatus, fallback}`. `isLiveFeed=true` ถูกอนุญาตเฉพาะ `REALTIME_STREAM`/`REALTIME_POLL`, source timestamp known, rights confirmed และไม่มี fallback; EOD/reference/history/synthetic ต้องเป็น `false`.
- `eligibility`: `chart`, `signal`, `performance`; `execution` ต้องเป็น `false` สำหรับ customer-facing read-only product.
- `projection`: `FULL` หรือ `REDACTED`.
- `data`: payload ที่ market-specific; ทุก market ต้องมี schema extension/test ของตนเอง. ห้ามรับ raw provider object ผ่านตรง.

### Guest redacted projection

- Guest: `maxFullCards=0`, `redactedSampleLimit=1`, ส่งได้ไม่เกิน 1 sample.
- sample อนุญาตเพียง symbol, name, market, changePct, dataAsOf, source ตาม allowlist ที่อนุมัติ.
- ห้าม price/score/Entry/TP/SL/underlying valuation/hidden array/leaderboard หรือ aggregate ที่ใช้อนุมาน record ที่ซ่อน.
- Trial=8; Starter=3; Pro=5; Ultimate=8 full cards ต่อ scan ของ market ที่เลือก.
- cap เป็น **full cards ที่ response ส่งจริง** ไม่ใช่ catalog size; filter, pagination, diagnostics, chart payload, summary และ error path ต้องไม่เพิ่มสิทธิ์.

## 6. Coverage และ privacy/entitlement

`coverage` counters อธิบายจำนวนภายในขอบเขตที่ caller มีสิทธิ์รู้เท่านั้น:

- `catalogTotal`: nullable; ใส่ได้เมื่อ universe count เป็นข้อมูลที่เปิดเผยได้และระบุ version/as-of ใน `catalog`.
- `computedTotal`: รายการที่ backend พยายามคำนวณใน scope นี้; ไม่ใช่ทั้งตลาด เว้นแต่มีหลักฐาน.
- `availableTotal`, `unavailableTotal`, `staleTotal`, `chartOnlyTotal`: นับเฉพาะ scope ที่เปิดเผยได้; `staleTotal` และ `chartOnlyTotal` ซ้อนกับ available/unavailable ได้ ไม่ควรบวกรวมกัน.
- `visibleTotal`: จำนวน records ที่ส่งกลับจริง; ต้องสอดคล้องกับ `records.length`.
- `disclosureScope`: `PUBLIC_CATALOG`, `ENTITLED_PROJECTION`, `OWNER_INTERNAL`.

Customer endpoint ใช้ `PUBLIC_CATALOG` เฉพาะข้อมูล catalog ที่อนุมัติให้เปิดเผย; counters ของการคำนวณ/ผลสแกนต้องใช้ `ENTITLED_PROJECTION` และต้องไม่เปิด hidden rows/stats. `OWNER_INTERNAL` ห้าม serialize ออก customer route.

`entitlement` ต้องถูกเติมหลังตรวจ session + membership ฝั่ง server. `resolvedServerSide` ต้องเป็น `true`; หากไม่มี rights หรือ resolution ล้มเหลว ให้ส่ง safe error/guest projection ตาม policy โดยไม่ fallback เป็น cap จาก client.

## 7. Market-specific extensions โดยไม่ทำ schema แตกแขนง

Envelope กลางเหมือนเดิม แต่ payload/schema extension ต้องระบุชนิดข้อมูลและ validation ของตลาด:

| Market | Extension ที่ควรมี | ข้อจำกัดที่ต้องรักษา |
|---|---|---|
| `thai` | `dataKind`: `DAILY_BAR`, `QUOTE`, `SCANNER_CANDIDATE`; SET/mai identity; expected session; rule/snapshot ID | แยก catalog 150 กับ computed coverage; mai ที่ไม่มี computed feed เป็น unavailable/zero computed ไม่สร้างผลจาก catalog |
| `dr` | `dataKind`: `DR_DAILY_BAR`, `UNDERLYING_REFERENCE`, `FX_REFERENCE`, `DR_BRIDGE`; currency/ratio/mapping provenance | ห้ามคำนวณ premium/discount/fair value ถ้า mapping, FX rights หรือ as-of alignment ไม่ครบ; mapping HKD ต้องไม่ติดหน่วย USD |
| `us` | `dataKind`: `EQUITY_EOD`, `ETF_EOD`, `QUOTE`, `CHART`; snapshot/universe version | EOD ต้อง `isLiveFeed=false`; ETF แยกจาก stock universe; daily-only route ต้องปฏิเสธ timeframe ที่ไม่มี |
| `tfex` | `dataKind`: `FUTURES_CANDIDATE`, `FUTURES_QUOTE`, `CANDLE`, `OPTIONS_CHAIN`; contract expiry/active evidence/provider per row | candidate ≠ active/liquid; Yahoo/reference ≠ executable TFEX quote; missing OI เป็น null ไม่ใช่ 0 |
| `forex` | `dataKind`: `FX_QUOTE`, `CANDLE`, `SCAN_CANDIDATE`; owner-ingest heartbeat/status แยกจาก market-data readiness | connection alive ≠ data fresh ≠ signal ready; warmup/closed bars ต้องผ่าน; customer ไม่ pair MT5 หรือส่ง token/credential |

ฟิลด์ extension ต้องอยู่ใต้ `data` (และตาม `market`/`dataKind` schema); อย่าเพิ่ม root-level field เฉพาะตลาดจน client ร่วมใช้ไม่ได้.

## 8. API errors แยกจาก data status

`UNAVAILABLE` คือ **ผลข้อมูล** ที่ API ตอบอย่างถูกต้องได้ เช่น HTTP 200 พร้อม empty records และ reason. ส่วน invalid/auth/rate-limit คือ **request/authorization error** และไม่ควรใส่ปนใน `status.availability`.

| HTTP | Error code | การใช้ |
|---:|---|---|
| 400 | `INVALID_REQUEST`, `INVALID_MARKET`, `INVALID_SYMBOL`, `INVALID_VIEW` | request ไม่ตรง contract |
| 401 | `AUTHENTICATION_REQUIRED` | ไม่มี session เมื่อ route ต้องมี session |
| 403 | `FORBIDDEN`, `OWNER_ONLY`, `MEMBERSHIP_REQUIRED`, `INVALID_ORIGIN` | ไม่ได้รับอนุญาต; ห้ามคืน protected rows |
| 404 | `NOT_FOUND` | resource ไม่มีหรือไม่เปิดเผย |
| 409 | `CONFLICT`, `REPLAYED_REQUEST`, `STALE_WRITE` | conflict/replay; ไม่ส่ง raw state |
| 422 | `INVALID_DATA_REQUEST` | request ถูก parse แต่ผิด semantic constraints |
| 429 | `RATE_LIMITED` | ใส่ `Retry-After` เมื่อกำหนดได้ |
| 503 | `PROVIDER_UNAVAILABLE`, `DISPLAY_RIGHTS_NOT_CONFIRMED`, `SOURCE_NOT_CONFIGURED` | service ยังส่งข้อมูลที่อนุญาตไม่ได้; safe code เท่านั้น |
| 500 | `INTERNAL_ERROR` | generic response; correlation ID เท่านั้น |

Error body รูปแบบ:

```json
{
  "schemaVersion": "nugaom.api-error.v1",
  "requestId": "req_fixture_002",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "error": {
    "code": "DISPLAY_RIGHTS_NOT_CONFIRMED",
    "messageKey": "market_data.unavailable",
    "retryable": false
  }
}
```

ห้ามส่ง raw stack, raw provider response, query URL ที่มี key, token, App Secret, account number หรือ record ที่ไม่ผ่าน entitlement. response ที่เป็น member-specific ต้อง `Cache-Control: private, no-store`.

## 9. Derived state rules (source of truth อยู่ backend)

1. Rights `UNCONFIRMED`, `DENIED`, `EXPIRED`, หรือ `UNKNOWN` → customer value records ไม่ถูกส่ง; `usability=BLOCKED`; `availability=UNAVAILABLE` หากไม่มี safe public projection.
2. Provider `NOT_CONFIGURED`/`UNAVAILABLE` → ห้ามสร้างข้อมูลจาก demo/static/current defaults. หากมี approved historical backup ที่แสดงได้ ให้ระบุ `CHART_ONLY`, `fallback=true`, `signal=false`.
3. Freshness `STALE` หรือ `UNKNOWN` → `signal=false` และ `performance=false`; chart อาจ true ได้เฉพาะเมื่อ data rights และ chart safety ผ่าน.
4. `SIGNAL_ELIGIBLE` ต้องผ่าน rights confirmed + provider allowed + freshness policy + market/session/quality validation + selected-market entitlement; status ไม่ใช่คำแนะนำลงทุน.
5. `PERFORMANCE_ELIGIBLE` ต้องมี verified closed-trade snapshot พร้อม sample/window/semantics/methodology/source; technical score/daily change/near-target ใช้แทนไม่ได้.
6. `execution` สำหรับ customer response เป็น `false` ตลอด.
7. `CHART_ONLY` ต้องมี `signal=false`, `performance=false`; `UNAVAILABLE` หรือ `BLOCKED` ต้องไม่มี value-bearing data field.
8. `generatedAt` ห้ามใช้สร้าง freshness; cache age และ provider age เป็นคนละตัววัด.
9. หาก records ภายในชุดมี state ต่างกัน envelope เป็น `PARTIAL` เมื่อมีทั้ง available และ unavailable/rejected; คง status ต่อ record และ counters/reason codes.
10. Unknown enum/status จาก provider ห้ามผ่านเข้า client; normalizer map เป็น stable `UNKNOWN`/`QUALITY_REJECTED` โดยไม่เผย provider string.

## 10. HTTP behavior, cache และ refresh

- Request ถูกต้องแต่ไม่มีข้อมูล: ส่ง data envelope `availability=UNAVAILABLE`, records ว่างหรือเป็น safe instrument status record ที่ไม่มีค่าราคา, HTTP 200 หรือ 503 ตาม service-level policy ที่กำหนดให้ endpoint นั้น; ต้องทำให้สม่ำเสมอในแต่ละ route. ข้อเสนอ v1 คือ **HTTP 200 สำหรับ valid data query ที่ตอบสภาพข้อมูลได้** และ HTTP 503 เมื่อระบบไม่สามารถสร้าง contract response ได้จริง.
- Invalid/auth/rate limit: ใช้ HTTP error mapping ข้างต้น; ห้ามส่ง partial protected data ใน error body.
- Public catalog cache แยกจาก private entitlement projection; member response `private, no-store` จนกว่าจะมี caching design ที่พิสูจน์แยก user/tier/scope ได้.
- Backend pull/cache เป็นเจ้าของ refresh; UI อ่าน API envelope. ห้าม browser polling ทุก symbol/provider โดยตรง.
- ตั้ง timeout, bounded concurrency, stale-while-chart-only เฉพาะเมื่อ rights อนุญาต; stale fallback ห้าม signal-eligible.

## 11. Versioning และ rollout

1. เพิ่ม schema แบบ additive ภายใต้ `schemaVersion=v1`; adapters เริ่มคืน envelope คู่กับ legacy fields ชั่วคราวเฉพาะ backend ระหว่าง migration.
2. ทำ `normalize → validate → authorize rights → apply entitlement/projection → validate output → serialize` เป็นลำดับบังคับ.
3. Frontend อ่าน envelope เป็นหลัก; ห้าม infer provider/source/freshness จาก `market`, `feed` string, HTTP 200 หรือเวลา render.
4. เพิ่ม tests: schema validation; fixed-clock freshness; state transition; per-market fixtures; rights false; stale/fallback; entitlement + hidden aggregate; no secret; error/headers; preserving chart routes.
5. หลังครบทุก route ลบ legacy fields ที่ซ้ำ/กำกวม. Breaking enum/field meaning → v2; unknown optional fields ให้ client ignore ได้.
6. Re-score UX/readiness หลัง test run และ production-like evidence ใหม่เท่านั้น. Schema ผ่าน validation ไม่ได้แปลว่า provider rights, live data หรือ readiness ผ่าน.

## 12. สิ่งที่ยังต้องตัดสินใจ/ยืนยันก่อน implementation

- ผู้ดูแล source of truth ของ display rights/provider evidence ต่อ source และ environment.
- Freshness policy ต่อ data kind (EOD, intraday, quote, FX reference, options, MT5 heartbeat) และ exchange calendar.
- Public catalog ที่อนุญาตเปิดเผยจริง; หากไม่ชัด `catalogTotal=null`.
- Customer route ที่จะย้ายก่อน (แนะนำ Thai/DR Radar และ US desk หลัง owner/read-only boundary) และลำดับ migration.
- JSON Schema validator ที่เลือกใช้ใน tests/CI; ไฟล์ schema นี้เป็น proposal และยังไม่ได้ติดตั้ง dependency.

**สถานะปัจจุบัน:** ออกแบบ contract เท่านั้น ยังไม่มีการแก้ runtime API, provider behavior, UI, membership, Stripe, price, commit, push หรือ deploy.


## 13. Scaffold readiness (ไม่ใช่ runtime rollout)

มี pure v1 scaffold สำหรับส่งต่อ backend agent แล้ว:

- `src/market-data/contracts/v1/status-codes.mjs` — market/state/status/error registry และ cap ที่อนุมัติ
- `src/market-data/contracts/v1/validate-envelope.mjs` — semantic invariant checker ที่คืนเฉพาะ `{path, code}`; ไม่ echo values
- `src/market-data/contracts/v1/validate-envelope.test.mjs` — deterministic Node tests สำหรับห้าตลาด, Guest/Trial/paid caps, stale/chart-only, live/fallback, rights, performance evidence และ schema/registry alignment
- `schemas/nugaom-market-data-envelope.v1.schema.json` — shape validation proposal
- `docs/handoffs/canonical-market-data-backend-handoff-2026-10-26.md` — ขั้นตอนและ acceptance gates สำหรับ migrate route จริง

**ยังไม่ได้ต่อ** validator หรือ schema เข้ากับ API routes, ยังไม่ได้แก้ provider adapters, authorization, database, customer UI หรือ freshness policies. นี่เป็นการแยก scaffolding เพื่อให้ backend agent migrate ทีละ route โดย production behavior ปัจจุบันไม่เปลี่ยนก่อน review. การทดสอบใน scaffold ไม่ยืนยัน provider rights, production data หรือ readiness.
