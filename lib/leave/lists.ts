// รายการใบลาแต่ละแบบ — ใช้ร่วมกันระหว่าง API route (ตอนกรอง/เปลี่ยนหน้า) และ Server Component (ข้อมูลหน้าแรกที่ส่งมากับ HTML)
import "server-only";
import { queryLeaves, parseFilters, type LeaveFilters, type LeaveDTO, type Page } from "@/lib/leave/queries";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";

/** ตัวกรองเริ่มต้น (หน้า 1, ไม่กรองอะไร) — ตรงกับค่าเริ่มต้นของฟอร์มค้นหาฝั่ง client */
export function emptyFilters(pageSize = 10): LeaveFilters {
  return parseFilters(new URL("http://local/"), { pageSize });
}

const withDefault = (f: LeaveFilters, statuses: string[]): LeaveFilters => ({
  ...f,
  statuses: f.statuses.length ? f.statuses : statuses,
});

/** ประวัติการลาของตัวเอง */
export const listOwnLeaves = (userId: string, f: LeaveFilters): Promise<Page<LeaveDTO>> =>
  queryLeaves({
    filters: f,
    base: (q) => q.eq("user_id", userId),
    order: { column: "timestamp", ascending: false },
    withFiles: true,
  });

/** คิวที่รอธุรการตรวจ */
export const listReviewQueue = (f: LeaveFilters) =>
  queryLeaves({
    filters: withDefault(f, ["pending"]),
    base: (q) => q,
    order: { column: "date_start", ascending: false },
    withFiles: true,
    withEmail: true,
  });

/** ประวัติที่ธุรการคนนี้ตรวจแล้ว */
export const listReviewedHistory = (reviewerId: string, f: LeaveFilters) =>
  queryLeaves({
    filters: withDefault(f, ["reviewed", "approved", "rejected", "failed", "covered"]),
    base: (q) => q.eq("reviewed_by", reviewerId),
    order: { column: "leave_request_id", ascending: false },
    withFiles: true,
    withEmail: true,
  });

/** คิวที่รอ ผอ.อนุมัติ */
export const listApproveQueue = (f: LeaveFilters) =>
  queryLeaves({
    filters: withDefault(f, ["reviewed"]),
    base: (q) => q,
    order: { column: "date_start", ascending: false },
    withFiles: true,
    withEmail: true,
  });

/** ประวัติการอนุมัติ/ไม่อนุมัติ */
export const listApprovedHistory = (directorId: string, f: LeaveFilters, mine = false) =>
  queryLeaves({
    filters: withDefault(f, ["approved", "covered", "rejected"]),
    base: (q) => (mine ? q.eq("approved_by", directorId) : q),
    order: { column: "leave_request_id", ascending: false },
    withFiles: true,
    withEmail: true,
  });

/** ใบลาของ "ครู" ที่อนุมัติแล้ว เพื่อจัดสอนแทน */
export async function listAcademicLeaves(f: LeaveFilters) {
  const { data, error } = await supabaseAdmin.from("teacher").select("user_id");
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  const teacherUserIds = (data ?? []).map((t) => t.user_id as string).filter(Boolean);

  return queryLeaves({
    filters: withDefault(f, ["approved", "covered"]),
    base: (q) => q.in("user_id", teacherUserIds.length ? teacherUserIds : ["00000000-0000-0000-0000-000000000000"]),
    order: { column: "date_start", ascending: false },
    withEmail: true,
  });
}

/** ใบลาของตัวเองในช่วงวันที่ (แดชบอร์ดส่วนตัว) */
export const listOwnLeavesInRange = (userId: string, filters: LeaveFilters, start: string, end: string) =>
  queryLeaves({
    filters: { ...filters, startDate: start, endDate: end, fiscalYear: null },
    base: (q) => q.eq("user_id", userId),
    order: { column: "date_start", ascending: false },
    unpaged: 2000,
  });

/** แปลงผลลัพธ์เป็นข้อมูลหน้าแรกที่ส่งให้ client — ถ้า query ล้มเหลวให้ client โหลดเองแทน (หน้าไม่พัง) */
export async function toInitial<T>(p: Promise<Page<T>>): Promise<{ data: T[]; total: number; totalPages: number } | undefined> {
  try {
    const r = await p;
    return { data: r.data, total: r.total, totalPages: r.totalPages };
  } catch (e) {
    console.error("[initial-data] load failed", e);
    return undefined;
  }
}
