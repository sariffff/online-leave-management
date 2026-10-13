# บันทึกงาน (สำหรับ Claude อ่านทุกครั้งที่เริ่ม session)

> **กติกา:** ตอบผู้ใช้เป็นภาษาไทย / เมื่อผู้ใช้พิมพ์ "ทำต่อ" ให้อ่านหัวข้อ "งานถัดไป" แล้วทำต่อทันที
> **ทุกครั้งที่ทำงานเสร็จหนึ่งชิ้น ให้อัปเดตไฟล์นี้** (ย้ายจาก "งานถัดไป" → "ประวัติงาน" พร้อมวันที่)
> รายละเอียดระบบ (บทบาท, ขั้นตอนใบลา, โครงสร้างโค้ด, env) อยู่ใน `README.md` — ไม่ต้องเขียนซ้ำที่นี่

## สถานะปัจจุบัน
- โปรเจกต์: ระบบลาออนไลน์ Next.js 15.5 + React 19 + Supabase + Tailwind 4 (Node 22, npm 11)
- refactor ทั้งระบบเสร็จแล้ว **ยังไม่ได้ commit** (git มีแค่ `first commit`)
- `npm run typecheck`, `eslint`, `npm run build` ผ่านทั้งหมด (ตรวจล่าสุด 2026-10-13)
- ทดสอบหลังล็อกอินจริงแล้ว (E2E ทุกบทบาท) — ผล `tests/TEST_REPORT.md`: unit 77/77, E2E ล่าสุด PASS 231 / WARN 4 / FAIL 5 (ข้อมูลเก่า 5) — 2026-10-13 หลังรัน migration

## งานถัดไป
- **หน้าตั้งค่าระบบ `SETTINGS_PLAN.md` ครบทั้ง 4 ช่วงแล้ว** + แก้ตาม `bug-report-form-me.md` — commit แล้ว (9369104, 372e096, 30a0c4f) push แล้ว (2026-10-13)
  - รอผู้ใช้ตอบ: ย้ายการตั้งค่าจากไฟล์ใน Storage ไปตารางในฐานข้อมูล (migration 007) หลังรัน 001–006 หรือไม่ — Claude แนะนำให้ย้าย
- **UI ตาม `UI_FIX_PLAN.md`** — ทำครบแล้วยกเว้นข้อที่รอผู้ใช้ตอบ: C9/Q4 (บังคับเหตุผลเมื่อไม่ผ่าน/ไม่อนุมัติ), A10/Q2 (ตัวเลือกวันที่ไทย), C17/Q1 (หน้าภาคเรียน/ชั้นปีเป็นข้อมูลปลอม)
  - โครงหน้าใหม่: `components/shell/` (NavContext, RoleShell, Page) — หน้าไม่ต้องวาด sidebar เอง ใช้ `PageContainer`/`PageHeader`; ตารางใช้การ์ดบนจอเล็ก (LeaveTable/บุคลากร < xl, CRUD < md)
  - ตรวจด้วย `npm run test:ui` (Playwright, ต้องเปิด `npx next start -p 3100`, ใช้เวลา ~15 นาที)
  - เดโมให้ผู้ใช้ดู: `npm run test:demo` (Playwright เปิดหน้าต่างจริง คลิกครบวงจร ยื่นลา→ธุรการ→ผอ.→วิชาการ→มือถือ 25 ขั้น, วิดีโอ+รายงาน `tests/ui/demo-output/report.html`) — ผ่าน 38/38 (2026-10-14: เพิ่มขั้นวิชาการ "เปลี่ยนครูสอนแทน" + ผู้ดูแล 9 ขั้น: ตั้งค่าระบบ/ย้อนกลับ/ตารางสอนแบบใหม่ — สำรอง/คืนการตั้งค่าจริงให้เอง); `DEMO_HEADLESS=1` ไม่เปิดหน้าต่าง, `--cleanup` ล้างข้อมูลค้าง
0. **รอผู้ใช้** (โค้ดแก้ครบแล้ว 2026-10-13):
   - ตัดสินใจเรื่องข้อมูลจริงที่ผิด (ยังไม่แตะ): ใบ #80/#81 total_day เกิน (นับวันหยุด 15 ต.ค.) + ทับกัน, ใบทับกัน 49 คู่, #46/#47/#77 ไม่มีผู้อนุมัติ, สอนแทน #1 แถวขยะ, บัญชีปิดใช้งาน 1 คนยังไม่ ban ที่ Auth
   - นโยบาย: ให้ตรวจ/อนุมัติใบลาของตัวเองได้หรือไม่ (MR-01/02)
   - รันเทสด้วย admin จริงเอง (ดูคำสั่งใน TEST_REPORT.md) และเปลี่ยนรหัส admin
   - หลังทำแต่ละอย่าง: `npm run build`, `npx next start -p 3100`, `npm run test:e2e`
