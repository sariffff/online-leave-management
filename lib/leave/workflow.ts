// ขั้นตอนของใบลา: ยื่น → ธุรการตรวจ → ผอ.อนุมัติ → จัดสอนแทน
// ทุกฟังก์ชันใช้ service role หลังจาก route ตรวจบทบาทแล้ว และเปลี่ยนสถานะด้วย "update แบบมีเงื่อนไข"
// (WHERE status = สถานะเดิม) เพื่อกันการกดซ้ำ/แข่งกัน — โควตาคำนวณจาก leaverequest ไม่ต้องแก้ตัวเลขเอง
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError, conflict, notFound } from "@/lib/http";
import { assertQuotaAvailable, computeQuota, syncQuotaSnapshot } from "@/lib/leave/quota";
import { getLeaveTypeFull } from "@/lib/leave/types";
import { checkLeaveRules, todayInThailand, type RuleOptions } from "@/lib/leave/rules";
import type { LeaveTypeRule } from "@/lib/settings-schema";
import { countLeaveDays, partOfDay } from "@/lib/leave/days";
import { OWNER_EDITABLE, normalizeHalf } from "@/lib/leave/status";
import { assertUploads, removeFiles, parseFileField, serializeFileField, toStorageKey, uploadFiles } from "@/lib/leave/files";
import { getHolidayMap } from "@/lib/services/holidays";
import { getFiscalYearFromISO, isSameFiscalYear } from "@/utils/year";
import { isISODate } from "@/lib/validate";
import type { LeaveRequestRow } from "@/types/db";

const nowISO = () => new Date().toISOString();

/* ---------------- ตัวช่วยภายใน ---------------- */
type DateInput = {
  date_start: string;
  date_end: string;
  date_start_type?: string | null;
  date_end_type?: string | null;
};

function assertDates(i: DateInput) {
  if (!isISODate(i.date_start) || !isISODate(i.date_end)) throw new HttpError(422, "INVALID_DATE");
  if (i.date_start > i.date_end) throw new HttpError(422, "END_BEFORE_START");
  if (!isSameFiscalYear(i.date_start, i.date_end)) throw new HttpError(400, "LEAVE_CROSSES_FISCAL_YEAR");
}

/**
 * จำนวนวันที่ server คำนวณเอง — ไม่เชื่อค่าจาก client แม้ดึงวันหยุดราชการไม่สำเร็จ
 * (ฟอร์มก็ได้วันหยุดจาก API เดียวกัน จึงไม่มีข้อมูลดีกว่า server และเคยถูกใช้ส่ง 0.5 วันแทน 2 วัน)
 */
async function resolveTotalDays(i: DateInput, mode: LeaveTypeRule["countMode"] = "working"): Promise<number> {
  const { map, degraded } = await getHolidayMap(i.date_start, i.date_end);
  if (degraded) console.warn("[leave] holiday source degraded — counting without public holidays", i.date_start, i.date_end);
  const calc = countLeaveDays({
    start: i.date_start,
    end: i.date_end,
    startType: i.date_start_type,
    endType: i.date_end_type,
    holidays: map,
    mode,
  });
  if (calc.total <= 0) throw new HttpError(422, "NO_WORKING_DAYS");
  return calc.total;
}

/** กฎของประเภทการลาที่ผู้ดูแลตั้งไว้ (ครั้งละไม่เกิน, แนบเอกสาร, ล่วงหน้า/ย้อนหลัง, ครึ่งวัน, ปิดใช้งาน) */
function enforceRules(rule: LeaveTypeRule, i: DateInput, totalDays: number, fileCount: number, opts?: RuleOptions) {
  const v = checkLeaveRules(
    rule,
    { start: i.date_start, end: i.date_end, startType: i.date_start_type, endType: i.date_end_type, totalDays, fileCount, today: todayInThailand() },
    opts
  );
  if (v.length) throw new HttpError(422, v[0].code, { message: v[0].message, ...v[0].detail });
}

/** สถานะที่ถือว่า "ยังลาอยู่" — ใช้ตรวจวันลาทับกัน */
const LIVE_STATUSES = ["pending", "reviewed", "approved", "covered"] as const;

