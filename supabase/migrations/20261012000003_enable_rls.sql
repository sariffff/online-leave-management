-- 003: เปิด RLS
-- โค้ดแอปหลัง refactor เรียกฐานข้อมูลด้วย service role (supabaseAdmin) หลังตรวจบทบาทใน API route ทุกครั้ง
-- ดังนั้นการเปิด RLS "ไม่กระทบการทำงานของแอป" — RLS มีไว้กันการเรียก REST/Realtime ตรง ๆ ด้วย anon key
-- หรือ session ของผู้ใช้คนอื่น (ซึ่งเป็นช่องโหว่ใหญ่ที่สุดของระบบเดิม)
--
-- สิ่งเดียวที่ยังอ่านตารางด้วย session ของผู้ใช้คือ lib/guard.ts และหน้า select-role:
--   userrole (ของตัวเอง), roletype, users (ของตัวเอง)  → policy ใน 002 อนุญาตไว้แล้ว
--
-- ลำดับแนะนำ: รัน 001 → 002 → deploy โค้ดใหม่ → รันไฟล์นี้ทีละกลุ่มแล้วทดสอบทุกบทบาท
-- ย้อนกลับกลุ่มไหน: alter table public.<ชื่อ> disable row level security;

-- กลุ่ม A: ตารางอ้างอิง
alter table public.level          enable row level security;
alter table public.subjectgroup   enable row level security;
alter table public.subject        enable row level security;
alter table public.classroom      enable row level security;
alter table public.leavetype      enable row level security;
alter table public.roletype       enable row level security;
alter table public.holiday        enable row level security;

-- กลุ่ม B: ผู้ใช้/บทบาท/ครู/ตารางสอน
alter table public.users          enable row level security;
alter table public.userrole       enable row level security;
alter table public.teacher        enable row level security;
alter table public.teachingschedule        enable row level security;
alter table public.substituteuserteaching  enable row level security;

-- กลุ่ม C: ใบลาและโควตา
alter table public.leaverequest   enable row level security;
alter table public.userleavequota enable row level security;
