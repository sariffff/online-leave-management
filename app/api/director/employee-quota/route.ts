import { route, json, HttpError } from "@/lib/http";
import { computeQuota } from "@/lib/leave/quota";
import { quotaForDisplay } from "@/lib/leave/types";
import { normalizeFiscalYear } from "@/lib/format";
import { getFiscalYearFromISO } from "@/utils/year";
import { UUID_RE } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** สิทธิ์การลาของบุคลากรรายคน (ให้ ผอ. ดูในหน้ารายละเอียดบุคลากร) */
export const GET = route([ROLE.director], async ({ url }) => {
  const userId = url.searchParams.get("userId") ?? "";
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");
  const fiscalYear =
    normalizeFiscalYear(url.searchParams.get("year")) ?? getFiscalYearFromISO(new Date().toISOString().slice(0, 10));
  return json({ year: fiscalYear, items: await quotaForDisplay(await computeQuota(userId, fiscalYear)) });
});
