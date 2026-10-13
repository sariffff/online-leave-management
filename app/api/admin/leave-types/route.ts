import { route, json, readJson } from "@/lib/http";
import { createLeaveType, listLeaveTypesFull, usageCounts } from "@/lib/leave/types";
import { actorOf } from "@/lib/settings-actor";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ประเภทการลาทั้งหมด (รวมที่ปิดใช้งาน) + จำนวนใบลาที่ใช้ประเภทนั้น */
export const GET = route([ROLE.admin], async () => {
  const [items, usage] = await Promise.all([listLeaveTypesFull({ includeInactive: true }), usageCounts()]);
  return json({ items: items.map((t) => ({ ...t, usage: usage.get(t.leave_type_id) ?? 0 })) });
});

/** เพิ่มประเภทการลา: ข้อมูลหลัก (leave_type_name, max_leave_day, carry_over_max, note) + กฎ */
export const POST = route([ROLE.admin], async ({ g, req }) => {
  const item = await createLeaveType(await readJson(req), actorOf(g));
  return json({ item }, { status: 201 });
});
