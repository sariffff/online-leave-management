// ตรวจกฎของประเภทการลา (ตั้งค่าได้ในหน้า "ตั้งค่าระบบ → ประเภทการลา") — ฟังก์ชันล้วน ใช้ได้ทั้งฟอร์มและระบบหลังบ้าน
import { normalizeHalf } from "@/lib/leave/status";
import type { LeaveTypeRule } from "@/lib/settings-schema";

export type RuleInput = {
  start: string; // YYYY-MM-DD
  end: string;
  startType?: string | null;
  endType?: string | null;
  totalDays: number;
  fileCount: number;
  today: string; // YYYY-MM-DD ตามเวลาไทย
};

/** ผลที่ผิดกฎ: code ใช้กับ API, message แสดงผู้ใช้ */
export type RuleViolation = { code: string; message: string; detail?: Record<string, number> };

/**
 * ตรวจข้อใดบ้าง
 *  - timing: ยื่นล่วงหน้า/ย้อนหลัง (ปิดเมื่อแก้ใบลาโดยไม่เปลี่ยนวัน, ผอ.สร้างแทน)
 *  - documents: ต้องแนบเอกสาร (ปิดเมื่อ ผอ.สร้างแทน)
 */
export type RuleOptions = { timing?: boolean; documents?: boolean };

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** วันนี้ตามเวลาประเทศไทย (เซิร์ฟเวอร์อาจตั้งเป็น UTC) */
export const todayInThailand = (now = new Date()) => new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export function checkLeaveRules(rule: LeaveTypeRule, i: RuleInput, opts: RuleOptions = {}): RuleViolation[] {
  const { timing = true, documents = true } = opts;
  const out: RuleViolation[] = [];

  if (!rule.isActive) out.push({ code: "LEAVETYPE_INACTIVE", message: "ประเภทการลานี้ปิดใช้งานแล้ว" });

  const half = normalizeHalf(i.startType) !== "เต็มวัน" || (i.start !== i.end && normalizeHalf(i.endType) !== "เต็มวัน");
  if (!rule.allowHalfDay && half) out.push({ code: "HALF_DAY_NOT_ALLOWED", message: "ประเภทการลานี้ลาครึ่งวันไม่ได้" });

  if (rule.maxDaysPerRequest !== null && i.totalDays > rule.maxDaysPerRequest) {
    out.push({
      code: "EXCEEDS_MAX_PER_REQUEST",
      message: `ลาได้ครั้งละไม่เกิน ${rule.maxDaysPerRequest} วัน`,
      detail: { max: rule.maxDaysPerRequest },
    });
  }

  if (documents && rule.docRequiredAfterDays !== null && i.totalDays > rule.docRequiredAfterDays && i.fileCount === 0) {
    out.push({
      code: "DOCUMENT_REQUIRED",
      message: rule.docRequiredAfterDays === 0 ? "ประเภทการลานี้ต้องแนบเอกสาร" : `ลาเกิน ${rule.docRequiredAfterDays} วัน ต้องแนบเอกสาร`,
      detail: { after: rule.docRequiredAfterDays },
    });
  }

  if (timing) {
    const ahead = daysBetween(i.today, i.start); // บวก = ล่วงหน้า, ลบ = ย้อนหลัง
    if (rule.minNoticeDays !== null && rule.minNoticeDays > 0 && ahead < rule.minNoticeDays) {
      out.push({
        code: "NOTICE_TOO_SHORT",
        message: `ต้องยื่นล่วงหน้าอย่างน้อย ${rule.minNoticeDays} วัน`,
        detail: { days: rule.minNoticeDays },
      });
    }
    if (rule.maxBackdateDays !== null && -ahead > rule.maxBackdateDays) {
      out.push({
        code: "BACKDATE_TOO_FAR",
        message: rule.maxBackdateDays === 0 ? "ยื่นลาย้อนหลังไม่ได้" : `ยื่นลาย้อนหลังได้ไม่เกิน ${rule.maxBackdateDays} วัน`,
        detail: { days: rule.maxBackdateDays },
      });
    }
  }
  return out;
}

/** ข้อความสรุปกฎ สำหรับแสดงให้ผู้ยื่นเห็นก่อนกรอก */
export function describeRule(rule: LeaveTypeRule): string[] {
  const out: string[] = [];
  if (rule.maxDaysPerRequest !== null) out.push(`ลาได้ครั้งละไม่เกิน ${rule.maxDaysPerRequest} วัน`);
  if (rule.docRequiredAfterDays !== null) out.push(rule.docRequiredAfterDays === 0 ? "ต้องแนบเอกสารทุกครั้ง" : `ลาเกิน ${rule.docRequiredAfterDays} วัน ต้องแนบเอกสาร`);
  if (rule.minNoticeDays) out.push(`ต้องยื่นล่วงหน้าอย่างน้อย ${rule.minNoticeDays} วัน`);
  if (rule.maxBackdateDays !== null) out.push(rule.maxBackdateDays === 0 ? "ยื่นย้อนหลังไม่ได้" : `ยื่นย้อนหลังได้ไม่เกิน ${rule.maxBackdateDays} วัน`);
  if (!rule.allowHalfDay) out.push("ลาครึ่งวันไม่ได้");
  if (rule.countMode === "calendar") out.push("นับรวมวันหยุด");
  return out;
}
