-- 002: สร้าง policy ทั้งหมด (ยังไม่มีผลจนกว่าจะเปิด RLS ใน 003 จึงรันได้ก่อน)
-- บทบาท: admin, user, supervisor(ธุรการ), director(ผอ.), academic(วิชาการ)
-- service role (supabaseAdmin) ข้าม RLS อยู่แล้ว

-- ===============================================================
-- ตารางอ้างอิง: ผู้ที่ login อ่านได้ / admin เขียนได้
-- ===============================================================
do $$
declare t text;
begin
  foreach t in array array['level','subjectgroup','subject','classroom','leavetype','roletype','holiday']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(''admin'')) with check (public.has_role(''admin''))',
      t || '_admin_write', t);
  end loop;
end $$;

-- ===============================================================
-- users
-- ===============================================================
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
using (
  user_id = auth.uid()
  or public.has_any_role(array['admin','supervisor','director','academic'])
);

drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for all to authenticated
using (public.has_role('admin')) with check (public.has_role('admin'));

-- ===============================================================
-- userrole  (guard.ts อ่านบทบาทของตัวเอง)
-- ===============================================================
drop policy if exists userrole_select on public.userrole;
create policy userrole_select on public.userrole for select to authenticated
using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists userrole_admin_write on public.userrole;
create policy userrole_admin_write on public.userrole for all to authenticated
using (public.has_role('admin')) with check (public.has_role('admin'));

-- ===============================================================
-- teacher / teachingschedule / substituteuserteaching
-- ===============================================================
drop policy if exists teacher_select on public.teacher;
create policy teacher_select on public.teacher for select to authenticated
using (
  user_id = auth.uid()
  or public.has_any_role(array['admin','academic','supervisor','director'])
);
drop policy if exists teacher_admin_write on public.teacher;
create policy teacher_admin_write on public.teacher for all to authenticated
using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists ts_select on public.teachingschedule;
create policy ts_select on public.teachingschedule for select to authenticated
using (
  public.has_any_role(array['admin','academic'])
  or teacher_id in (select t.teacher_id from public.teacher t where t.user_id = auth.uid())
);
drop policy if exists ts_admin_write on public.teachingschedule;
create policy ts_admin_write on public.teachingschedule for all to authenticated
using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists sub_select on public.substituteuserteaching;
create policy sub_select on public.substituteuserteaching for select to authenticated
using (
  public.has_any_role(array['admin','academic'])
  or substitute_user_id = auth.uid()
);
drop policy if exists sub_write on public.substituteuserteaching;
create policy sub_write on public.substituteuserteaching for all to authenticated
using (public.has_any_role(array['admin','academic']))
with check (public.has_any_role(array['admin','academic']));

-- ===============================================================
-- userleavequota: อ่านได้ ส่วนการเขียนทำผ่าน service role / RPC เท่านั้น
-- ===============================================================
drop policy if exists uq_select on public.userleavequota;
create policy uq_select on public.userleavequota for select to authenticated
using (
  user_id = auth.uid()
  or public.has_any_role(array['admin','supervisor','director'])
);

-- ===============================================================
-- leaverequest  (ตาม flow: pending -> reviewed/failed -> approved/rejected -> covered)
-- ===============================================================
-- อ่าน
drop policy if exists lr_select_own on public.leaverequest;
create policy lr_select_own on public.leaverequest for select to authenticated
using (user_id = auth.uid());

drop policy if exists lr_select_staff on public.leaverequest;
create policy lr_select_staff on public.leaverequest for select to authenticated
using (public.has_any_role(array['admin','supervisor','director']));

drop policy if exists lr_select_academic on public.leaverequest;
create policy lr_select_academic on public.leaverequest for select to authenticated
using (public.has_role('academic') and status in ('approved','covered'));

-- สร้าง: เจ้าของยื่นเอง (pending) หรือ ผอ. สร้างแทน (route director/create-leave)
drop policy if exists lr_insert_own on public.leaverequest;
create policy lr_insert_own on public.leaverequest for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists lr_insert_director on public.leaverequest;
create policy lr_insert_director on public.leaverequest for insert to authenticated
with check (public.has_role('director'));

-- แก้: เจ้าของแก้ได้เฉพาะ pending/failed และสถานะหลังแก้ต้องเป็น pending
drop policy if exists lr_update_owner on public.leaverequest;
create policy lr_update_owner on public.leaverequest for update to authenticated
using (user_id = auth.uid() and status in ('pending','failed'))
with check (user_id = auth.uid() and status = 'pending');

-- ธุรการ: pending -> reviewed | failed
drop policy if exists lr_update_supervisor on public.leaverequest;
create policy lr_update_supervisor on public.leaverequest for update to authenticated
using (public.has_role('supervisor') and status = 'pending')
with check (public.has_role('supervisor') and status in ('reviewed','failed') and reviewed_by = auth.uid());

-- ผอ.: reviewed -> approved | rejected
drop policy if exists lr_update_director on public.leaverequest;
create policy lr_update_director on public.leaverequest for update to authenticated
using (public.has_role('director') and status = 'reviewed')
with check (public.has_role('director') and status in ('approved','rejected') and approved_by = auth.uid());

-- ฝ่ายวิชาการ: approved -> covered
drop policy if exists lr_update_academic on public.leaverequest;
create policy lr_update_academic on public.leaverequest for update to authenticated
using (public.has_role('academic') and status = 'approved')
with check (public.has_role('academic') and status = 'covered');

-- ลบ: เจ้าของลบได้เฉพาะ pending/failed, ผอ. ลบได้เฉพาะ reviewed (ตาม route เดิม)
drop policy if exists lr_delete_owner on public.leaverequest;
create policy lr_delete_owner on public.leaverequest for delete to authenticated
using (user_id = auth.uid() and status in ('pending','failed'));

drop policy if exists lr_delete_director on public.leaverequest;
create policy lr_delete_director on public.leaverequest for delete to authenticated
using (public.has_role('director') and status = 'reviewed');

-- หมายเหตุ: RLS จำกัดระดับคอลัมน์ไม่ได้ (เช่น เจ้าของยังแก้ total_day/reason ได้ ซึ่งเป็น
-- พฤติกรรมที่ต้องการ แต่ควรเพิ่ม trigger ห้ามเจ้าของแก้ reviewed_by/approved_by/comment)
