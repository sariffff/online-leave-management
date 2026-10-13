-- 004: ข้อจำกัดข้อมูลและ index (ทำให้ข้อมูลถูกต้องที่ชั้น DB และ query เร็วขึ้น)
-- *** รันทีละบล็อก ถ้า CREATE UNIQUE INDEX ล้มเหลว แปลว่ามีข้อมูลซ้ำอยู่แล้ว ให้ใช้ query ตรวจด้านบนบล็อกนั้น ***

-- ---------------------------------------------------------------
-- A) ตรวจข้อมูลซ้ำก่อน (ควรได้ผลลัพธ์ว่างทุกข้อ)
-- ---------------------------------------------------------------
-- select user_id, leave_type_id, year, count(*) from public.userleavequota group by 1,2,3 having count(*) > 1;
-- select teaching_schedule_id, date_time, count(*) from public.substituteuserteaching group by 1,2 having count(*) > 1;
-- select user_id, count(*) from public.teacher where user_id is not null group by 1 having count(*) > 1;
-- select user_id, role_type_id, count(*) from public.userrole group by 1,2 having count(*) > 1;
-- select teacher_id, day_of_week, period_number, count(*) from public.teachingschedule
--   where day_of_week is not null and period_number is not null group by 1,2,3 having count(*) > 1;
-- select status, count(*) from public.leaverequest group by 1;   -- ต้องเป็นค่าใน CHECK ด้านล่างเท่านั้น

-- ---------------------------------------------------------------
-- B) Unique: กันข้อมูลซ้ำที่เกิดจากการกดซ้ำ/ยื่นพร้อมกัน
-- ---------------------------------------------------------------
create unique index if not exists ux_userleavequota_user_type_year
  on public.userleavequota (user_id, leave_type_id, year);

create unique index if not exists ux_substitute_ts_datetime
  on public.substituteuserteaching (teaching_schedule_id, date_time);

create unique index if not exists ux_teacher_user
  on public.teacher (user_id) where user_id is not null;

create unique index if not exists ux_userrole_user_role
  on public.userrole (user_id, role_type_id);

create unique index if not exists ux_teachingschedule_slot
  on public.teachingschedule (teacher_id, day_of_week, period_number)
  where day_of_week is not null and period_number is not null;

-- ---------------------------------------------------------------
-- C) สถานะใบลาต้องเป็นค่าที่ระบบรู้จัก
-- ---------------------------------------------------------------
alter table public.leaverequest
  drop constraint if exists chk_leaverequest_status;
alter table public.leaverequest
  add constraint chk_leaverequest_status
  check (status in ('pending','reviewed','failed','approved','rejected','covered','cancelled'))
  not valid;
alter table public.leaverequest validate constraint chk_leaverequest_status;

-- ---------------------------------------------------------------
-- D) ค่าตัวเลขของโควตา: ไม่ให้เป็น NULL และไม่ติดลบ
-- ---------------------------------------------------------------
update public.userleavequota set total_used = 0 where total_used is null;
update public.userleavequota set reserved = 0 where reserved is null;

alter table public.userleavequota alter column total_used set default 0;
alter table public.userleavequota alter column total_used set not null;
alter table public.userleavequota alter column reserved set default 0;
alter table public.userleavequota alter column reserved set not null;
-- total_remaining เป็น NULL ได้ (ประเภทลาที่ไม่จำกัดโควตา เช่น ลากิจกรณีพิเศษ)

alter table public.userleavequota
  add constraint chk_quota_non_negative check (total_used >= 0 and reserved >= 0) not valid;
alter table public.userleavequota validate constraint chk_quota_non_negative;

alter table public.leaverequest
  add constraint chk_leaverequest_dates check (date_end >= date_start) not valid;
alter table public.leaverequest validate constraint chk_leaverequest_dates;

-- ---------------------------------------------------------------
-- E) Index สำหรับ query หลักของระบบ
-- ---------------------------------------------------------------
create index if not exists ix_leaverequest_user_start   on public.leaverequest (user_id, date_start desc);
create index if not exists ix_leaverequest_status_start on public.leaverequest (status, date_start desc);
create index if not exists ix_leaverequest_reviewed_by  on public.leaverequest (reviewed_by) where reviewed_by is not null;
create index if not exists ix_leaverequest_approved_by  on public.leaverequest (approved_by) where approved_by is not null;
create index if not exists ix_substitute_datetime       on public.substituteuserteaching (date_time);
create index if not exists ix_substitute_user           on public.substituteuserteaching (substitute_user_id);
create index if not exists ix_teachingschedule_day_period on public.teachingschedule (day_of_week, period_number);
create index if not exists ix_holiday_date              on public.holiday (holiday_date);
