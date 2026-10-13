# ระบบจัดการการลาออนไลน์ — โรงเรียนบ้านตาสา

Next.js 15 (App Router) + Supabase (PostgreSQL, Auth, Storage) + Tailwind CSS + shadcn/ui

ระบบแทนการลาแบบกระดาษ: บุคลากรยื่นใบลา → ฝ่ายธุรการตรวจสอบ → ผู้อำนวยการอนุมัติ → ฝ่ายวิชาการจัดครูสอนแทน
พร้อมโควตาวันลารายปีงบประมาณ (1 ต.ค. – 30 ก.ย.) และแดชบอร์ดสถิติ

## เริ่มใช้งาน

ตัวแปรสภาพแวดล้อม (`.env.local`)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | เชื่อม Supabase (เบราว์เซอร์/เซิร์ฟเวอร์) |
| `SUPABASE_SERVICE_ROLE_KEY` | **เซิร์ฟเวอร์เท่านั้น** ใช้ใน `lib/supabaseAdmin.ts` (ข้าม RLS) ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_` |
| `HOLIDAY_ICS_URL` | (ไม่บังคับ) ลิงก์ .ics ของวันหยุดราชการ — ค่าเริ่มต้นคือปฏิทินวันหยุดไทยสาธารณะของ Google (ฟรี ไม่ต้องใช้คีย์) |

> ห้าม commit `.env.local`

วันหยุด = วันหยุดนักขัตฤกษ์จากปฏิทินสาธารณะ (`lib/services/holidayIcs.ts` เก็บเฉพาะ "วันหยุดนักขัตฤกษ์" ข้าม "วันสำคัญ" เช่น วาเลนไทน์/ตรุษจีน) + วันหยุดสถานศึกษาที่ admin เพิ่มในหน้า "จัดการวันหยุด"
ปฏิทินสาธารณะมักยังไม่มีวันหยุดทางจันทรคติของปีถัดไป (มาฆะ/วิสาขะ/อาสาฬหะ/พืชมงคล) จนกว่าจะประกาศ — ถ้าต้องการล่วงหน้าให้เพิ่มเองในหน้าจัดการวันหยุด

ฟอนต์ภาษาไทยสำหรับ PDF อยู่ที่ `public/fonts/Sarabun-*.ttf`

## บทบาท (RBAC)

| บทบาท (`roletype`) | route group | หน้าหลัก |
|---|---|---|
| `admin` (1) | `app/(admin)` | จัดการผู้ใช้, ระดับชั้น, ห้องเรียน, กลุ่มสาระ, รายวิชา, ตารางสอน, วันหยุด |
| `user` (2) | `app/(user)` | ยื่นใบลา, ประวัติ, วันลาคงเหลือ, แดชบอร์ดส่วนตัว |
| `supervisor` (3) ธุรการ | `app/(supervisor)` | ตรวจสอบใบลา, ประวัติการตรวจสอบ |
| `director` (4) ผอ. | `app/(director)` | อนุมัติใบลา, สร้างใบลาแทน, ประวัติ, แดชบอร์ด |
| `academic` (5) วิชาการ | `app/(academic)` | จัดครูสอนแทน, ประวัติสอนแทน, ตารางสอน |

การอนุญาตตรวจ **จากฐานข้อมูลทุกครั้ง** ไม่เชื่อ cookie `active_role` (ใช้เพื่อ UI เท่านั้น)
- หน้า: `app/(กลุ่ม)/layout.tsx` → `lib/roleLayout.tsx` → `requireRole`
- API: ทุก route ห่อด้วย `route([ROLE.xxx], handler)` ใน `lib/http.ts` (ตรวจ session, บทบาท, บัญชีที่ถูกปิดใช้งาน และแปลง error เป็น JSON ที่เหมือนกันทั้งระบบ)
- `middleware.ts` ทำหน้าที่ต่ออายุ session และ redirect ผู้ที่ยังไม่ login / ยังไม่เลือกบทบาท เท่านั้น

## ขั้นตอนใบลา

```
pending ──ธุรการตรวจผ่าน──▶ reviewed ──ผอ.อนุมัติ──▶ approved ──วิชาการจัดสอนแทนครบ──▶ covered
   │                           │                          
   └─ไม่ผ่าน─▶ failed          └─ไม่อนุมัติ─▶ rejected
        (ผู้ยื่นแก้ไขแล้วส่งใหม่ → pending)
