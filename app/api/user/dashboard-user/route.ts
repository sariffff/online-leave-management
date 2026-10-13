import { route, json } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listOwnLeavesInRange } from "@/lib/leave/lists";
import { getFiscalRange } from "@/utils/year";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/**
 * แดชบอร์ดผู้ใช้
 *  โหมดปฏิทิน:   ?year=YYYY&month=MM (ไม่ใส่ month = ทั้งปี)
 *  โหมดปีงบ:     ?fy=YYYY&fmonth=1..12 (1=ต.ค.)
 */
export const GET = route([ROLE.user], async ({ g, url }) => {
  const sp = url.searchParams;
  const fy = Number(sp.get("fy"));
  let range: { start: string; end: string };

  if (Number.isFinite(fy) && fy > 0) {
    const fmonth = Number(sp.get("fmonth"));
    if (fmonth >= 1 && fmonth <= 12) {
      const calMonth = ((fmonth + 8) % 12) + 1; // 1->ต.ค.(10) ... 4->ม.ค.(1) ... 12->ก.ย.(9)
      const calYear = calMonth >= 10 ? fy - 1 : fy;
      range = monthRange(calYear, calMonth);
    } else {
      range = getFiscalRange(fy);
    }
  } else {
    const year = Number(sp.get("year")) || new Date().getUTCFullYear();
    const month = Number(sp.get("month"));
    range = month >= 1 && month <= 12 ? monthRange(year, month) : { start: `${year}-01-01`, end: `${year}-12-31` };
  }

  const page = await listOwnLeavesInRange(g.user.id, parseFilters(url), range.start, range.end);
  return json({ data: page.data });
});
