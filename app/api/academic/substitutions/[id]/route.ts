import { route, json, HttpError } from "@/lib/http";
import { cancelSubstitute } from "@/lib/services/schedule";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ยกเลิกการมอบหมายสอนแทน — ใบลาที่ปิดงานแล้ว (covered) จะกลับเป็น approved ให้มอบหมายใหม่ */
export const DELETE = route<{ id: string }>([ROLE.academic], async ({ params }) => {
  const id = toPosInt(params.id);
  if (!id) throw new HttpError(400, "INVALID_ID");
  return json({ ok: true, ...(await cancelSubstitute(id)) });
});
