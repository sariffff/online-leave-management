-- 001: ปลอดภัยที่จะรันก่อนแก้โค้ด (ไม่ทำให้แอปพัง)
--  - สร้างฟังก์ชันตรวจบทบาท
--  - ถอนสิทธิ์ตารางจาก anon (แอปต้อง login ก่อนใช้งานทุกหน้าอยู่แล้ว)
--  - แก้ Storage policy + จำกัดชนิด/ขนาดไฟล์
-- ยังไม่ได้เปิด RLS ในไฟล์นี้ (ดู 003)

-- ---------------------------------------------------------------
-- 1) ฟังก์ชันช่วย (security definer เพื่อไม่ให้ policy วนเรียกตัวเอง)
-- ---------------------------------------------------------------
create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.userrole ur
    join public.roletype rt on rt.role_type_id = ur.role_type_id
    where ur.user_id = auth.uid()
      and rt.role_name = p_role
  );
$$;

create or replace function public.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.userrole ur
    join public.roletype rt on rt.role_type_id = ur.role_type_id
    where ur.user_id = auth.uid()
      and rt.role_name = any (p_roles)
  );
$$;

revoke execute on function public.has_role(text) from public, anon;
revoke execute on function public.has_any_role(text[]) from public, anon;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_any_role(text[]) to authenticated;

-- ---------------------------------------------------------------
-- 2) ถอนสิทธิ์ anon ทั้งหมดใน schema public
-- ---------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------
-- 3) Storage: bucket leave-attachments
-- ---------------------------------------------------------------
-- 3.1 ลบ policy ที่อนุญาตให้ผู้ใช้ที่ login แล้วทุกคนเขียนไฟล์ลง path ไหนก็ได้
drop policy if exists "Insert wv6rve_0" on storage.objects;

-- 3.2 จำกัดขนาด 5MB และชนิดไฟล์ตามที่ฟอร์มรองรับ
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'leave-attachments';

-- 3.3 ให้ฝ่ายที่เกี่ยวข้องอ่านไฟล์แนบของคนอื่นได้ (ฝ่ายวิชาการเปิดไฟล์ด้วย session ปกติ)
drop policy if exists "staff read leave attachments" on storage.objects;
create policy "staff read leave attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'leave-attachments'
  and public.has_any_role(array['admin', 'supervisor', 'director', 'academic'])
);
