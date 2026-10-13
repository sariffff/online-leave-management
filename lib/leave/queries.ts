// query/DTO ของใบลาที่ใช้ร่วมกันหลาย route (ประวัติผู้ใช้, ธุรการ, ผอ., ฝ่ายวิชาการ, dashboard)
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { fullName, normalizeFiscalYear } from "@/lib/format";
import { statusLabel } from "@/lib/leave/status";
import { signFilesBatch, type LeaveFile } from "@/lib/leave/files";
import { getAuthUserMap } from "@/lib/services/authUsers";
import { getFiscalRange } from "@/utils/year";
import { escapeLike, toInt, toPosInt } from "@/lib/validate";
import { timed } from "@/lib/perf";
import type { LeaveRequestRow, UserRow } from "@/types/db";

type NameRow = Pick<UserRow, "prename" | "name" | "surname"> | null;

export const LEAVE_SELECT = `
  leave_request_id, user_id, leave_type_id, date_start, date_end, date_start_type, date_end_type,
  total_day, reason, file, timestamp, status, comment, year,
  reviewed_by, reviewed_at, approved_by, approved_at,
  leavetype:leave_type_id ( leave_type_name ),
  requester:users!leaverequest_user_id_fkey ( prename, name, surname ),
  reviewer:users!leaverequest_reviewed_by_fkey ( prename, name, surname ),
  approver:users!leaverequest_approved_by_fkey ( prename, name, surname )
`;

export type LeaveJoined = LeaveRequestRow & {
  leavetype: { leave_type_name: string | null } | null;
  requester: NameRow;
  reviewer: NameRow;
  approver: NameRow;
};

export type LeaveDTO = {
  id: string;
  userId: string;
  leaveTypeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type: string;
  date_end_type: string;
  totalDays: number;
  reason: string | null;
  comment: string | null;
  status_code: string;
  status: string; // ป้ายภาษาไทย
  year: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  reviewedBy: string | null; // ชื่อผู้ตรวจ
  approvedBy: string | null; // ชื่อผู้อนุมัติ
  files: LeaveFile[];
  user: { id: string; prename: string; name: string; surname: string; fullName: string; email: string };
};

export function toDTO(r: LeaveJoined, files: LeaveFile[] = [], email = ""): LeaveDTO {
  return {
    id: String(r.leave_request_id),
    userId: r.user_id,
    leaveTypeId: r.leave_type_id,
    leaveType: r.leavetype?.leave_type_name ?? "ไม่ระบุ",
    startDate: r.date_start,
    endDate: r.date_end,
    date_start_type: r.date_start_type ?? "เต็มวัน",
    date_end_type: r.date_end_type ?? "เต็มวัน",
    totalDays: Number(r.total_day ?? 0),
    reason: r.reason,
    comment: r.comment,
    status_code: r.status,
    status: statusLabel(r.status),
    year: r.year,
    submittedAt: r.timestamp,
    reviewedAt: r.reviewed_at,
    approvedAt: r.approved_at,
    reviewedBy: r.reviewer ? fullName(r.reviewer) : null,
    approvedBy: r.approver ? fullName(r.approver) : null,
    files,
    user: {
      id: r.user_id,
      prename: r.requester?.prename ?? "",
      name: r.requester?.name ?? "",
      surname: r.requester?.surname ?? "",
      fullName: fullName(r.requester),
      email,
    },
  };
}

/* ---------------- ตัวกรอง ---------------- */
export type LeaveFilters = {
  page: number;
  pageSize: number;
  fiscalYear: number | null; // ค.ศ.
  startDate: string | null;
  endDate: string | null;
  leaveTypeId: number | null;
  statuses: string[];
  q: string;
};

