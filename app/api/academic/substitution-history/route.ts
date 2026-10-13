import { route, json, HttpError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fullName } from "@/lib/format";
import { isISODate, toInt, toPosInt } from "@/lib/validate";
import { teacherIdOfUser } from "@/lib/services/schedule";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

type NameRow = { prename: string | null; name: string | null; surname: string | null } | null;
type Row = {
  substitute_teaching_id: number;
  date_time: string;
  teaching_schedule_id: number | null;
  substitute: NameRow;
  ts: {
    period_number: number | null;
    teacher_id: number | null;
    subject: { subject_name: string | null } | null;
    classroom: { classroom_name: string | null } | null;
    teacher: { user: NameRow } | null;
  } | null;
};

/**
 * ประวัติการสอนแทน — โหมด A: ?leaveId=  |  โหมด B: ?from=&to=[&teacherUserId=]
 * แบ่งหน้าที่ DB (?page=&pageSize=)
 */
export const GET = route([ROLE.academic], async ({ url }) => {
  const sp = url.searchParams;
  const page = toInt(sp.get("page"), 1, 1, 100000);
  const pageSize = toInt(sp.get("pageSize"), 10, 1, 100);

  let from: string;
  let to: string;
  let teacherId: number | null = null;

  const leaveId = toPosInt(sp.get("leaveId"));
  if (leaveId) {
    const { data, error } = await supabaseAdmin
      .from("leaverequest")
      .select("user_id, date_start, date_end")
      .eq("leave_request_id", leaveId)
      .maybeSingle();
    if (error) throw new HttpError(500, "DB_ERROR", error.message);
    if (!data) throw new HttpError(404, "REQUEST_NOT_FOUND");
    from = data.date_start as string;
    to = data.date_end as string;
    teacherId = await teacherIdOfUser(data.user_id as string);
    if (!teacherId) throw new HttpError(404, "NOT_TEACHER");
  } else {
    from = sp.get("from") ?? "";
    to = sp.get("to") ?? "";
    if (!isISODate(from) || !isISODate(to)) throw new HttpError(400, "INVALID_DATE");
    const teacherUserId = sp.get("teacherUserId");
    if (teacherUserId) {
      teacherId = await teacherIdOfUser(teacherUserId);
      if (!teacherId) throw new HttpError(404, "NOT_TEACHER");
    }
  }

  let q = supabaseAdmin
    .from("substituteuserteaching")
    .select(
      `substitute_teaching_id, date_time, teaching_schedule_id,
       substitute:substitute_user_id ( prename, name, surname ),
       ts:teaching_schedule_id${teacherId ? "!inner" : ""} (
         period_number, teacher_id,
         subject:subject_id ( subject_name ),
         classroom:classroom_id ( classroom_name ),
         teacher:teacher_id ( user:user_id ( prename, name, surname ) )
       )`,
      { count: "exact" }
    )
    .gte("date_time", `${from} 00:00:00`)
    .lte("date_time", `${to} 23:59:59`)
    .order("date_time", { ascending: true });
  if (teacherId) q = q.eq("ts.teacher_id", teacherId);

  const start = (page - 1) * pageSize;
  const { data, error, count } = await q.range(start, start + pageSize - 1);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  const items = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.substitute_teaching_id,
    date: String(r.date_time).slice(0, 10),
    time: String(r.date_time).slice(11, 16),
    tsId: r.teaching_schedule_id,
    period: r.ts?.period_number ?? null,
    subject: r.ts?.subject?.subject_name ?? "",
    classroom: r.ts?.classroom?.classroom_name ?? "",
    leaver: fullName(r.ts?.teacher?.user),
    substitute: fullName(r.substitute),
  }));

  const total = count ?? items.length;
  return json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
