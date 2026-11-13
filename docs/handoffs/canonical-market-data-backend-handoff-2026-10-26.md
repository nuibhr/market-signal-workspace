# Backend Handoff — Canonical Market Data v1 (Five Markets)

**วัน:** 26 ตุลาคม 2026
**สถานะ:** Commit-ready contract scaffold; route migration ยังไม่เริ่ม
**ผู้รับ:** Backend implementation agent
**Branch at preparation:** `fix/cloudflare-login-demo-scanner-ai`
**Base HEAD:** `9808dfd`
**Mode:** Implement backend only; preserve customer UX/landing unless a separate change is approved.

## 1. เป้าหมายงานที่ส่งต่อ

นำ shared canonical envelope v1 ไปใช้กับ backend ของ Thai SET/mai, DR, US equities/ETFs, TFEX และ Forex/CFD แบบทยอย migrate โดยไม่หลอก freshness, provider rights, coverage, entitlement หรือ performance และไม่เปลี่ยน behavior ของ production ระหว่างรับ handoff นี้

ไฟล์นี้ **ไม่ใช่การอนุมัติให้เปิด real-time provider feed หรือเปลี่ยนสิทธิ์/ราคา**. ต้องยืนยันสิทธิ์การแสดงข้อมูลจริงแยกจาก code/config; หากไม่มีหลักฐาน ให้คืน `UNAVAILABLE`/`CHART_ONLY` ตามกรณี.

## 2. สิ่งที่มีใน scaffold ที่ commit ได้

| Path | สิ่งที่มี | สถานะ |
|---|---|---|
| `nugaom-canonical-market-data-contract-v1.md` | ความหมาย field, state model, codes, timestamp/freshness rules, Guest/Trial/paid caps และ market extensions | ออกแบบแล้ว |
| `schemas/nugaom-market-data-envelope.v1.schema.json` | JSON Schema draft 2020-12 สำหรับ market-data envelope และ safe API error; guard `isLiveFeed`, Guest projection และ tier caps | Proposal; ยังไม่ใช้ validate routes |
| `src/market-data/contracts/v1/status-codes.mjs` | Registry ของ market, data states/modes, status/error codes, HTTP map และ entitlements | Pure constant module |
| `src/market-data/contracts/v1/validate-envelope.mjs` | Semantic invariant checker; คืน path/code diagnostics โดยไม่ echo values | ไม่ได้ import จาก API route |
| `src/market-data/contracts/v1/validate-envelope.test.mjs` | Node built-in tests สำหรับ cap, redaction, stale/chart-only, performance evidence, live claims และ registry/schema alignment | Test เท่านั้น; ไม่ได้เรียก provider |
| `docs/handoffs/canonical-market-data-backend-handoff-2026-10-26.md` | แผนและ acceptance gates สำหรับ agent ผู้ migrate backend | เอกสารส่งต่อ |

**สำคัญ:** validator ตรวจ semantic invariants; JSON Schema เป็น shape contract. ก่อนใช้ใน CI ควรเพิ่ม JSON Schema validator เป็น dependency โดยตรง (หรือเลือก validator ที่ project อนุมัติ) แทนการพึ่ง transitive package ของ Next.js. ไม่มี dependency ใหม่ใน scaffold นี้.

## 3. Contract ที่ต้องยึดเป็น source of truth

ใช้เอกสาร [`nugaom-canonical-market-data-contract-v1.md`](../../nugaom-canonical-market-data-contract-v1.md) และ schema เป็นหลัก. State แยก 5 มิติ:

- `status.availability`: `AVAILABLE | PARTIAL | UNAVAILABLE`
- `status.freshness`: `FRESH | STALE | UNKNOWN | NOT_APPLICABLE`
- `status.usability`: `SIGNAL_ELIGIBLE | CHART_ONLY | DISPLAY_ONLY | BLOCKED`
- `status.provider`: `READY | DEGRADED | UNAVAILABLE | NOT_CONFIGURED | UNKNOWN`
- `status.rights`: `CONFIRMED | UNCONFIRMED | DENIED | EXPIRED | UNKNOWN`

พร้อม `status.codes[]` / per-record `statusCodes[]`, `timestamps`, `freshness`, `session`, `providers`, `coverage`, server-derived `entitlement`, records และ market-specific `dataKind`/`data`.

### Timestamp semantics ห้ามเปลี่ยน

- `dataAsOf`: effective market time/bar close.
- `observedAt`: provider-supplied observation timestamp.
- `receivedAt`: Nugaom ingest receipt time; ห้ามเขียนทับตอนอ่าน cache.
- `generatedAt`: response generation timeเท่านั้น.
- ไม่มี source timestamp → `null` + freshness `UNKNOWN`; ห้ามใช้ `new Date()` แทน source time.

