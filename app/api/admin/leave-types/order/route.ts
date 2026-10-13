import { route, json, readJson, HttpError } from "@/lib/http";
import { reorderLeaveTypes } from "@/lib/leave/types";
import { actorOf } from "@/lib/settings-actor";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** เรียงลำดับใหม่: body { ids: [รหัสประเภทตามลำดับที่ต้องการ] } */
export const PUT = route([ROLE.admin], async ({ g, req }) => {
  const body = await readJson<{ ids?: unknown }>(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(toPosInt) : [];
  if (ids.length === 0 || ids.some((x) => x === null)) throw new HttpError(422, "VALIDATION", "รายการลำดับไม่ถูกต้อง");
  await reorderLeaveTypes(ids as number[], actorOf(g));
  return json({ ok: true });
});
