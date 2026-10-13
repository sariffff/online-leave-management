import { route, json, HttpError } from "@/lib/http";
import { computeQuota } from "@/lib/leave/quota";
import { normalizeFiscalYear } from "@/lib/format";
import { toPosInt } from "@/lib/validate";
import { getFiscalYearFromISO } from "@/utils/year";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** สิทธิ์คงเหลือของประเภทลาเดียว (ใช้ในฟอร์มยื่นลา) */
export const GET = route([ROLE.user], async ({ g, url }) => {
  const leaveTypeId = toPosInt(url.searchParams.get("leaveTypeId"));
  if (!leaveTypeId) throw new HttpError(400, "LEAVETYPE_REQUIRED");

  const fiscalYear =
    normalizeFiscalYear(url.searchParams.get("fiscalYear")) ??
    getFiscalYearFromISO(new Date().toISOString().slice(0, 10));
  const item = (await computeQuota(g.user.id, fiscalYear)).find((i) => i.leave_type_id === leaveTypeId);
  if (!item) throw new HttpError(404, "LEAVETYPE_NOT_FOUND");

  return json({ item, fiscalYear });
});
