import { route, json, HttpError } from "@/lib/http";
import { getHistoryEntry, revertHistory } from "@/lib/settings";
import { revertLeaveTypeEntry } from "@/lib/leave/types";
import { actorOf } from "@/lib/settings-actor";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ย้อนกลับเป็นค่าก่อนการแก้ไขรายการนี้ (การย้อนกลับก็ถูกบันทึกเป็นประวัติใหม่) */
export const POST = route<{ id: string }>([ROLE.admin], async ({ g, params }) => {
  const entry = await getHistoryEntry(params.id);
  if (!entry) throw new HttpError(404, "HISTORY_NOT_FOUND");
  // ประเภทการลาแตะทั้งตาราง leavetype และการตั้งค่า จึงย้อนผ่าน service ของมันเอง
  if (entry.section === "leaveTypes") await revertLeaveTypeEntry(entry, actorOf(g));
  else await revertHistory(params.id, actorOf(g));
  return json({ ok: true });
});