/** ใบลาที่ยังมีผลของผู้ใช้คนนี้ที่ทับช่วงวันที่ (ครึ่งเช้า + ครึ่งบ่ายของวันเดียวกันไม่ถือว่าทับ) */
async function assertNoOverlap(userId: string, next: DateInput, excludeId?: number) {
  let q = supabaseAdmin
    .from("leaverequest")
    .select("leave_request_id, date_start, date_end, date_start_type, date_end_type")
    .eq("user_id", userId)
    .in("status", [...LIVE_STATUSES])
    .lte("date_start", next.date_end)
    .gte("date_end", next.date_start);
  if (excludeId) q = q.neq("leave_request_id", excludeId);
  const { data, error } = await q;
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  for (const other of (data ?? []) as LeaveRequestRow[]) {
    const from = next.date_start > other.date_start ? next.date_start : other.date_start;
    const to = next.date_end < other.date_end ? next.date_end : other.date_end;
    for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      const a = partOfDay(next, d);
      const b = partOfDay(other, d);
      const clash = a === "full" || b === "full" || a === b;
      if (clash) throw new HttpError(409, "OVERLAPPING_LEAVE", { leave_request_id: other.leave_request_id, date: d });
    }
  }
}

async function getRequest(id: number): Promise<LeaveRequestRow> {
  const { data, error } = await supabaseAdmin.from("leaverequest").select("*").eq("leave_request_id", id).maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!data) throw notFound("REQUEST_NOT_FOUND");
  return data as LeaveRequestRow;
}

/** เปลี่ยนสถานะแบบมีเงื่อนไข — ไม่ตรงเงื่อนไขจะตอบ 409 */
async function transition(
  id: number,
  from: string | readonly string[],
  patch: Record<string, unknown>,
  errorCode: string
): Promise<LeaveRequestRow> {
  let q = supabaseAdmin.from("leaverequest").update(patch).eq("leave_request_id", id);
  q = Array.isArray(from) ? q.in("status", [...from]) : q.eq("status", from as string);
  const { data, error } = await q.select("*").maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!data) {
    await getRequest(id); // 404 ถ้าไม่มีอยู่จริง
    throw conflict(errorCode);
  }
  return data as LeaveRequestRow;
}

async function syncFor(row: Pick<LeaveRequestRow, "user_id" | "leave_type_id" | "date_start">) {
  await syncQuotaSnapshot(row.user_id, row.leave_type_id, getFiscalYearFromISO(row.date_start));
}

/* ---------------- ผู้ยื่น ---------------- */
export type SubmitInput = DateInput & {
  leave_type_id: number;
  reason: string;
  files: File[];
};

export async function submitLeave(userId: string, input: SubmitInput) {
  assertDates(input);
  if (!input.reason) throw new HttpError(422, "MISSING_REASON");
  const { rule } = await getLeaveTypeFull(input.leave_type_id);

  const fiscalYear = getFiscalYearFromISO(input.date_start);
  const totalDay = await resolveTotalDays(input, rule.countMode);
  enforceRules(rule, input, totalDay, input.files.length);
  await assertUploads(input.files);
  await assertNoOverlap(userId, input);
  await assertQuotaAvailable({ userId, leaveTypeId: input.leave_type_id, fiscalYear, days: totalDay });

  const { data: ins, error } = await supabaseAdmin
    .from("leaverequest")
    .insert({
      user_id: userId,
      leave_type_id: input.leave_type_id,
      date_start: input.date_start,
      date_end: input.date_end,
      date_start_type: normalizeHalf(input.date_start_type),
      date_end_type: normalizeHalf(input.date_end_type),
      total_day: totalDay,
      reason: input.reason,
      status: "pending",
      year: fiscalYear,
    })
    .select("leave_request_id")
    .single();
  if (error || !ins) throw new HttpError(500, "DB_INSERT_FAILED", error?.message);
  const id = ins.leave_request_id as number;

  const rollback = async (keys: string[] = []) => {
    await removeFiles(keys);
    await supabaseAdmin.from("leaverequest").delete().eq("leave_request_id", id);
  };

  let keys: string[] = [];
  try {
    if (input.files.length > 0) {
      keys = await uploadFiles(userId, input.files);
      const { error: upErr } = await supabaseAdmin
        .from("leaverequest")
        .update({ file: serializeFileField(keys) })
        .eq("leave_request_id", id);
      if (upErr) throw new HttpError(500, "DB_UPDATE_FAILED", upErr.message);
    }

    // ตรวจซ้ำหลังบันทึก: ถ้ายื่นพร้อมกันหลายใบจนเกินสิทธิ์ ให้ถอนใบนี้ออก
    const item = (await computeQuota(userId, fiscalYear)).find((i) => i.leave_type_id === input.leave_type_id);
    if (item && !item.unlimited && (item.total ?? 0) - item.used - item.reserved < 0) {
      throw new HttpError(400, "INSUFFICIENT_QUOTA", { available: 0 });
    }
  } catch (e) {
    await rollback(keys);
    throw e;
  }

  await syncQuotaSnapshot(userId, input.leave_type_id, fiscalYear);
  return { id, year: fiscalYear, total_day: totalDay };
}

