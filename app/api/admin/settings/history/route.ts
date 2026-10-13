import { route, json } from "@/lib/http";
import { getHistory, revertBlockReason } from "@/lib/settings";
import { toInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ประวัติการแก้ไขการตั้งค่า (ใหม่สุดก่อน) — blockedReason = เหตุที่ย้อนกลับไม่ได้ (null = ย้อนกลับได้) */
export const GET = route([ROLE.admin], async ({ url }) => {
  const sp = url.searchParams;
  const page = toInt(sp.get("page"), 1, 1, 1000);
  const pageSize = toInt(sp.get("pageSize"), 20, 1, 100);
  const all = await getHistory();
  const start = (page - 1) * pageSize;
  const data = all.slice(start, start + pageSize).map((h) => ({ ...h, blockedReason: revertBlockReason(h, all) }));
  return json({ data, total: all.length, page, pageSize, totalPages: Math.max(1, Math.ceil(all.length / pageSize)) });
});
