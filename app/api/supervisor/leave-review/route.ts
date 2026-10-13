import { route, json, HttpError, readJson } from "@/lib/http";
import { parseFilters } from "@/lib/leave/queries";
import { listReviewQueue } from "@/lib/leave/lists";
import { reviewLeave } from "@/lib/leave/workflow";
import { cleanStr, toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** คิวใบลาที่รอธุรการตรวจ (ค่าเริ่มต้น status=pending) */
export const GET = route([ROLE.supervisor], async ({ url }) =>
  json(await listReviewQueue(parseFilters(url, { pageSize: 10, maxPageSize: 200 })))
);

/** body: { action: "reviewed" | "fail", payload: { id, note? } } */
export const POST = route([ROLE.supervisor], async ({ g, req }) => {
  const body = await readJson<{ action?: string; payload?: { id?: unknown; note?: unknown } }>(req);
  const id = toPosInt(body.payload?.id);
  const action = body.action;
  if (!id || (action !== "reviewed" && action !== "fail")) throw new HttpError(400, "INVALID_PAYLOAD");

  const row = await reviewLeave(g.user.id, id, action === "fail" ? "failed" : "reviewed", cleanStr(body.payload?.note));
  return json({ ok: true, id: row.leave_request_id, status: row.status, reviewed_at: row.reviewed_at });
});
