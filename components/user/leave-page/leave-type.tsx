// ข้อมูลประเภทการลามาจากฐานข้อมูล (/api/leave-types) — ไฟล์นี้เก็บเฉพาะ "หน้าตา" ของแต่ละประเภท
import type { LeaveTypeRow } from "@/types/db";
import type { HalfType } from "@/lib/leave/status";

type Look = { description: string; color: string; bgColor: string };

/** คีย์ = leave_type_id ใน DB; ประเภทที่ไม่มีในนี้จะใช้ DEFAULT_LOOK */
const LOOK: Record<number, Look> = {
  1: { description: "การลาเนื่องจากเจ็บป่วย (เกิน 3 วันต้องมีใบรับรองแพทย์)", color: "bg-red-100 text-red-800", bgColor: "bg-red-50" },
  2: { description: "การลาเพื่อจัดการธุระส่วนตัว", color: "bg-blue-100 text-blue-800", bgColor: "bg-blue-50" },
  3: { description: "การลาพักผ่อนประจำปี", color: "bg-green-100 text-green-800", bgColor: "bg-green-50" },
  4: { description: "การลาเพื่อคลอดบุตรสำหรับข้าราชการหญิง", color: "bg-pink-100 text-pink-800", bgColor: "bg-pink-50" },
  5: { description: "การลาเพื่อเลี้ยงดูบุตรหลังคลอด", color: "bg-purple-100 text-purple-800", bgColor: "bg-purple-50" },
  6: { description: "การลาไปช่วยเหลือภริยา/คู่สมรสที่คลอดบุตร", color: "bg-indigo-100 text-indigo-800", bgColor: "bg-indigo-50" },
  7: { description: "การลาเพื่อเกณฑ์ทหาร หรือเข้ารับการศึกษาวิชาทหาร", color: "bg-yellow-100 text-yellow-800", bgColor: "bg-yellow-50" },
  8: { description: "การลาเพื่อเพิ่มพูนความรู้ที่เป็นประโยชน์ต่อราชการ", color: "bg-teal-100 text-teal-800", bgColor: "bg-teal-50" },
  9: { description: "การลาเพื่ออุปสมบทหรือไปประกอบพิธีฮัจย์", color: "bg-orange-100 text-orange-800", bgColor: "bg-orange-50" },
  10: { description: "การลาเพื่อปฏิบัติงานระหว่างประเทศที่เป็นประโยชน์", color: "bg-cyan-100 text-cyan-800", bgColor: "bg-cyan-50" },
  11: { description: "การลาไปติดตามคู่สมรสที่ไปปฏิบัติงานในสถานที่อื่น", color: "bg-gray-100 text-gray-800", bgColor: "bg-gray-50" },
};

const DEFAULT_LOOK: Look = { description: "", color: "bg-slate-100 text-slate-800", bgColor: "bg-slate-50" };

export type LeaveType = LeaveTypeRow & Look;

export function toLeaveType(row: LeaveTypeRow): LeaveType {
  return { ...row, ...(LOOK[row.leave_type_id] ?? DEFAULT_LOOK) };
}

/** ข้อความสิทธิ์ เช่น "60 วัน/ปี" หรือ "ตามที่ได้รับอนุมัติ" */
export function limitText(t: Pick<LeaveTypeRow, "max_leave_day" | "note">): string {
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
