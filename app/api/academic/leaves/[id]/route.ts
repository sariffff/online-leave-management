import { route, json, HttpError, notFound } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LEAVE_SELECT, toDTO, type LeaveJoined } from "@/lib/leave/queries";
import { signFiles } from "@/lib/leave/files";
import { coverageOf, scheduleForRange } from "@/lib/services/schedule";
import { getAuthUserMap } from "@/lib/services/authUsers";
import { toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/**
 * รายละเอียดใบลา + ตารางสอนตามช่วงวันลา + ความคืบหน้าการมอบหมายสอนแทน
 * (รวมสิ่งที่เดิมต้องเรียก 3 endpoint ไว้ในคำขอเดียว)
 */
export const GET = route<{ id: string }>([ROLE.academic], async ({ params }) => {
  const id = toPosInt(params.id);
  if (!id) throw new HttpError(400, "INVALID_ID");

  const { data, error } = await supabaseAdmin.from("leaverequest").select(LEAVE_SELECT).eq("leave_request_id", id).maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!data) throw notFound("REQUEST_NOT_FOUND");
  const row = data as unknown as LeaveJoined;

  const teacher = await supabaseAdmin
    .from("teacher")
    .select("teacher_id, subject_group_id")
    .eq("user_id", row.user_id)
    .limit(1)
    .maybeSingle();
  const teacherId = (teacher.data?.teacher_id as number | undefined) ?? null;

  const [files, authMap, schedule] = await Promise.all([
    signFiles(row.file, row.user_id),
    getAuthUserMap(),
    teacherId ? scheduleForRange(teacherId, row) : Promise.resolve([]),
  ]);

  return json({
    leave: toDTO(row, files, authMap.get(row.user_id)?.email ?? ""),
    isTeacher: teacherId !== null,
    subjectGroupId: (teacher.data?.subject_group_id as number | null | undefined) ?? null,
    schedule,
    progress: coverageOf(schedule),
  });
});