1. **รอผู้ใช้ส่ง log `[perf]`** จาก terminal (เปิด `npm run dev` หรือ `PERF_LOG=1 npm start` แล้วกดหน้าที่ช้า) → อ่านแล้วแก้จุดที่ช้าที่สุด
   - `auth.*` สูง = เชื่อม Supabase ช้า / `db.*` สูง = ควรรัน migration 004 (index) / `google.calendar` = API วันหยุด / `storage.signUrls` = ลิงก์ไฟล์แนบ
2. ~~migration~~ **รันครบแล้ว 2026-10-13** (001, 002, 005, 004, 006, 003 — RLS เปิดแล้ว, SEC ผ่านทั้ง 7) — ถ้ามีเว็บจริงที่ deploy จาก `main` (โค้ดเก่า) ต้อง deploy โค้ดใหม่ เพราะโค้ดเก่าอ่าน DB ด้วย session ผู้ใช้
3. ไม่ใช้ Google service account แล้ว — ผู้ใช้ควรลบคีย์เดิมใน Google Cloud (เคยถูก commit ใน `first commit`) และลบไฟล์ `.service-account-key.json`
4. ยังไม่มีเว็บจริง (ผู้ใช้ยืนยัน 2026-10-13) — ไม่ต้อง deploy; ก่อน merge เข้า main ต้องดู `origin/main` (1af987c) ที่มี commit ที่ local main ไม่มี
5. (ทางเลือก) หน้า `semester-management`, `year-management` ยังเป็นข้อมูลจำลอง ไม่มีตารางใน DB รองรับ

## ประวัติงาน

### 2026-10-14
- เดโม Playwright แบบเปิดหน้าต่างให้ผู้ใช้ดู 38/38, unit 110/110, E2E PASS 232 / FAIL 5 (ข้อมูลเก่า), UI audit 87/87
- แก้เทส LTA-05/09 ให้ข้ามวันหยุด (15 ต.ค. เป็นวันหยุดโรงเรียน → NO_WORKING_DAYS)
- ข้อควรระวัง: อย่าหยุดสคริปต์ audit/demo กลางทาง — ข้อมูลทดสอบจะค้างจนกว่าจะรันรอบถัดไป (ทำให้ DI-10/DI-13 ไม่ผ่านชั่วคราว)

### 2026-10-13 (ต่อ)
- UI ที่เหลือ: C15 ยกเลิก/เปลี่ยนครูสอนแทน (`cancelSubstitute`, `DELETE /api/academic/substitutions/[id]`), B6 `ConfirmProvider`/`useConfirm` ใน root layout, C18 ตารางสอนในหน้าแทน dialog, C7 แก้ไขแนบหลายไฟล์, B10 usePagedQuery ยิงครั้งเดียว, แก้กระพริบ PlanSubstituteModal — E2E PASS 232 / FAIL 5 (ข้อมูลเก่า)
- UI audit ทั้งระบบหลังเปิด RLS: 87/87 ไม่มีปัญหา
- ผู้ใช้รัน migration ครบ (Claude ตรวจข้อมูลก่อน: ไม่มีข้อมูลซ้ำ/กำพร้า; แก้ 004 ให้รันซ้ำได้) → E2E PASS 231 / FAIL 5 (เหลือ DI ข้อมูลเก่าเท่านั้น); แก้ SET-08 ให้รองรับระบบที่มีโลโก้จริง
- ตั้งค่าระบบช่วง 3–4: `PeriodsTab.tsx`, `AttachmentsTab.tsx`; `checkAttachment/acceptOf/describeAttachments/fileKindOf` ใน `settings-schema.ts`; `assertUploads` ตรวจไฟล์ก่อน insert ใบลา; ย้อนกลับหมวดไฟล์แนบปรับ bucket ด้วย; E2E PASS 226 / FAIL 10 (เดิม), settings 30/30, UI audit settings 15/15
- ตั้งค่าระบบช่วง 2 (ประเภทการลา/กฎ) ตรวจครบ: build ใหม่ + E2E PASS 222 / FAIL 10 (เดิม RLS 5 + ข้อมูลเก่า 5), SET+LTA 26/26
- ตาม `bug-report-form-me.md`: ย้อนกลับไม่วน (`revertOf` ใน HistoryEntry, `assertRevertable`, history API ส่ง `blockedReason`), ปุ่มคืนค่าเริ่มต้น (`FactoryResetButton`, `/api/admin/settings/reset`, `resetLeaveTypeRules`), ย้าย afterPeriods/afterAttachments ไป `lib/settings-effects.ts`
- หมายเหตุ: ก่อนรันเทสให้เช็กว่าพอร์ต 3100 ไม่มีเซิร์ฟเวอร์ตัวเก่าค้าง (เคยเจอ build เก่าค้าง)

