// ประเภทการลามาจาก /api/leave-types พร้อมกฎ/คำอธิบาย/สีที่ผู้ดูแลตั้งไว้ — ไฟล์นี้แปลงเป็นคลาสสีสำหรับแสดงผล
import type { LeaveTypeWithRule } from "@/types/db";
import type { HalfType } from "@/lib/leave/status";
import { LEAVE_COLORS, type LeaveColor } from "@/lib/settings-schema";

export type LeaveType = LeaveTypeWithRule & { description: string; color: string; bgColor: string };

export function toLeaveType(row: LeaveTypeWithRule): LeaveType {
  const c = LEAVE_COLORS[row.rule.color as LeaveColor] ?? LEAVE_COLORS.gray;
  return { ...row, description: row.rule.description, color: c.chip, bgColor: c.card };
}

/** ข้อความสิทธิ์ เช่น "60 วัน/ปี" หรือ "ไม่จำกัดโควตา" */
export function limitText(t: Pick<LeaveTypeWithRule, "max_leave_day">): string {
  return t.max_leave_day === null ? "ไม่จำกัดโควตา" : `${t.max_leave_day} วัน/ปี`;
}

export type UILeaveFormData = {
  startDate: string;
  endDate: string;
  startType: HalfType;
  endType: HalfType;
  totalDays: number;
  reason: string;
  attachments: File[];
};

export function toFormData(ui: UILeaveFormData, leaveTypeId: number): FormData {
  const fd = new FormData();
  fd.append("leave_type_id", String(leaveTypeId));
  fd.append("date_start", ui.startDate);
  fd.append("date_end", ui.endDate);
  fd.append("date_start_type", ui.startType);
  fd.append("date_end_type", ui.endType);
  fd.append("total_day", String(ui.totalDays));
  fd.append("reason", ui.reason);
  for (const f of ui.attachments) fd.append("file", f);
  return fd;
}
