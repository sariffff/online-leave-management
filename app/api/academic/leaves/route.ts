import { route, json } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listAcademicLeaves } from "@/lib/leave/lists";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ใบลาของ "ครู" ที่อนุมัติแล้ว (approved/covered) เพื่อจัดสอนแทน */
export const GET = route([ROLE.academic], async ({ url }) =>
  json(await listAcademicLeaves(parseFilters(url, { pageSize: 10, maxPageSize: 100 })))
);
