-- 006: ให้ sequence ของรหัสประเภทการลาตามทันข้อมูลเดิม
-- ที่มา: ประเภทการลา 1–11 ถูกใส่รหัสเองตอนตั้งระบบ sequence จึงยังเริ่มที่ 1 → เพิ่มประเภทใหม่จากหน้าตั้งค่าชน primary key
-- (แอปมีทางสำรองอยู่แล้ว: ลองใหม่ด้วยรหัสสูงสุด + 1 — ไฟล์นี้แก้ถาวร) · รันซ้ำได้
select setval(
  pg_get_serial_sequence('public.leavetype', 'leave_type_id'),
  greatest((select coalesce(max(leave_type_id), 0) from public.leavetype), 1)
);
