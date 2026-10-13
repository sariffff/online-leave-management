import { route, json } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listOwnLeaves } from "@/lib/leave/lists";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ประวัติการลาของตัวเอง — กรอง/แบ่งหน้าที่ DB */
export const GET = route([ROLE.user], async ({ g, url }) =>
  json(await listOwnLeaves(g.user.id, parseFilters(url, { pageSize: 10, maxPageSize: 100 })))
);
