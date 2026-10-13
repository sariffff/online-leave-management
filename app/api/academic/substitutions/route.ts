import { route, json, HttpError, readJson } from "@/lib/http";
import { assignSubstitute } from "@/lib/services/schedule";
import { cleanStr, toPosInt, UUID_RE } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** body: { teachingScheduleId, dateISO: "YYYY-MM-DD", substituteUserId } */
export const POST = route([ROLE.academic], async ({ req }) => {
  const b = await readJson<Record<string, unknown>>(req);
  const teachingScheduleId = toPosInt(b.teachingScheduleId);
  const substituteUserId = cleanStr(b.substituteUserId, 64);
  if (!teachingScheduleId || !UUID_RE.test(substituteUserId)) throw new HttpError(400, "INVALID_PAYLOAD");

  const data = await assignSubstitute({ teachingScheduleId, dateISO: cleanStr(b.dateISO, 10), substituteUserId });
  return json({ data }, { status: 201 });
});
