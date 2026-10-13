import { route, json, HttpError } from "@/lib/http";
import { UUID_RE } from "@/lib/validate";
import { parseFilters, queryLeaves } from "@/lib/leave/queries";
import { getFiscalRange } from "@/utils/year";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

function monthRange(y: number, m: number) {
  const mm = String(m).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/**
 * ข้อมูลสรุปสำหรับ dashboard ผอ.
 *  ?mode=all|fy|calendar|month &year=&month= &leaveTypeId= &status=approved|rejected|all &mine=1
 */
export const GET = route([ROLE.director], async ({ g, url }) => {
  const sp = url.searchParams;
  const mode = (sp.get("mode") || "all").toLowerCase();
  const year = Number(sp.get("year")) || 0;
  const month = Number(sp.get("month")) || 0;
  const mine = ["1", "true"].includes((sp.get("mine") ?? "").toLowerCase());
  const userId = sp.get("userId");
  if (userId && !UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");

  const filters = parseFilters(url);
  filters.fiscalYear = null;
  filters.startDate = null;
  filters.endDate = null;

  if (mode === "fy" && year) {
    const r = getFiscalRange(year);
    filters.startDate = r.start;
    filters.endDate = r.end;
  } else if (mode === "calendar" && year) {
    filters.startDate = `${year}-01-01`;
    filters.endDate = `${year}-12-31`;
  } else if (mode === "month" && year && month) {
    const r = monthRange(year, month);
    filters.startDate = r.start;
    filters.endDate = r.end;
  }

  const s = (sp.get("status") || "all").toLowerCase();
  filters.statuses = s === "approved" ? ["approved", "covered"] : s === "rejected" ? ["rejected"] : ["approved", "covered", "rejected"];

  const page = await queryLeaves({
    filters,
    base: (q) => {
      let r = mine ? q.eq("approved_by", g.user.id) : q;
      if (userId) r = r.eq("user_id", userId);
      return r;
    },
    order: { column: "date_start", ascending: false },
    withEmail: true,
    unpaged: 10000,
  });

  const data = page.data.map((d) => ({ ...d, outcome: d.status_code === "rejected" ? ("rejected" as const) : ("approved" as const) }));

  const byUser = new Map<string, { userId: string; name: string; surname: string; email: string; count: number }>();
  const byType = new Map<string, number>();
  let approved = 0;
  let rejected = 0;
  const years = new Set<number>();
  const monthBucket = new Array<number>(12).fill(0);

  for (const d of data) {
    const u = byUser.get(d.userId);
    if (u) u.count += 1;
    else byUser.set(d.userId, { userId: d.userId, name: d.user.name, surname: d.user.surname, email: d.user.email, count: 1 });
    byType.set(d.leaveType, (byType.get(d.leaveType) ?? 0) + 1);
    if (d.outcome === "approved") approved++;
    else rejected++;

    const y = Number(d.startDate.slice(0, 4));
    const m = Number(d.startDate.slice(5, 7));
    if (y) years.add(y);
    if (year && y === year && m >= 1 && m <= 12) monthBucket[m - 1]++;
  }

  return json({
    data,
    total: page.total,
    summary: {
      byUser: [...byUser.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")),
      byType: [...byType].map(([name, count]) => ({ name, count })),
      byStatus: { approved, rejected },
    },
    yearsInData: [...years].sort((a, b) => a - b),
    monthsInYear: year ? monthBucket.map((count, i) => ({ month: i + 1, count })) : undefined,
    mode,
    year,
    month,
  });
});
