import { route, json, readJson, HttpError } from "@/lib/http";
import { deleteLeaveType, updateLeaveType } from "@/lib/leave/types";
import { actorOf } from "@/lib/settings-actor";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

const idOf = (p: { id: string }) => {
  const id = toPosInt(p.id);
  if (!id) throw new HttpError(400, "INVALID_ID");
  return id;
};

/** แก้ไข (ส่งเฉพาะฟิลด์ที่เปลี่ยน) — ปิดใช้งาน = { isActive: false } */
export const PATCH = route<{ id: string }>([ROLE.admin], async ({ g, req, params }) =>
  json({ item: await updateLeaveType(idOf(params), await readJson(req), actorOf(g)) })
);

/** ลบได้เฉพาะประเภทที่ยังไม่มีใบลา (มีแล้วตอบ 409 ให้ปิดใช้งานแทน) */
export const DELETE = route<{ id: string }>([ROLE.admin], async ({ g, params }) => {
  await deleteLeaveType(idOf(params), actorOf(g));
  return json({ ok: true });
});