export type UpdateOwnInput = Partial<DateInput> & {
  reason?: string;
  files?: File[];
};

export async function updateOwnLeave(userId: string, id: number, input: UpdateOwnInput) {
  const cur = await getRequest(id);
  if (cur.user_id !== userId) throw notFound("REQUEST_NOT_FOUND");
  if (!(OWNER_EDITABLE as readonly string[]).includes(cur.status)) throw new HttpError(400, "NOT_EDITABLE");

  const next: DateInput = {
    date_start: input.date_start ?? cur.date_start,
    date_end: input.date_end ?? cur.date_end,
    date_start_type: input.date_start_type ?? cur.date_start_type,
    date_end_type: input.date_end_type ?? cur.date_end_type,
  };
  assertDates(next);

  const datesChanged =
    next.date_start !== cur.date_start ||
    next.date_end !== cur.date_end ||
    normalizeHalf(next.date_start_type) !== normalizeHalf(cur.date_start_type) ||
    normalizeHalf(next.date_end_type) !== normalizeHalf(cur.date_end_type);

  const { rule } = await getLeaveTypeFull(cur.leave_type_id);
  const totalDay = datesChanged ? await resolveTotalDays(next, rule.countMode) : Number(cur.total_day);
  const fiscalYear = getFiscalYearFromISO(next.date_start);
  // แก้โดยไม่เปลี่ยนวัน (เช่น แนบเอกสารเพิ่มให้ใบที่ถูกตีกลับ) ไม่ตรวจเรื่องยื่นล่วงหน้า/ย้อนหลัง
  const fileCount = input.files && input.files.length > 0 ? input.files.length : parseFileField(cur.file).length;
  enforceRules(rule, next, totalDay, fileCount, { timing: datesChanged });
  if (input.files) await assertUploads(input.files);
  if (datesChanged) await assertNoOverlap(userId, next, id);

  await assertQuotaAvailable({
    userId,
    leaveTypeId: cur.leave_type_id,
    fiscalYear,
    days: totalDay,
    excludeRequestId: id,
  });

  const patch: Record<string, unknown> = {
    date_start: next.date_start,
    date_end: next.date_end,
    date_start_type: normalizeHalf(next.date_start_type),
    date_end_type: normalizeHalf(next.date_end_type),
    total_day: totalDay,
    year: fiscalYear,
  };
  if (input.reason !== undefined) {
    if (!input.reason) throw new HttpError(422, "MISSING_REASON");
    patch.reason = input.reason;
  }

  let newKeys: string[] = [];
  const oldKeys = parseFileField(cur.file).map((k) => toStorageKey(k, cur.user_id));
  if (input.files && input.files.length > 0) {
    newKeys = await uploadFiles(userId, input.files);
    patch.file = serializeFileField(newKeys);
  }

  // ใบที่ถูกตีกลับ (failed) เมื่อแก้แล้วส่งเข้าคิวตรวจใหม่
  if (cur.status === "failed") {
    Object.assign(patch, {
      status: "pending",
      comment: null,
      reviewed_by: null,
      reviewed_at: null,
      approved_by: null,
      approved_at: null,
    });
  }

  try {
    await transition(id, cur.status, patch, "STATUS_CHANGED");
  } catch (e) {
    await removeFiles(newKeys);
    throw e;
  }

  if (newKeys.length > 0) await removeFiles(oldKeys);
  await syncQuotaSnapshot(userId, cur.leave_type_id, fiscalYear);
  const oldFy = getFiscalYearFromISO(cur.date_start);
  if (oldFy !== fiscalYear) await syncQuotaSnapshot(userId, cur.leave_type_id, oldFy);
  return { ok: true as const };
}

export async function deleteOwnLeave(userId: string, id: number) {
  const cur = await getRequest(id);
  if (cur.user_id !== userId) throw notFound("REQUEST_NOT_FOUND");
  if (!(OWNER_EDITABLE as readonly string[]).includes(cur.status)) throw new HttpError(400, "NOT_DELETABLE");

  const { data, error } = await supabaseAdmin
    .from("leaverequest")
    .delete()
    .eq("leave_request_id", id)
    .in("status", [...OWNER_EDITABLE])
    .select("leave_request_id");
  if (error) throw new HttpError(500, "DB_DELETE_FAILED", error.message);
  if (!data?.length) throw conflict("STATUS_CHANGED");

  await removeFiles(parseFileField(cur.file).map((k) => toStorageKey(k, cur.user_id)));
  await syncFor(cur);
}

