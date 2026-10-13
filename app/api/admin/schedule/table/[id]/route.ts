import { route, json, HttpError, readJson } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { teacherIdOfUser } from "@/lib/services/schedule";
import { toPosInt, UUID_RE } from "@/lib/validate";
import { ROLE } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

/** คาบต้องมีอยู่ในการตั้งค่าคาบเรียน */
async function assertConfiguredPeriods(slots: { period_number: number }[]) {
  const count = (await getSettings()).periods.periods.length;
  const bad = slots.find((s) => s.period_number > count);
  if (bad) throw new HttpError(422, "VALIDATION", `ไม่มีคาบที่ ${bad.period_number} (ตั้งค่าไว้ ${count} คาบ)`);
}

export const runtime = "nodejs";

type P = { id: string }; // user_id (uuid) ของครู

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const SELECT = `teaching_schedule_id, day_of_week, period_number, start_time, end_time,
  subject:subject_id ( subject_id, subject_name ),
  classroom:classroom_id ( classroom_id, classroom_name, level:classroom_level ( level_name ) )`;

type Joined = {
  teaching_schedule_id: number;
  day_of_week: string | null;
  period_number: number | null;
  start_time: string | null;
  end_time: string | null;
  subject: { subject_id: number; subject_name: string | null } | null;
  classroom: { classroom_id: number; classroom_name: string | null; level: { level_name: string | null } | null } | null;
};

const flat = (r: Joined) => ({
  teaching_schedule_id: r.teaching_schedule_id,
  day_of_week: Number(r.day_of_week),
  period_number: r.period_number,
  start_time: r.start_time?.slice(0, 5) ?? null,
  end_time: r.end_time?.slice(0, 5) ?? null,
  subject_id: r.subject?.subject_id ?? null,
  subject_name: r.subject?.subject_name ?? "",
  classroom_id: r.classroom?.classroom_id ?? null,
  classroom_name: r.classroom?.classroom_name ?? "",
  level_name: r.classroom?.level?.level_name ?? "",
});

type Slot = {
  day_of_week: string;
  period_number: number;
  start_time: string | null;
  end_time: string | null;
  subject_id: number | null;
  classroom_id: number | null;
};

function parseSlot(b: Record<string, unknown>, idx: number): Slot {
  const err = (m: string) => new HttpError(422, "VALIDATION", `แถวที่ ${idx + 1}: ${m}`);
  const day = Number(b.day_of_week);
  const period = Number(b.period_number);
  if (!Number.isInteger(day) || day < 1 || day > 5) throw err("วันต้องเป็นจันทร์–ศุกร์");
  if (!Number.isInteger(period) || period < 1 || period > 12) throw err("คาบไม่ถูกต้อง");
  const time = (v: unknown, label: string) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v !== "string" || !TIME_RE.test(v)) throw err(`${label} ต้องเป็นรูปแบบ HH:mm`);
    return v.length === 5 ? `${v}:00` : v;
  };
  const optId = (v: unknown, label: string) => {
    if (v === null || v === undefined || v === "") return null;
    const n = toPosInt(v);
    if (n === null) throw err(`${label} ไม่ถูกต้อง`);
    return n;
  };
  return {
    day_of_week: String(day),
    period_number: period,
    start_time: time(b.start_time, "เวลาเริ่ม"),
    end_time: time(b.end_time, "เวลาสิ้นสุด"),
    subject_id: optId(b.subject_id, "รายวิชา"),
    classroom_id: optId(b.classroom_id, "ห้องเรียน"),
  };
}

async function teacherOf(params: P): Promise<number> {
  if (!UUID_RE.test(params.id)) throw new HttpError(400, "INVALID_USER");
  const t = await teacherIdOfUser(params.id);
  if (!t) throw new HttpError(404, "TEACHER_NOT_FOUND");
  return t;
}

/** แปลง error ของ Postgres ตามบริบท: เขียน (อ้างวิชา/ห้องที่ไม่มี) หรือ ลบ (ยังถูกอ้างถึง) */
function mapDbError(e: { code?: string; message: string }, op: "write" | "delete" = "write"): HttpError {
  if (e.code === "23503") {
    return op === "delete"
      ? new HttpError(409, "IN_USE", "คาบนี้มีประวัติสอนแทนอยู่ จึงลบไม่ได้")
      : new HttpError(422, "VALIDATION", "รายวิชาหรือห้องเรียนที่เลือกไม่มีอยู่ในระบบ");
  }
  return new HttpError(500, "DB_ERROR", e.message);
}

/** ตารางสอนของครู (admin / ฝ่ายวิชาการดูได้) */
export const GET = route<P>([ROLE.admin, ROLE.academic], async ({ params }) => {
  const teacherId = await teacherOf(params);
  const { data, error } = await supabaseAdmin
    .from("teachingschedule")
    .select(SELECT)
    .eq("teacher_id", teacherId)
    .not("day_of_week", "is", null)
    .not("period_number", "is", null)
    .order("day_of_week", { ascending: true })
    .order("period_number", { ascending: true });
  if (error) throw mapDbError(error);

  const schedules = ((data ?? []) as unknown as Joined[]).map(flat).sort((a, b) => a.day_of_week - b.day_of_week || (a.period_number ?? 0) - (b.period_number ?? 0));
  return json({ schedules });
});