```

ตรรกะอยู่ที่ `lib/leave/workflow.ts` ทุกการเปลี่ยนสถานะเป็น "update แบบมีเงื่อนไข" (`WHERE status = สถานะเดิม`) กันการกดซ้ำ/แข่งกัน

### โควตา (`lib/leave/quota.ts`)
- แหล่งความจริงเดียวคือตาราง `leaverequest` — ยอดใช้ไป = `approved`+`covered`, ยอดกันไว้ = `pending`+`reviewed`
- `userleavequota` เป็น snapshot ที่ระบบเขียนให้หลังเปลี่ยนสถานะทุกครั้ง (ไม่ต้องแก้ตัวเลขเอง)
- `leavetype.max_leave_day = NULL` หมายถึง **ไม่จำกัดโควตา**
- วันลาสะสม (`carry_over_max`): สิทธิ์ปีนี้ = `max_leave_day` + min(วันที่เหลือจากปีก่อน, `carry_over_max`)
- จำนวนวันลาคำนวณซ้ำที่ server เสมอ (`lib/leave/days.ts`: ตัดเสาร์–อาทิตย์ + วันหยุด + ครึ่งวัน)

## โครงสร้างโค้ด

```
app/
  (admin|user|supervisor|director|academic|auth)/   หน้าจอตามบทบาท
  api/                                              API (ทุกไฟล์ใช้ route([...]))
components/
  shared/      AppSidebar, LeaveTable, LeaveFilters, ReviewModal, LeaveDetailModal, Pagination
  admin/       CrudPage (ใช้ร่วมกันทุกหน้าข้อมูลหลัก), Modals/user
  user|director|academic/  คอมโพเนนต์เฉพาะบทบาท
lib/
  http.ts, guard.ts, roles.ts, validate.ts, format.ts
  leave/       status, days, quota, files, queries, workflow
  services/    holidays (Google Calendar + ตาราง holiday, มี cache), authUsers, schedule
  admin/       crud (โรงงาน route), resources, users
  client/      api (apiFetch), usePagedQuery, useHolidays, useLeaveTypes
supabase/
  schema.sql   snapshot schema   |   migrations/   SQL ที่ต้องรัน (ดูด้านล่าง)
```

## ฐานข้อมูล: migration ที่ต้องรัน (ตามลำดับ)

| ไฟล์ | ทำอะไร |
|---|---|
| `20261012000001_helpers_revoke_anon_storage.sql` | ฟังก์ชัน `has_role`, ถอนสิทธิ์ `anon`, แก้ storage policy, จำกัดไฟล์แนบ 5MB (pdf/jpg/png) |
| `20261012000002_rls_policies.sql` | policy ทุกตาราง (ยังไม่มีผลจนกว่าจะเปิด RLS) |
| `20261012000003_enable_rls.sql` | เปิด RLS — ทดสอบทุกบทบาทหลังเปิด |
| `20261012000004_constraints_and_indexes.sql` | unique/check/index (อ่านคำสั่งตรวจข้อมูลซ้ำในไฟล์ก่อนรัน) |

ฐานข้อมูลเดิมเปิดให้ `anon key` อ่าน/เขียนทุกตารางได้ (RLS ปิด) — ควรรัน 001 และ 003 ก่อนเปิดใช้งานจริง

## หมายเหตุ

- หน้า `semester-management` และ `year-management` ยังเป็นข้อมูลจำลอง (ยังไม่มีตารางรองรับใน schema)
- วันหยุดราชการดึงจาก Google Calendar อัตโนมัติ ส่วนวันหยุดสถานศึกษาเพิ่มได้ที่หน้า "จัดการวันหยุด" (ตาราง `holiday`)
