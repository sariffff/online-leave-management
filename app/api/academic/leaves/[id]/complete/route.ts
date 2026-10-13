import { route, json, HttpError, notFound } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markCovered } from "@/lib/leave/workflow";
import { coverageOf, scheduleForRange, teacherIdOfUser } from "@/lib/services/schedule";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ถ้ามอบหมายสอนแทนครบทุกคาบ → เปลี่ยนสถานะใบลาเป็น covered (ไม่ครบตอบ 409 พร้อมรายการที่ขาด) */
export const PATCH = route<{ id: string }>([ROLE.academic], async ({ params }) => {
  const id = toPosInt(params.id);
  if (!id) throw new HttpError(400, "INVALID_ID");

  const { data, error } = await supabaseAdmin
    .from("leaverequest")
    .select("user_id, date_start, date_end, date_start_type, date_end_type")
    .eq("leave_request_id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!data) throw notFound("REQUEST_NOT_FOUND");

  const teacherId = await teacherIdOfUser(data.user_id as string);
  if (!teacherId) throw new HttpError(400, "NOT_TEACHER");

  const progress = coverageOf(await scheduleForRange(teacherId, data));
  if (!progress.complete) throw new HttpError(409, "NOT_COMPLETE", progress);

  await markCovered(id);
  return json({ ...progress, status: "covered" });
});