### Safety invariants

1. `isLiveFeed=true` ได้เฉพาะ stream/poll mode ที่ระบุ timestamp, rights confirmed และ no fallback; EOD/delayed/history/reference/synthetic ต้อง false.
2. Stale/unknown freshness, chart-only, fallback, rights-unconfirmed หรือ unavailable ไม่เป็น signal/performance eligible.
3. `performance=true` ต้องมี verified closed-trade evidence: closed, sample size, window, trade semantics, methodology ID, source ID. หากไม่มี ให้ UI/API สื่อว่าไม่มีค่า.
4. Customer execution eligibility ต้อง false; schema ไม่อนุญาตให้ client วาง order.
5. Guest: 0 full cards + สูงสุด 1 redacted sample. Trial=8, Starter=3, Pro=5, Ultimate=8 full cards ต่อ selected-market scan. Resolve cap จาก server ไม่รับจาก body/query.
6. Apply entitlement/projection ก่อนทำ stats, summary, leaderboard, diagnostic, pagination หรือ chart payload. ห้าม hidden arrays/aggregates หลุด.
7. `OWNER_INTERNAL` coverage/raw data ห้าม serialize ให้ customer; customer path = read-only.
8. Provider rights false/unknown ไม่ส่ง value-bearing provider rows ให้ customer; ห้าม fallback เงียบเป็น current data.

## 4. ขอบเขตที่ห้ามขยายในงาน backend นี้

- ห้ามให้ลูกค้าเชื่อม broker, MT5, upload CSV หรือกรอก App ID/App Secret/account number/token.
- ห้ามเปลี่ยน Stripe, prices, plan IDs, entitlement ladder หรือแปลง Trial/Guest mapping.
- ห้ามเพิ่ม claims `real-time`, `live`, `all market`, official index coverage, broker sync, execution/fill หรือ performance โดยไม่มี evidence.
- ห้ามใช้ provider fixture, demo, generated timestamp หรือ unit test เป็น display license/runtime proof.
- ห้ามเปลี่ยน landing Neon Observatory, shared Workspace, chart routes, Radar/Watchlist/Winrate/tools ใน backend-only task.
- ไม่ commit/push/deploy ต่อจนผ่าน review และผู้ใช้สั่งแยกอย่างชัดเจน.

## 5. ลำดับลงมือที่แนะนำ

### Phase A — Route inventory และ authz boundary ก่อน data migration

ทำ inventory ด้วย direct URL/API tests สำหรับ portfolio, provider config, CSV, connector, MT5 pairing/revoke/ingest, raw snapshot และ scanner routes. ปิด customer bypass ด้วย trusted server role + tenant/object ownership ก่อน provider call; denial ต้อง 401/403 และไม่ leak payload. UI ซ่อนปุ่มไม่ถือว่าผ่าน.

### Phase B — Normalizer/serializer กลาง

สร้าง pure server-side stages:

`provider/owner ingest → normalize → validate timestamps/quality/session → rights gate → freshness/state derivation → entitlement projection → validate output → serialize`

ให้ใช้ fixed clock/market calendar injection ใน tests. ห้ามใช้ HTTP 200 หรือจำนวน rows เป็นสัญญาณว่า data usable.

### Phase C — Migrate ทีละ market

1. **Thai** — ปัจจุบัน catalog 150 เทียบกับ computed 8 และ mai computed 0 ตาม audit. แสดง counts แยก; ตรวจ expected closed SET session; rights/fallback failure เป็น unavailable/chart-only; stats scope ต้องตรงกับ visible rows.
2. **DR** — catalog 141 เทียบกับ computed feed 6 ตาม audit. ตรวจ input `market` ให้ reject unknown (อย่า default เป็น DR); bridge ต้องมี underlying mapping, currency, FX rights และ as-of alignment; ตัด avg return ที่มาจาก daily change/near-TP.
3. **US/ETFs** — data path เป็น EOD/closed bars; แยก liquid stock snapshot ออกจาก ETF set; unify EOD/FX rights flags; status ต่อ row ต้องรักษา unavailable แทน filter ทิ้ง; search/diagnostic/pagination ต้องอยู่ใต้ cap.
4. **TFEX** — quote/candle/options แยก provider/source ต่อ row; Yahoo/reference ไม่เป็น executable TFEX quote; missing OI เป็น null ไม่ใช่ 0; candidate ไม่เท่ากับ active/liquid; portfolio/demo/connector routes ต้อง owner-only.
5. **Forex/CFD** — owner ingestion เท่านั้น; connector routes ต้องตรวจ trusted owner/service + tenant + expiry/revoke/replay + audit; connection heartbeat แยกจาก quote freshness และ signal readiness; ใช้ market-approved closed-bar warmup (audit ปัจจุบันระบุ 60 closed 15m bars) ก่อน signal.