/** เพิ่มคาบสอน (1 คาบ หรือ { rows: [...] }) — ห้ามซ้ำวัน+คาบเดิมของครูคนเดียวกัน */
export const POST = route<P>([ROLE.admin], async ({ req, params }) => {
  const teacherId = await teacherOf(params);
  const body = await readJson<Record<string, unknown>>(req);
  const rawRows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [body];
  if (rawRows.length === 0) return json({ schedules: [] });
  if (rawRows.length > 100) throw new HttpError(413, "TOO_MANY_ROWS");

  const slots = rawRows.map(parseSlot);
  await assertConfiguredPeriods(slots);

  const existing = await supabaseAdmin.from("teachingschedule").select("day_of_week, period_number").eq("teacher_id", teacherId);
  if (existing.error) throw mapDbError(existing.error);
  const taken = new Set((existing.data ?? []).map((r) => `${r.day_of_week}|${r.period_number}`));
  for (const s of slots) {
    const key = `${s.day_of_week}|${s.period_number}`;
    if (taken.has(key)) throw new HttpError(409, "SLOT_TAKEN", "ครูมีคาบสอนในวัน/คาบนี้แล้ว");
    taken.add(key);
  }

  const { data, error } = await supabaseAdmin
    .from("teachingschedule")
    .insert(slots.map((s) => ({ ...s, teacher_id: teacherId })))
    .select(SELECT);
  if (error) throw mapDbError(error);
  return json({ schedules: ((data ?? []) as unknown as Joined[]).map(flat) }, { status: 201 });
});

/** แก้ไขคาบ ?teaching_schedule_id= (แทนการลบแล้วสร้างใหม่แบบเดิม) */
export const PATCH = route<P>([ROLE.admin], async ({ req, url, params }) => {
  const teacherId = await teacherOf(params);
  const tsId = toPosInt(url.searchParams.get("teaching_schedule_id"));
  if (!tsId) throw new HttpError(400, "INVALID_ID");
  const slot = parseSlot(await readJson<Record<string, unknown>>(req), 0);
  await assertConfiguredPeriods([slot]);

  const clash = await supabaseAdmin
    .from("teachingschedule")
    .select("teaching_schedule_id")
    .eq("teacher_id", teacherId)
    .eq("day_of_week", slot.day_of_week)
    .eq("period_number", slot.period_number)
    .neq("teaching_schedule_id", tsId)
    .limit(1);
  if (clash.error) throw mapDbError(clash.error);
  if (clash.data && clash.data.length > 0) throw new HttpError(409, "SLOT_TAKEN", "ครูมีคาบสอนในวัน/คาบนี้แล้ว");

  const { data, error } = await supabaseAdmin
    .from("teachingschedule")
    .update(slot)
    .eq("teaching_schedule_id", tsId)
    .eq("teacher_id", teacherId)
    .select(SELECT)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new HttpError(404, "NOT_FOUND");
  return json({ schedule: flat(data as unknown as Joined) });
});

/** ลบคาบ ?teaching_schedule_id= หรือลบทั้งตาราง ?all=true */
export const DELETE = route<P>([ROLE.admin], async ({ url, params }) => {
  const teacherId = await teacherOf(params);
  const tsId = toPosInt(url.searchParams.get("teaching_schedule_id"));
  const all = url.searchParams.get("all") === "true";
  if (!tsId && !all) throw new HttpError(400, "INVALID_ID");

  // ตรวจประวัติสอนแทนก่อนลบ — ไม่พึ่ง FK เพราะฐานข้อมูลจริงบางความสัมพันธ์ลบแบบ CASCADE
  let target = supabaseAdmin.from("teachingschedule").select("teaching_schedule_id").eq("teacher_id", teacherId);
  if (tsId) target = target.eq("teaching_schedule_id", tsId);
  const { data: rows, error: selErr } = await target;
  if (selErr) throw mapDbError(selErr, "delete");
  const ids = (rows ?? []).map((r) => r.teaching_schedule_id as number);
  if (ids.length) {
    const used = await supabaseAdmin
      .from("substituteuserteaching")
      .select("substitute_teaching_id", { count: "exact", head: true })
      .in("teaching_schedule_id", ids);
    if (used.error) throw mapDbError(used.error, "delete");
    if ((used.count ?? 0) > 0) throw new HttpError(409, "IN_USE", `มีประวัติสอนแทน ${used.count} รายการผูกกับคาบนี้ จึงลบไม่ได้`);
  }

  let q = supabaseAdmin.from("teachingschedule").delete({ count: "exact" }).eq("teacher_id", teacherId);
  if (tsId) q = q.eq("teaching_schedule_id", tsId);
  const { error, count } = await q;
  if (error) throw mapDbError(error, "delete");
  return json({ ok: true, deleted: count ?? 0 });
});
