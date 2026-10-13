import { route, json } from "@/lib/http";
import { computeQuota } from "@/lib/leave/quota";
import { normalizeFiscalYear } from "@/lib/format";
import { getFiscalYearFromISO } from "@/utils/year";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** สรุปสิทธิ์ลาทุกประเภทของปีงบที่เลือก (ค.ศ. หรือ พ.ศ.) */
export const GET = route([ROLE.user], async ({ g, url }) => {
  const fiscalYear =
    normalizeFiscalYear(url.searchParams.get("year")) ?? getFiscalYearFromISO(new Date().toISOString().slice(0, 10));
  const items = await computeQuota(g.user.id, fiscalYear);
  return json({ ok: true, userId: g.user.id, year: fiscalYear, items });
});
