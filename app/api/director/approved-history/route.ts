import { route, json } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listApprovedHistory } from "@/lib/leave/lists";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ประวัติการอนุมัติ/ไม่อนุมัติ (?mine=1 เฉพาะที่ ผอ.คนนี้พิจารณา) */
export const GET = route([ROLE.director], async ({ g, url }) => {
  const mine = ["1", "true"].includes((url.searchParams.get("mine") ?? "").toLowerCase());
  return json(await listApprovedHistory(g.user.id, parseFilters(url, { pageSize: 10, maxPageSize: 100 }), mine));
});
