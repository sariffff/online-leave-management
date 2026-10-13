import { route, json, HttpError, readJson } from "@/lib/http";
import { directorCreateLeave } from "@/lib/leave/workflow";
import { findUserIdByEmail } from "@/lib/services/authUsers";
import { cleanStr, toPosInt, UUID_RE } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ผอ.สร้างใบลาแทนบุคลากร (อนุมัติทันที) — ระบุ user_id หรือ employeeEmail */
export const POST = route([ROLE.director], async ({ g, req }) => {
  const b = await readJson<Record<string, unknown>>(req);

  let userId = cleanStr(b.user_id, 64);
  if (!userId) {
    const email = cleanStr(b.employeeEmail, 254).toLowerCase();
    if (!email) throw new HttpError(400, "INVALID_PAYLOAD");
    userId = (await findUserIdByEmail(email)) ?? "";
    if (!userId) throw new HttpError(404, "USER_NOT_FOUND_BY_EMAIL");
  }
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");

  const leaveTypeId = toPosInt(b.leave_type_id);
  const dateStart = cleanStr(b.date_start, 10);
  const dateEnd = cleanStr(b.date_end, 10);
  if (!leaveTypeId || !dateStart || !dateEnd) throw new HttpError(400, "INVALID_PAYLOAD");

  const result = await directorCreateLeave(g.user.id, {
    user_id: userId,
    leave_type_id: leaveTypeId,
    date_start: dateStart,
    date_end: dateEnd,
    date_start_type: cleanStr(b.date_start_type, 20),
    date_end_type: cleanStr(b.date_end_type, 20),
    reason: cleanStr(b.reason) || null,
  });

  return json({ ok: true, user_id: userId, ...result }, { status: 201 });
});
