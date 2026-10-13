// โควตาวันลา — คำนวณจากตาราง leaverequest (แหล่งความจริงเดียว) แล้วเขียน snapshot ลง userleavequota
// เหตุผล: เดิมแก้ตัวเลขแบบ read-modify-write ที่หลาย route จึงคืนสิทธิ์ไม่ครบและแข่งกันเขียนได้
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { getFiscalRange, getFiscalYearFromISO } from "@/utils/year";
import { RESERVED_STATUSES, USED_STATUSES } from "@/lib/leave/status";
import type { LeaveTypeRow } from "@/types/db";
import { timed } from "@/lib/perf";

/* ---------------- ประเภทการลา (cache สั้น ๆ) ---------------- */
let typesCache: { at: number; rows: LeaveTypeRow[] } | null = null;
const TYPES_TTL = 60_000;

export async function listLeaveTypes(): Promise<LeaveTypeRow[]> {
  if (typesCache && Date.now() - typesCache.at < TYPES_TTL) return typesCache.rows;
  const { data, error } = await supabaseAdmin
    .from("leavetype")
    .select("leave_type_id, leave_type_name, max_leave_day, carry_over_max, note")
    .order("leave_type_id", { ascending: true });
  if (error) throw new HttpError(500, "LEAVETYPE_FETCH_FAILED", error.message);
  const rows = (data ?? []) as LeaveTypeRow[];
  typesCache = { at: Date.now(), rows };
  return rows;
}

/** ล้าง cache หลังผู้ดูแลแก้ประเภทการลา */
export function invalidateLeaveTypes() {
  typesCache = null;
}

/* ---------------- คำนวณโควตา ---------------- */
export type QuotaItem = {
  leave_type_id: number;
  name: string;
  note: string | null;
  max_leave_day: number | null;
  carry_over_max: number | null;
  /** max_leave_day = null → ไม่จำกัดโควตา */
  unlimited: boolean;
  carried: number; // วันสะสมจากปีงบก่อนหน้า
  total: number | null; // สิทธิ์ทั้งหมดของปีงบนี้ (max + สะสม)
  used: number; // อนุมัติ/จัดสอนแทนแล้ว
  reserved: number; // กันไว้ระหว่างรออนุมัติ
  remaining: number | null; // total - used
  available: number | null; // total - used - reserved
  percentUsed: number;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function computeQuota(
  userId: string,
  fiscalYear: number,
  opts: { excludeRequestId?: number } = {}
): Promise<QuotaItem[]> {
  const prev = getFiscalRange(fiscalYear - 1);
  const cur = getFiscalRange(fiscalYear);

  const [types, reqRes] = await timed("db.quota", async () =>
    Promise.all([
      listLeaveTypes(),
      supabaseAdmin
        .from("leaverequest")
        .select("leave_request_id, leave_type_id, total_day, status, date_start")
        .eq("user_id", userId)
        .gte("date_start", prev.start)
        .lte("date_start", cur.end)
        .in("status", [...USED_STATUSES, ...RESERVED_STATUSES]),
    ])
  );
  if (reqRes.error) throw new HttpError(500, "QUOTA_FETCH_FAILED", reqRes.error.message);

  // key = `${typeId}:${fy}`
  const used = new Map<string, number>();
  const reserved = new Map<string, number>();
  for (const r of reqRes.data ?? []) {
    if (opts.excludeRequestId && r.leave_request_id === opts.excludeRequestId) continue;
    const key = `${r.leave_type_id}:${getFiscalYearFromISO(String(r.date_start))}`;
    const bucket = (USED_STATUSES as readonly string[]).includes(r.status) ? used : reserved;
    bucket.set(key, (bucket.get(key) ?? 0) + n(r.total_day));
  }

  return types.map((t) => {
    const max = t.max_leave_day;
    const unlimited = max === null || max === undefined;
    const carryMax = n(t.carry_over_max);

    const usedNow = used.get(`${t.leave_type_id}:${fiscalYear}`) ?? 0;
    const reservedNow = reserved.get(`${t.leave_type_id}:${fiscalYear}`) ?? 0;

    let carried = 0;
    if (!unlimited && carryMax > 0) {
      const prevUsed = used.get(`${t.leave_type_id}:${fiscalYear - 1}`) ?? 0;
      carried = Math.max(0, Math.min(Math.max(0, n(max) - prevUsed), carryMax));
    }

    const total = unlimited ? null : n(max) + carried;
    const remaining = total === null ? null : Math.max(0, total - usedNow);
    const available = total === null ? null : Math.max(0, total - usedNow - reservedNow);
    const percentUsed = total && total > 0 ? Math.min(100, +((usedNow / total) * 100).toFixed(2)) : 0;

    return {
      leave_type_id: t.leave_type_id,
      name: t.leave_type_name,
      note: t.note,
      max_leave_day: max ?? null,
      carry_over_max: t.carry_over_max ?? null,
      unlimited,
      carried,
      total,
      used: usedNow,
      reserved: reservedNow,
      remaining,
      available,
      percentUsed,
    };
  });
}

/** ตรวจว่าขอลา `days` วันได้หรือไม่ (ข้ามใบลาที่กำลังแก้ไขอยู่) */
export async function assertQuotaAvailable(args: {
  userId: string;
  leaveTypeId: number;
  fiscalYear: number;
  days: number;
  excludeRequestId?: number;
}): Promise<QuotaItem> {
  const items = await computeQuota(args.userId, args.fiscalYear, { excludeRequestId: args.excludeRequestId });
  const item = items.find((i) => i.leave_type_id === args.leaveTypeId);
  if (!item) throw new HttpError(404, "LEAVETYPE_NOT_FOUND");
  if (!item.unlimited && args.days > (item.available ?? 0)) {
    throw new HttpError(400, "INSUFFICIENT_QUOTA", { available: item.available });
  }
  return item;
}

/**
 * เขียน snapshot ลง userleavequota ให้ตรงกับ leaverequest (เรียกหลังเปลี่ยนสถานะ/สร้าง/ลบใบลาทุกครั้ง)
 * ล้มเหลวแล้วไม่ทำให้คำขอหลักล้ม เพราะค่าจริงคำนวณจาก leaverequest อยู่แล้ว
 */
export async function syncQuotaSnapshot(userId: string, leaveTypeId: number, fiscalYear: number): Promise<void> {
  try {
    const items = await computeQuota(userId, fiscalYear);
    const item = items.find((i) => i.leave_type_id === leaveTypeId);
    if (!item) return;

    const values = {
      total_used: item.used,
      total_remaining: item.total === null ? null : item.total - item.used,
      reserved: item.reserved,
    };

    const { data: existing, error: selErr } = await supabaseAdmin
      .from("userleavequota")
      .select("user_leave_quota_id")
      .eq("user_id", userId)
      .eq("leave_type_id", leaveTypeId)
      .eq("year", fiscalYear)
      .order("user_leave_quota_id", { ascending: true })
      .limit(1);
    if (selErr) throw selErr;

    if (existing && existing.length > 0) {
      const { error } = await supabaseAdmin
        .from("userleavequota")
        .update(values)
        .eq("user_leave_quota_id", existing[0].user_leave_quota_id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("userleavequota")
        .insert({ user_id: userId, leave_type_id: leaveTypeId, year: fiscalYear, ...values });
      if (error) throw error;
    }
  } catch (e) {
    console.error("[quota] snapshot sync failed", { userId, leaveTypeId, fiscalYear }, e);
  }
}
