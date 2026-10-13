-- 005: เปลี่ยน foreign key ที่ฐานข้อมูลจริงตั้งเป็น ON DELETE CASCADE ให้เป็น RESTRICT
-- ที่มา: ผลทดสอบ 2026-10-13 (CR-level-6) — ลบ "ระดับชั้น" 1 แถว แล้วห้องเรียน รายวิชา และคาบสอนที่ใช้มันถูกลบตามไปหมด
-- ทั้งที่ supabase/schema.sql ไม่มี CASCADE → ค่าในฐานข้อมูลจริงไม่ตรงกับไฟล์ schema
--
-- สคริปต์นี้หา constraint จริงจาก pg_constraint ตามตาราง/คอลัมน์ (ไม่พึ่งชื่อ) ลบทิ้ง แล้วสร้างใหม่แบบ ON DELETE RESTRICT
-- รันซ้ำได้ (idempotent) — แอปตรวจ "ยังถูกใช้งานอยู่" ก่อนลบอยู่แล้ว ไฟล์นี้กันอีกชั้นที่ระดับฐานข้อมูล
--
-- ก่อนรัน: ดูค่าปัจจุบันด้วย query ท้ายไฟล์ (ส่วน "ตรวจสอบ") ได้

begin;

do $$
declare
  fk record;
  r record;
begin
  for fk in
    select * from (values
      ('classroom',              'classroom_level',      'level',             'level_id'),
      ('subject',                'subject_level_id',     'level',             'level_id'),
      ('subject',                'subject_group_id',     'subjectgroup',      'subject_group_id'),
      ('teacher',                'subject_group_id',     'subjectgroup',      'subject_group_id'),
      ('teacher',                'user_id',              'users',             'user_id'),
      ('teachingschedule',       'subject_id',           'subject',           'subject_id'),
      ('teachingschedule',       'classroom_id',         'classroom',         'classroom_id'),
      ('teachingschedule',       'teacher_id',           'teacher',           'teacher_id'),
      ('substituteuserteaching', 'teaching_schedule_id', 'teachingschedule',  'teaching_schedule_id'),
      ('substituteuserteaching', 'substitute_user_id',   'users',             'user_id'),
      ('leaverequest',           'user_id',              'users',             'user_id'),
      ('leaverequest',           'leave_type_id',        'leavetype',         'leave_type_id'),
      ('userrole',               'user_id',              'users',             'user_id'),
      ('userleavequota',         'user_id',              'users',             'user_id')
    ) as t(tbl, col, ref_tbl, ref_col)
  loop
    -- ลบ FK ทุกตัวที่ผูกคอลัมน์นี้ (ชื่ออะไรก็ได้)
    for r in
      select c.conname
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and n.nspname = 'public' and rel.relname = fk.tbl and a.attname = fk.col
    loop
      execute format('alter table public.%I drop constraint %I', fk.tbl, r.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete restrict',
      fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref_tbl, fk.ref_col
    );
  end loop;
end $$;

commit;

-- ตรวจสอบ: ต้องไม่มีแถวที่ delete_rule = 'CASCADE'
-- select tc.table_name, kcu.column_name, rc.delete_rule
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
-- join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
-- where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
-- order by 1, 2;