/* ---------------- ธุรการ ---------------- */
export async function reviewLeave(reviewerId: string, id: number, decision: "reviewed" | "failed", note: string) {
  const row = await transition(
    id,
    "pending",
    { status: decision, reviewed_by: reviewerId, reviewed_at: nowISO(), comment: note || null },
    "NOT_REVIEWABLE"
  );
  await syncFor(row);
  return row;
}

/* ---------------- ผู้อำนวยการ ---------------- */
export async function approveLeave(approverId: string, id: number, decision: "approved" | "rejected", note: string) {
  const cur = await getRequest(id);
  const row = await transition(
    id,
    "reviewed",
    {
      status: decision,
      approved_by: approverId,
      approved_at: nowISO(),
      // ใช้คอลัมน์ comment ร่วมกับธุรการ — ผอ.ไม่ใส่หมายเหตุก็ให้หมายเหตุของธุรการยังอยู่
      comment: note || cur.comment || null,
      year: cur.year ?? getFiscalYearFromISO(cur.date_start),
    },
    "NOT_APPROVABLE"
  );
  await syncFor(row);
  return row;
}

export type DirectorCreateInput = DateInput & {
  user_id: string;
  leave_type_id: number;
  reason: string | null;
};

/** ผอ.สร้างใบลาแทนบุคลากร → อนุมัติทันที */
export async function directorCreateLeave(directorId: string, input: DirectorCreateInput) {
  assertDates(input);
  const { rule } = await getLeaveTypeFull(input.leave_type_id);

  const { data: target, error: tErr } = await supabaseAdmin
    .from("users")
    .select("user_id, is_active")
    .eq("user_id", input.user_id)
    .maybeSingle();
  if (tErr) throw new HttpError(500, "DB_ERROR", tErr.message);
  if (!target) throw notFound("USER_NOT_FOUND");
  if (target.is_active === false) throw new HttpError(400, "USER_INACTIVE");

  const fiscalYear = getFiscalYearFromISO(input.date_start);
  const totalDay = await resolveTotalDays(input, rule.countMode);
  // ผอ.สร้างแทน: ไม่ตรวจเวลายื่น/เอกสาร (ผอ.พิจารณาเอง) แต่ยังตรวจครั้งละไม่เกิน/ครึ่งวัน/ปิดใช้งาน
  enforceRules(rule, input, totalDay, 0, { timing: false, documents: false });
  await assertNoOverlap(input.user_id, input);
  await assertQuotaAvailable({ userId: input.user_id, leaveTypeId: input.leave_type_id, fiscalYear, days: totalDay });

  const { data, error } = await supabaseAdmin
    .from("leaverequest")
    .insert({
      user_id: input.user_id,
      leave_type_id: input.leave_type_id,
      date_start: input.date_start,
      date_end: input.date_end,
      date_start_type: normalizeHalf(input.date_start_type),
      date_end_type: normalizeHalf(input.date_end_type),
      total_day: totalDay,
      reason: input.reason,
      status: "approved",
      approved_by: directorId,
      approved_at: nowISO(),
      year: fiscalYear,
    })
    .select("leave_request_id")
    .single();
  if (error || !data) throw new HttpError(500, "DB_INSERT_FAILED", error?.message);

  await syncQuotaSnapshot(input.user_id, input.leave_type_id, fiscalYear);
  return { id: data.leave_request_id as number, year: fiscalYear, total_day: totalDay };
}

/** ผอ.ลบใบลาที่ธุรการตรวจแล้วแต่ยังไม่อนุมัติ */
export async function directorDeleteReviewed(id: number) {
  const cur = await getRequest(id);
  const { data, error } = await supabaseAdmin
    .from("leaverequest")
    .delete()
    .eq("leave_request_id", id)
    .eq("status", "reviewed")
    .select("leave_request_id");
  if (error) throw new HttpError(500, "DB_DELETE_FAILED", error.message);
  if (!data?.length) throw conflict("NOT_DELETABLE_STATUS");

  await removeFiles(parseFileField(cur.file).map((k) => toStorageKey(k, cur.user_id)));
  await syncFor(cur);
}

/* ---------------- ฝ่ายวิชาการ ---------------- */
export async function markCovered(id: number) {
  const row = await transition(id, "approved", { status: "covered" }, "NOT_COVERABLE");
  await syncFor(row);
  return row;
}
