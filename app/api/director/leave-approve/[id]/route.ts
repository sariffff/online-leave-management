import { route, json, HttpError } from "@/lib/http";
import { directorDeleteReviewed } from "@/lib/leave/workflow";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ผอ.ลบใบลาที่ธุรการตรวจแล้ว (ยังไม่อนุมัติ) */
export const DELETE = route<{ id: string }>([ROLE.director], async ({ params }) => {
  const id = toPosInt(params.id);
  if (!id) throw new HttpError(400, "INVALID_ID");
  await directorDeleteReviewed(id);
  return json({ ok: true, id });
});
