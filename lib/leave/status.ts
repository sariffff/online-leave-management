// แหล่งความจริงเดียวของสถานะใบลา (ใช้ได้ทั้งฝั่ง client และ server)

export const LEAVE_STATUS = [
  "pending", // ยื่นแล้ว รอธุรการตรวจ
  "reviewed", // ธุรการตรวจผ่าน รอ ผอ.
  "failed", // ธุรการตรวจไม่ผ่าน (ผู้ยื่นแก้ไขแล้วส่งใหม่ได้)
  "approved", // ผอ. อนุมัติ
  "rejected", // ผอ. ไม่อนุมัติ
  "covered", // อนุมัติแล้ว และฝ่ายวิชาการจัดสอนแทนครบ
  "cancelled",
] as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[number];

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "รอพิจารณา",
  reviewed: "ตรวจสอบแล้ว (รออนุมัติ)",
  failed: "ไม่ผ่านการตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  covered: "อนุมัติ (จัดสอนแทนแล้ว)",
  cancelled: "ยกเลิก",
};

export const STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  covered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

/** สถานะที่ถือว่า "ใช้สิทธิ์ไปแล้ว" */
export const USED_STATUSES: readonly LeaveStatus[] = ["approved", "covered"];
/** สถานะที่ "กันสิทธิ์ไว้" ระหว่างรออนุมัติ */
export const RESERVED_STATUSES: readonly LeaveStatus[] = ["pending", "reviewed"];
/** ผู้ยื่นแก้ไข/ลบได้เฉพาะสถานะเหล่านี้ */
export const OWNER_EDITABLE: readonly LeaveStatus[] = ["pending", "failed"];

export function isLeaveStatus(v: unknown): v is LeaveStatus {
  return typeof v === "string" && (LEAVE_STATUS as readonly string[]).includes(v);
}

export function statusLabel(v: string | null | undefined): string {
  const s = (v ?? "pending").toLowerCase();
  return isLeaveStatus(s) ? STATUS_LABEL[s] : s;
}

export function statusBadge(v: string | null | undefined): string {
  const s = (v ?? "pending").toLowerCase();
  return isLeaveStatus(s) ? STATUS_BADGE[s] : STATUS_BADGE.cancelled;
}

/** ตัวเลือกครึ่งวัน (ค่าที่เก็บใน date_start_type / date_end_type) */
export const HALF_OPTIONS = ["เต็มวัน", "ครึ่งเช้า", "ครึ่งบ่าย"] as const;
export type HalfType = (typeof HALF_OPTIONS)[number];

/** รับได้ทั้งค่าไทยและ full/am/pm แล้วคืนค่าไทยมาตรฐาน */
export function normalizeHalf(v: string | null | undefined): HalfType {
  const s = (v ?? "").trim().toLowerCase();
  if (["am", "เช้า", "ครึ่งเช้า"].includes(s)) return "ครึ่งเช้า";
  if (["pm", "บ่าย", "ครึ่งบ่าย"].includes(s)) return "ครึ่งบ่าย";
  return "เต็มวัน";
}