### Phase D — Client projection และ compatibility

ย้าย API response ให้คืน canonical envelope; ระหว่าง migration อาจมี adapter legacy internal เฉพาะหลัง authz แต่ห้ามส่ง duplicated/contradictory timestamps/status ให้ browser. ทุก response ที่ per-member/entitlement-specific ใช้ `Cache-Control: private, no-store` จนมี cache key isolation ที่พิสูจน์ได้.

### Phase E — Acceptance evidence และ re-score

รัน route/data/rights/tenant/entitlement/UI preservation matrix ใหม่. คะแนน readiness จะถูก re-score หลัง evidence จริงเท่านั้น; schema ผ่าน ไม่ได้แปล provider rights หรือ all-market readiness ผ่าน.

## 6. Acceptance tests ที่ agent ต้องส่งกลับ

### Schema/contract

- JSON Schema validates both normal envelope + API error examples and rejects malformed timestamp, unknown enum, additional secret fields and broken tier cap.
- Semantic validator returns only safe `{path, code}` diagnostics; never echoes input value/secret.
- Contract examples include all five markets with fixed test fixtures; none labeled live.

### Time/data state

- Fixed-now tests: missing source timestamp, future timestamp, stale quote/bar, incomplete/current bar, invalid OHLC, duplicate bar, wrong session, insufficient history, holiday/session edge.
- `receivedAt`/`generatedAt` cannot substitute for `dataAsOf`/`observedAt`.
- `STALE + CHART_ONLY` remains chart-capable but signal/performance false.
- Rights false/provider timeout/native unavailable + fallback yields unavailable or explicit chart-only; never current signal.

### Entitlement/security

- Guest=1 redacted, Trial=8, Starter=3, Pro=5, Ultimate=8 at every selected-market path.
- Fuzz page/query/filter/diagnostic/chart/summary/all-scans for cap bypass and hidden aggregate leakage.
- Member/guest direct calls against owner/provider/portfolio/CSV/connector routes get 401/403 with no provider call and no sensitive body; owner A cannot access owner B objects.
- Error responses include no raw provider payload, stack, token, account number or secret.

### Market-specific

- Thai: catalog 150/computed 8/mai 0 kept separate; selected-market chart handoff; reset/filter behavior.
- DR: invalid market rejected; underlying/FX missing, currency mismatch and as-of misalignment block valuation/signal.
- US: EOD only, separate ETF set, partial rows visible, rights false and query/cap behavior deterministic.
- TFEX: reference source distinguishable; missing OI null; candidate vs active; owner portfolio route locked.
- Forex: connection vs data-ready state; 59 bars not ready / 60 bars only ready if rights, heartbeat and quotes pass; revoke/stale/provider-off denied; no customer pairing.

### Release/preservation

- On this worktree, `node --test src/market-data/contracts/v1/validate-envelope.test.mjs` passed 12/12; `npm test` passed 512/512; `npm run build` passed; Ajv 2020 compiled the schema and validated both embedded JSON examples. These are local scaffold/build checks, not provider, license or route-migration evidence.
- Landing, Neon Observatory, shared Workspace, existing routes/charts, Radar, Watchlist, Winrate and tools still work; preview remains noindex isolated.
- Known limitations and actual provider rights evidence recorded; no marketing claim beyond evidence.

## 7. Current validation and Git handoff state

- Scaffold-specific test command: `node --test src/market-data/contracts/v1/validate-envelope.test.mjs`.
- Full project test runner auto-discovers `src/**/*.test.mjs`, so the new test joins `npm test` without editing the runner.
- JSON Schema/examples were manually compiled/checked with the sandbox’s current Ajv 2020 package; Ajv is not declared as a direct dependency, so do not make CI rely on that transitive resolution. Choose/pin a direct validator if adding schema validation to automated tests.
- No app route imports the new registry or validator yet; this is deliberate to avoid changing production behavior before the next agent owns migration.
- Existing worktree contains unrelated earlier untracked implementation/research artifacts. Stage only the explicit scaffold file list; never `git add .`.
- **Commit-ready paths only:**
  - `nugaom-canonical-market-data-contract-v1.md`
  - `schemas/nugaom-market-data-envelope.v1.schema.json`
  - `src/market-data/contracts/v1/status-codes.mjs`
  - `src/market-data/contracts/v1/validate-envelope.mjs`
  - `src/market-data/contracts/v1/validate-envelope.test.mjs`
  - `docs/handoffs/canonical-market-data-backend-handoff-2026-10-26.md`

Before committing, rerun `git status --short`, stage only the above paths, inspect `git diff --cached --check` and `git diff --cached --stat`, then run tests. No commit or remote push has been made as part of this handoff preparation.
