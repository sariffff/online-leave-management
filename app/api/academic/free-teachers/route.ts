import { route, json, HttpError } from "@/lib/http";
import { freeTeachers } from "@/lib/services/schedule";
import { isISODate, toInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ครูที่ว่างในวัน/คาบที่กำหนด แยกกลุ่มสาระเดียวกัน (data1) และต่างกลุ่ม (data2) */
export const GET = route([ROLE.academic], async ({ url }) => {
  const sp = url.searchParams;
  const date = sp.get("date") ?? "";
  const period = toInt(sp.get("period"), 0, 0, 20);
  if (!isISODate(date)) throw new HttpError(400, "INVALID_DATE");
  if (period < 1 || period > 7) throw new HttpError(400, "INVALID_PERIOD");

  const sg = sp.get("subjectGroup");
  const result = await freeTeachers({
    date,
    period,
    excludeUserId: sp.get("excludeUserId") || undefined,
    subjectGroupId: sg !== null && sg !== "" && Number.isFinite(Number(sg)) ? Number(sg) : null,
  });

  return json({
    data1: result.sameGroup,
    data2: result.otherGroups,
    data1Count: result.sameGroup.length,
    data2Count: result.otherGroups.length,
    resolvedSubjectGroup: result.resolvedSubjectGroup,
  });
});
