import { route, json, HttpError, readJson } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listApproveQueue } from "@/lib/leave/lists";
import { approveLeave } from "@/lib/leave/workflow";
import { cleanStr, toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** คิวใบลาที่รอ ผอ. อนุมัติ (ค่าเริ่มต้น status=reviewed) */
export const GET = route([ROLE.director], async ({ url }) =>
  json(await listApproveQueue(parseFilters(url, { pageSize: 10, maxPageSize: 200 })))
);

/** body: { action: "approved" | "rejected", payload: { id, note? } } */
export const POST = route([ROLE.director], async ({ g, req }) => {
  const body = await readJson<{ action?: string; payload?: { id?: unknown; note?: unknown } }>(req);
  const id = toPosInt(body.payload?.id);
  const action = body.action;
  if (!id || (action !== "approved" && action !== "rejected")) throw new HttpError(400, "INVALID_PAYLOAD");

  const row = await approveLeave(g.user.id, id, action, cleanStr(body.payload?.note));
  return json({ ok: true, id: row.leave_request_id, status: row.status, year: row.year });
});
