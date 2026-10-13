import { route, json } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listReviewedHistory } from "@/lib/leave/lists";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ประวัติใบลาที่ "ฉัน" เป็นผู้ตรวจ — กรอง/แบ่งหน้าที่ DB พร้อมไฟล์แนบในคำขอเดียว */
export const GET = route([ROLE.supervisor], async ({ g, url }) =>
  json(await listReviewedHistory(g.user.id, parseFilters(url, { pageSize: 10, maxPageSize: 100 })))
);
