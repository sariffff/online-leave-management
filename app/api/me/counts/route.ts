import { route, json, HttpError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hasRole } from "@/lib/guard";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

async function countStatus(status: string, userIds?: string[]) {
  let q = supabaseAdmin.from("leaverequest").select("leave_request_id", { count: "exact", head: true }).eq("status", status);
  if (userIds) q = q.in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const { count, error } = await q;
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  return count ?? 0;
}

/**
 * จำนวนงานที่รอของผู้ใช้ (ตัวเลขบน sidebar) — นับเฉพาะบทบาทที่ผู้ใช้มี และไม่ขึ้นกับตัวกรองของหน้าใด
 *  review = รอธุรการตรวจ, approve = รอ ผอ.อนุมัติ, cover = อนุมัติแล้วของครู รอจัดสอนแทน
 */
export const GET = route("any", async ({ g }) => {
  const [review, approve, cover] = await Promise.all([
    hasRole(g, ROLE.supervisor) ? countStatus("pending") : null,
    hasRole(g, ROLE.director) ? countStatus("reviewed") : null,
    hasRole(g, ROLE.academic)
      ? supabaseAdmin
          .from("teacher")
          .select("user_id")
          .then(({ data, error }) => {
            if (error) throw new HttpError(500, "DB_ERROR", error.message);
            return countStatus("approved", (data ?? []).map((t) => t.user_id as string).filter(Boolean));
          })
      : null,
  ]);
  return json({ review, approve, cover }, { headers: { "Cache-Control": "no-store" } });
});