export function parseFilters(url: URL, defaults: { pageSize?: number; maxPageSize?: number } = {}): LeaveFilters {
  const sp = url.searchParams;
  const max = defaults.maxPageSize ?? 100;
  return {
    page: toInt(sp.get("page"), 1, 1, 100000),
    pageSize: toInt(sp.get("pageSize"), defaults.pageSize ?? 10, 1, max),
    fiscalYear: normalizeFiscalYear(sp.get("fiscalYear") || sp.get("year")),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(sp.get("startDate") ?? "") ? sp.get("startDate") : null,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(sp.get("endDate") ?? "") ? sp.get("endDate") : null,
    leaveTypeId: toPosInt(sp.get("leaveTypeId")),
    statuses: (sp.get("status") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    q: (sp.get("q") ?? "").trim().slice(0, 100),
  };
}

/** หา user_id ที่ชื่อ/นามสกุล/อีเมลตรงกับคำค้น (คืน null ถ้าไม่มีคำค้น) */
export async function matchUserIds(q: string): Promise<string[] | null> {
  if (!q) return null;
  const like = `%${escapeLike(q)}%`;
  const [byName, authMap] = await Promise.all([
    supabaseAdmin.from("users").select("user_id").or(`name.ilike.${like},surname.ilike.${like}`).limit(500),
    q.includes("@") || /^[a-z0-9._-]+$/i.test(q) ? getAuthUserMap() : Promise.resolve(null),
  ]);
  const ids = new Set<string>((byName.data ?? []).map((r) => r.user_id as string));
  if (authMap) {
    const lower = q.toLowerCase();
    for (const u of authMap.values()) if ((u.email ?? "").toLowerCase().includes(lower)) ids.add(u.id);
  }
  return [...ids];
}

type Builder = {
  gte: (c: string, v: string) => Builder;
  lte: (c: string, v: string) => Builder;
  eq: (c: string, v: string | number) => Builder;
  in: (c: string, v: readonly (string | number)[]) => Builder;
};

/** ใส่เงื่อนไขกรองมาตรฐาน (วันที่อิง date_start) */
export function applyFilters<T>(query: T, f: LeaveFilters, userIds: string[] | null): T {
  let q = query as unknown as Builder;
  if (f.fiscalYear) {
    const r = getFiscalRange(f.fiscalYear);
    q = q.gte("date_start", r.start).lte("date_start", r.end);
  }
  if (f.startDate) q = q.gte("date_start", f.startDate);
  if (f.endDate) q = q.lte("date_start", f.endDate);
  if (f.leaveTypeId) q = q.eq("leave_type_id", f.leaveTypeId);
  if (f.statuses.length) q = q.in("status", f.statuses);
  if (userIds) q = q.in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  return q as unknown as T;
}

export type Page<T> = { data: T[]; total: number; page: number; pageSize: number; totalPages: number };

/**
 * ดึงใบลาแบบแบ่งหน้าที่ฝั่ง DB + แนบไฟล์/อีเมลตามที่ขอ
 * `base` ใส่เงื่อนไขเฉพาะ route (เช่น user_id = ตัวเอง, status in (...))
 */
export async function queryLeaves(opts: {
  filters: LeaveFilters;
  base: (q: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  order?: { column: string; ascending: boolean };
  withFiles?: boolean;
  withEmail?: boolean;
  /** ไม่แบ่งหน้า (ใช้กับ dashboard) ใส่เพดานจำนวนแถว */
  unpaged?: number;
}): Promise<Page<LeaveDTO>> {
  const { filters: f } = opts;
  const userIds = await timed("search.users", () => matchUserIds(f.q));

  let q = supabaseAdmin.from("leaverequest").select(LEAVE_SELECT, { count: "exact" });
  q = opts.base(q);
  q = applyFilters(q, f, userIds);
  q = q.order(opts.order?.column ?? "leave_request_id", { ascending: opts.order?.ascending ?? false });

  if (opts.unpaged) {
    q = q.limit(opts.unpaged);
  } else {
    const from = (f.page - 1) * f.pageSize;
    q = q.range(from, from + f.pageSize - 1);
  }

  const { data, error, count } = await timed("db.leaverequest", async () => await q);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  const rows = (data ?? []) as unknown as LeaveJoined[];
  const [fileMap, authMap] = await Promise.all([
    opts.withFiles
      ? timed("storage.signUrls", () => signFilesBatch(rows.map((r) => ({ id: r.leave_request_id, user_id: r.user_id, file: r.file }))))
      : null,
    opts.withEmail ? timed("auth.listUsers", () => getAuthUserMap()) : null,
  ]);

  const items = rows.map((r) =>
    toDTO(r, fileMap?.get(String(r.leave_request_id)) ?? [], authMap?.get(r.user_id)?.email ?? "")
  );
  const total = count ?? items.length;
  const pageSize = opts.unpaged ? Math.max(items.length, 1) : f.pageSize;
  return { data: items, total, page: opts.unpaged ? 1 : f.page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
