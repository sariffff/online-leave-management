import { route, json, HttpError } from "@/lib/http";
import { getHolidays } from "@/lib/services/holidays";
import { getFiscalRange } from "@/utils/year";
import { isISODate } from "@/lib/validate";

export const runtime = "nodejs";

function monthRange(y: number, m: number) {
  const mm = String(m).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/**
 * วันหยุด (ราชการจาก Google Calendar + สถานศึกษาจากตาราง holiday)
 *  ?month=YYYY-MM | ?year=YYYY | ?fiscal=YYYY | ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const GET = route("any", async ({ url }) => {
  const sp = url.searchParams;
  let range: { start: string; end: string };

  const month = sp.get("month");
  const year = sp.get("year");
  const fiscal = sp.get("fiscal");
  const start = sp.get("start");
  const end = sp.get("end");

  if (month) {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new HttpError(400, "INVALID_MONTH");
    range = monthRange(Number(m[1]), Number(m[2]));
  } else if (year) {
    if (!/^\d{4}$/.test(year)) throw new HttpError(400, "INVALID_YEAR");
    range = { start: `${year}-01-01`, end: `${year}-12-31` };
  } else if (fiscal) {
    if (!/^\d{4}$/.test(fiscal)) throw new HttpError(400, "INVALID_FISCAL");
    range = getFiscalRange(Number(fiscal));
  } else if (start || end) {
    if (!isISODate(start) || !isISODate(end) || start > end) throw new HttpError(400, "INVALID_RANGE");
    range = { start, end };
  } else {
    const now = new Date();
    range = monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }

  const { items, degraded } = await getHolidays(range.start, range.end);
  return json(
    { start: range.start, end: range.end, holidays: items, degraded },
    { headers: { "Cache-Control": degraded ? "no-store" : "private, max-age=3600" } }
  );
});