### 2026-10-12
- อ่านโค้ดทั้งหมด + scope + schema DB (roletype: 1 admin, 2 user, 3 supervisor, 4 director, 5 academic; leavetype 1–7+, `max_leave_day = NULL` = ไม่จำกัด)
- **refactor ทั้งระบบ**
  - ฐานใหม่ใน `lib/`: `http.ts` (`route([ROLE.x], handler)` ห่อทุก API), `roles.ts`, `validate.ts`, `format.ts`, `roleLayout.tsx`, `periods.ts`, `leave/*` (status, days, quota, files, queries, workflow, lists), `services/*` (holidays มี cache, authUsers, schedule), `admin/*`, `client/*` (api, usePagedQuery, useHolidays, useLeaveTypes), `types/db.ts`
  - API ~45 route เขียนใหม่; เพิ่ม `/api/me`, `/api/leave-types`, `/api/admin/holiday`, `/api/director/employees`, `/api/director/employee-quota`
  - UI ยุบของซ้ำ: `AppSidebar`, `LeaveTable`, `LeaveFilters`, `ReviewModal`, `LeaveDetailModal`, `CrudPage`, modal ผู้ใช้ 5 → 2 ไฟล์
  - tsc error 55 → 0, build เดิมพัง → ผ่าน
  - SQL: `supabase/migrations/` 4 ไฟล์ + `supabase/schema.sql`; เขียน `README.md` ใหม่
- พฤติกรรมที่เปลี่ยน: ลบผู้ใช้ที่มีประวัติลาไม่ได้ (ใช้ปิดใช้งาน), ลบกลุ่มสาระที่ยังมีวิชา/ครูไม่ได้, ผอ.สร้างใบลาแทนต้องเลือกจากรายชื่อ + ตรวจโควตา, ลบ Quick-add ในตารางสอน, ลบไฟล์ที่ไม่ใช้ (`/api/test`, `/api/upload`, `supervisor/leave-review`, `signup.tsx` ฯลฯ), เพิ่มฟอนต์ Sarabun ใน `public/fonts`
- สร้าง `package.json` ใหม่ + `npm install`; `.gitignore` เพิ่มไฟล์ลับ; `git rm --cached .service-account-key.json`
- **ความเร็ว**
  - วัดแล้ว: dev mode compile ครั้งแรก 12–20 วิ/หน้า (RAM ว่างน้อย, Defender, OneDrive) — production เร็ว
  - แก้: guard cache บทบาท 15 วิ (`invalidateGuardCache` ตอน admin แก้), header ได้ชื่อจาก server, `next.config.ts` (optimizePackageImports, webpackMemoryOptimizations)
  - ส่งข้อมูลหน้าแรกมากับ HTML (server component `page.tsx` + `XxxClient.tsx`) 8 หน้า + user-management; `usePagedQuery` รับ `initial`
  - มีสำเนาทดสอบที่ `C:\dev\online-leave-project` (มี `.env.local` + คีย์ติดไป ลบได้ถ้าไม่ใช้)

### 2026-10-13
- เพิ่มตัวจับเวลา `lib/perf.ts` (เปิดอัตโนมัติใน dev, production ใช้ `PERF_LOG=1`)
  - API: log `[perf] METHOD path status total=… | …` + header `Server-Timing` (ใน `lib/http.ts`)
  - จุดที่จับ: `auth.getUser`, `auth.roles_db`, `db.leaverequest`, `db.quota`, `db.holiday`, `storage.signUrls`, `auth.listUsers`, `google.calendar`, `search.users`
  - หน้า server component ห่อด้วย `perfPage()` 8 หน้า + `LAYOUT [role]` ใน `lib/roleLayout.tsx`
