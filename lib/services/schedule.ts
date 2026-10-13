// ตารางสอน/ครูว่าง/สอนแทน — ตรรกะที่ฝ่ายวิชาการใช้ (แยกออกจาก route เพื่อทดสอบและใช้ซ้ำได้)
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { fullName } from "@/lib/format";
import { isISODate } from "@/lib/validate";
import { leaveCoversPeriod, periodPart, type LeaveSpan } from "@/lib/leave/days";
import { getHolidayMap } from "@/lib/services/holidays";

/** ใบลาที่ถือว่า "ไม่อยู่" — รวมใบที่รอพิจารณา เพื่อไม่ให้มอบหมายคนที่ขอลาไว้แล้ว */
const ABSENT_STATUSES = ["pending", "reviewed", "approved", "covered"];

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' → รายการวันที่ทุกวันในช่วง (UTC กันวันเลื่อน) */
export function eachDate(start: string, end: string, limit = 400): string[] {
  const out: string[] = [];
  if (!isISODate(start) || !isISODate(end) || start > end) return out;
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  for (let t = s; t <= e && out.length < limit; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** วันที่ → เลขวันตามตารางสอน (จันทร์=1 ... ศุกร์=5) หรือ null ถ้าเสาร์/อาทิตย์ */
export function teachingDow(iso: string): number | null {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5 ? d : null;
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export async function teacherIdOfUser(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.from("teacher").select("teacher_id").eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  return data?.teacher_id ?? null;
}

export type ScheduleSlot = {
  teachingScheduleId: number;
  period: number;
  time: string;
  subject: string;
  room: string;
  substituteUserId: string | null;
  substituteName: string | null;
};

export type ScheduleDay = { date: string; weekday: number | null; slots: ScheduleSlot[] };

/**
 * คาบที่ต้องหาครูสอนแทนตามใบลา พร้อมสถานะสอนแทนของแต่ละคาบ (ใช้ query รวม ไม่วน N+1)
 * ข้ามวันหยุด และคาบในครึ่งวันที่ไม่ได้ลา
 */
export async function scheduleForRange(teacherId: number, leave: LeaveSpan): Promise<ScheduleDay[]> {
  const start = leave.date_start;
  const end = leave.date_end;
  const dates = eachDate(start, end);
  if (dates.length === 0) return [];
  const { map: holidays } = await getHolidayMap(start, end);

  const dows = [...new Set(dates.map(teachingDow).filter((d): d is number => d !== null))];

  const rowsRes = dows.length
    ? await supabaseAdmin
        .from("teachingschedule")
        .select(
          `teaching_schedule_id, day_of_week, period_number, start_time, end_time,
           subject:subject_id ( subject_name ), classroom:classroom_id ( classroom_name )`
        )
        .eq("teacher_id", teacherId)
        .in("day_of_week", dows.map(String))
        .order("period_number", { ascending: true })
    : { data: [], error: null };
  if (rowsRes.error) throw new HttpError(500, "DB_ERROR", rowsRes.error.message);

  type Row = {
    teaching_schedule_id: number;
    day_of_week: string;
    period_number: number | null;
    start_time: string | null;
    end_time: string | null;
    subject: { subject_name: string | null } | null;
    classroom: { classroom_name: string | null } | null;
  };
  const rows = (rowsRes.data ?? []) as unknown as Row[];

  // สอนแทนที่มีอยู่แล้วในช่วงนี้
  const tsIds = rows.map((r) => r.teaching_schedule_id);
  const subs = new Map<string, { userId: string; name: string }>(); // `${date}|${tsId}`
  if (tsIds.length) {
    const subRes = await supabaseAdmin
      .from("substituteuserteaching")
      .select("date_time, teaching_schedule_id, substitute_user_id, substitute:substitute_user_id ( prename, name, surname )")
      .in("teaching_schedule_id", tsIds)
      .gte("date_time", `${start}T00:00:00`)
      .lt("date_time", `${new Date(Date.parse(`${end}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)}T00:00:00`);
    if (subRes.error) throw new HttpError(500, "DB_ERROR", subRes.error.message);
    for (const s of (subRes.data ?? []) as unknown as Array<{
      date_time: string;
      teaching_schedule_id: number;
      substitute_user_id: string;
      substitute: { prename: string | null; name: string | null; surname: string | null } | null;
    }>) {
      subs.set(`${String(s.date_time).slice(0, 10)}|${s.teaching_schedule_id}`, {
        userId: s.substitute_user_id,
        name: fullName(s.substitute),
      });
    }
  }

  const byDow = new Map<number, Row[]>();
  for (const r of rows) {
    const k = Number(r.day_of_week);
    byDow.set(k, [...(byDow.get(k) ?? []), r]);
  }

  return dates.map((date) => {
    const dow = holidays.has(date) ? null : teachingDow(date);
    const rowsOfDay = (dow ? byDow.get(dow) ?? [] : []).filter((r) =>
      leaveCoversPeriod(leave, date, periodPart(r.period_number ?? 0, r.start_time))
    );
    const slots: ScheduleSlot[] = rowsOfDay.map((r) => {
      const sub = subs.get(`${date}|${r.teaching_schedule_id}`);
      const st = hhmm(r.start_time);
      const et = hhmm(r.end_time);
      return {
        teachingScheduleId: r.teaching_schedule_id,
        period: r.period_number ?? 0,
        time: st && et ? `${st} - ${et} น.` : "",
        subject: r.subject?.subject_name ?? "-",
        room: r.classroom?.classroom_name ?? "-",
        substituteUserId: sub?.userId ?? null,
        substituteName: sub?.name ?? null,
      };
    });
    return { date, weekday: dow, slots };
  });
}

/** ใบลาครอบคลุมทุกคาบที่ต้องสอนแทนแล้วหรือยัง */
export function coverageOf(days: ScheduleDay[]) {
  let required = 0;
  let assigned = 0;
  const missing: Array<{ date: string; tsId: number; period: number }> = [];
  for (const d of days) {
    for (const s of d.slots) {
      required++;
      if (s.substituteUserId) assigned++;
      else missing.push({ date: d.date, tsId: s.teachingScheduleId, period: s.period });
    }
  }
  return { required, assigned, complete: assigned >= required, missing };
}

/**
 * ครูที่ว่างในวัน/คาบนั้น (ไม่มีสอนและไม่ได้สอนแทนคาบเดียวกัน) แยกกลุ่มสาระเดียวกัน/ต่างกลุ่ม
 * ใช้ 3 query แบบขนาน แทนการวนทีละครู
 */
export async function freeTeachers(args: { date: string; period: number; excludeUserId?: string; subjectGroupId?: number | null }) {
  const dow = teachingDow(args.date);
  if (!dow) return { sameGroup: [], otherGroups: [], resolvedSubjectGroup: null as number | null };

  const nextDay = new Date(Date.parse(`${args.date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

  const part = periodPart(args.period);
  const [teachersRes, busyRes, subsRes, leaveRes] = await Promise.all([
    supabaseAdmin.from("teacher").select("teacher_id, user_id, subject_group_id, user:user_id ( user_id, prename, name, surname, is_active )"),
    supabaseAdmin.from("teachingschedule").select("teacher_id").eq("day_of_week", String(dow)).eq("period_number", args.period),
    supabaseAdmin
      .from("substituteuserteaching")
      .select("substitute_user_id, teachingschedule:teaching_schedule_id!inner ( period_number )")
      .gte("date_time", `${args.date}T00:00:00`)
      .lt("date_time", `${nextDay}T00:00:00`)
      .eq("teachingschedule.period_number", args.period),
    supabaseAdmin
      .from("leaverequest")
      .select("user_id, date_start, date_end, date_start_type, date_end_type")
      .in("status", ABSENT_STATUSES)
      .lte("date_start", args.date)
      .gte("date_end", args.date),
  ]);
  for (const r of [teachersRes, busyRes, subsRes, leaveRes]) if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);

  type T = {
    teacher_id: number;
    user_id: string | null;
    subject_group_id: number | null;
    user: { user_id: string; prename: string | null; name: string | null; surname: string | null; is_active: boolean | null } | null;
  };
  const teachers = ((teachersRes.data ?? []) as unknown as T[]).filter((t) => t.user && t.user.is_active !== false);

  const busyTeacher = new Set((busyRes.data ?? []).map((r) => r.teacher_id as number));
  const busyUser = new Set((subsRes.data ?? []).map((r) => r.substitute_user_id as string));
  // ครูที่ลาในช่วงของคาบนี้ไม่ว่าง
  for (const l of (leaveRes.data ?? []) as Array<LeaveSpan & { user_id: string }>) {
    if (leaveCoversPeriod(l, args.date, part)) busyUser.add(l.user_id);
  }

  let group = args.subjectGroupId ?? null;
  if (group === null && args.excludeUserId) {
    group = teachers.find((t) => t.user_id === args.excludeUserId)?.subject_group_id ?? null;
  }

  const free = teachers
    .filter((t) => !busyTeacher.has(t.teacher_id) && !busyUser.has(t.user!.user_id) && t.user!.user_id !== args.excludeUserId)
    .map((t) => ({
      id: String(t.teacher_id),
      user_id: t.user!.user_id,
      name: fullName(t.user) || "-",
      subjectGroup: t.subject_group_id,
    }));

  return {
    sameGroup: group === null ? [] : free.filter((t) => t.subjectGroup === group),
    otherGroups: group === null ? free : free.filter((t) => t.subjectGroup !== group),
    resolvedSubjectGroup: group,
  };
}

/** มอบหมายครูสอนแทน 1 คาบ — ตรวจวัน/คาบตรงกับตารางสอน, ครูผู้สอนแทนว่างจริง และไม่ซ้ำ */
export async function assignSubstitute(args: { teachingScheduleId: number; dateISO: string; substituteUserId: string }) {
  if (!isISODate(args.dateISO)) throw new HttpError(400, "INVALID_DATE");

  const { data: ts, error } = await supabaseAdmin
    .from("teachingschedule")
    .select("teaching_schedule_id, day_of_week, period_number, start_time, teacher:teacher_id ( user_id )")
    .eq("teaching_schedule_id", args.teachingScheduleId)
    .maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!ts) throw new HttpError(404, "SCHEDULE_NOT_FOUND");

  const row = ts as unknown as {
    day_of_week: string | null;
    period_number: number | null;
    start_time: string | null;
    teacher: { user_id: string | null } | null;
  };

  if (teachingDow(args.dateISO) !== Number(row.day_of_week)) throw new HttpError(400, "DATE_NOT_MATCH_SCHEDULE");
  if (row.teacher?.user_id === args.substituteUserId) throw new HttpError(400, "CANNOT_SUBSTITUTE_SELF");

  // ต้องมีใบลาที่อนุมัติแล้วของครูเจ้าของคาบ ครอบคลุมวัน/ช่วงเวลาของคาบนี้
  const ownerLeaves = await supabaseAdmin
    .from("leaverequest")
    .select("date_start, date_end, date_start_type, date_end_type")
    .eq("user_id", row.teacher?.user_id ?? "")
    .in("status", ["approved", "covered"])
    .lte("date_start", args.dateISO)
    .gte("date_end", args.dateISO);
  if (ownerLeaves.error) throw new HttpError(500, "DB_ERROR", ownerLeaves.error.message);
  const part = periodPart(row.period_number ?? 0, row.start_time);
  if (!((ownerLeaves.data ?? []) as LeaveSpan[]).some((l) => leaveCoversPeriod(l, args.dateISO, part))) {
    throw new HttpError(400, "NO_APPROVED_LEAVE");
  }

  if (row.period_number) {
    const free = await freeTeachers({ date: args.dateISO, period: row.period_number });
    const ok = [...free.sameGroup, ...free.otherGroups].some((t) => t.user_id === args.substituteUserId);
    if (!ok) throw new HttpError(409, "SUBSTITUTE_NOT_FREE");
  }

  const dateTime = `${args.dateISO} ${(row.start_time || "08:00:00").slice(0, 8)}`;

  const dup = await supabaseAdmin
    .from("substituteuserteaching")
    .select("substitute_teaching_id")
    .eq("teaching_schedule_id", args.teachingScheduleId)
    .eq("date_time", dateTime)
    .limit(1);
  if (dup.error) throw new HttpError(500, "DB_ERROR", dup.error.message);
  if (dup.data && dup.data.length > 0) throw new HttpError(409, "ALREADY_ASSIGNED");

  const ins = await supabaseAdmin
    .from("substituteuserteaching")
    .insert({ date_time: dateTime, substitute_user_id: args.substituteUserId, teaching_schedule_id: args.teachingScheduleId })
    .select("substitute_teaching_id, date_time, substitute_user_id, teaching_schedule_id")
    .single();
  if (ins.error) throw new HttpError(500, "DB_ERROR", ins.error.message);
  return ins.data;
}