- ตรวจแล้ว: typecheck / lint / build ผ่าน
- สร้างชุดทดสอบ (ยังไม่แก้โค้ดตามที่ผู้ใช้สั่ง)
  - unit: vitest (`vitest.config.ts`, `tests/unit/*`, alias `server-only` → stub) — `npm run test`
  - E2E: `tests/e2e/run.mjs` ล็อกอินจริงทุกบทบาทกับ Supabase จริง (ผู้ใช้อนุญาตให้สร้างข้อมูล `__test__` แล้วลบ) — `npm run test:e2e`, ล้างค้าง `npm run test:e2e:cleanup`
  - หมายเหตุสคริปต์: id ใน DTO เป็น string; `/api/user/leave-quota` = ทุกประเภท, `/api/user/quota?leaveTypeId=` = ประเภทเดียว; Supabase เก็บอีเมลตัวเล็ก
  - คีย์ Google service account ใช้ไม่ได้แล้ว (`invalid_grant: Invalid JWT Signature`)
  - เพิ่มส่วน 18 ตรวจข้อมูลจริงแบบอ่านอย่างเดียว (DI-01..19) และส่วน 0b ใช้บัญชี admin จริงผ่าน env `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` (ห้ามเขียนรหัสลงไฟล์; Claude ล็อกอินด้วยรหัสจากแชทไม่ได้ — ระบบความปลอดภัยของเครื่องมือบล็อก → ผู้ใช้ต้องรันเอง)
- **แก้โค้ดตามผลเทส** (ผู้ใช้สั่ง "เริ่มแก้เลย"): toInt(null)→fallback + toPosInt ≤ int max; ไม่เชื่อ total_day จาก client (ลบ client_total_day); ตรวจใบลาทับ (OVERLAPPING_LEAVE, ครึ่งเช้า+บ่ายได้) ใน submit/update/director-create; ผอ.สร้างใบลา: ตรวจผู้ใช้มีอยู่/active; approve ไม่ลบหมายเหตุธุรการ; `lib/leave/days.ts` เพิ่ม partOfDay/periodPart/leaveCoversPeriod; schedule: ข้ามวันหยุด+ครึ่งวัน, ครูที่ลาไม่ว่าง, สอนแทนต้องมีใบลาอนุมัติ (NO_APPROVED_LEAVE); CRUD: refs ตรวจก่อนลบ + unique ชื่อ; ตารางสอน: ตรวจประวัติสอนแทนก่อนลบ + error ตามบริบท; http: ซ่อน detail ของ 5xx; holidays: จำ Google ล้มเหลว 10 นาที; ERROR_TH เพิ่มรหัสใหม่; migration 005_fk_restrict
  - ข้อมูลจริงพบ: ใบ #80/#81 นับวันหยุดโรงเรียนเป็นวันลา + ทับกัน, ใบทับกัน 49 คู่, ใบ approved ไม่มีผู้อนุมัติ 3 ใบ, สอนแทน #1 เป็นแถวขยะ, บัญชีปิดใช้งาน 1 คนยังไม่ถูก ban ที่ Auth
- **วันหยุดราชการ:** เลิกใช้ Google Calendar API + service account (คีย์เสีย, และเดิมนับ "วันสำคัญ" เช่น วาเลนไทน์/ตรุษจีน/คริสต์มาสเป็นวันหยุดด้วย) → อ่าน .ics สาธารณะของ Google (ฟรี ไม่ใช้คีย์) `lib/services/holidayIcs.ts` เก็บเฉพาะ DESCRIPTION "วันหยุดนักขัตฤกษ์"; cache 6 ชม./ล้มเหลวจำ 10 นาที; env `HOLIDAY_ICS_URL` เปลี่ยนแหล่งได้; ถอด `googleapis` ออก; Nager.Date ไม่รองรับ TH (ตรวจแล้ว)
- **ตรวจ UI ทั้งระบบ (2026-10-13):** `tests/ui/audit.mjs` (Playwright, 24 หน้า × 3 ขนาดจอ, ลบข้อมูลทดสอบเอง) → ไม่มี JS error แต่เลื่อนซ้อนทุกหน้า (72/72) และล้นแนวนอน 22/72 → แผนแก้ `UI_FIX_PLAN.md` (6 เฟส, ปัญหา ~45 ข้อ)
