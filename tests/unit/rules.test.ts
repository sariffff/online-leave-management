// กฎของประเภทการลา (lib/leave/rules.ts) + นับวันแบบรวมวันหยุด
import { describe, expect, it } from "vitest";
import { checkLeaveRules, describeRule, todayInThailand } from "@/lib/leave/rules";
import { countLeaveDays, holidayMapFrom } from "@/lib/leave/days";
import { defaultLeaveRule, type LeaveTypeRule } from "@/lib/settings-schema";

const base: LeaveTypeRule = { ...defaultLeaveRule(99), description: "", color: "gray" };
const input = { start: "2026-11-16", end: "2026-11-17", startType: "เต็มวัน", endType: "เต็มวัน", totalDays: 2, fileCount: 0, today: "2026-11-10" };
const codes = (r: LeaveTypeRule, i = {}, o = {}) => checkLeaveRules(r, { ...input, ...i }, o).map((v) => v.code);

describe("checkLeaveRules", () => {
  it("LR-01 ไม่ตั้งกฎอะไร → ผ่านทุกกรณี", () => {
    expect(codes(base)).toEqual([]);
    expect(codes(base, { today: "2027-12-31", totalDays: 200, startType: "ครึ่งเช้า" })).toEqual([]);
  });
  it("LR-02 ประเภทที่ปิดใช้งาน", () => {
    expect(codes({ ...base, isActive: false })).toEqual(["LEAVETYPE_INACTIVE"]);
  });
  it("LR-03 ครั้งละไม่เกิน", () => {
    const r = { ...base, maxDaysPerRequest: 2 };
    expect(codes(r, { totalDays: 2 })).toEqual([]);
    expect(codes(r, { totalDays: 2.5 })).toEqual(["EXCEEDS_MAX_PER_REQUEST"]);
    expect(checkLeaveRules(r, { ...input, totalDays: 3 })[0].message).toBe("ลาได้ครั้งละไม่เกิน 2 วัน");
  });
  it("LR-04 ต้องแนบเอกสารเมื่อลาเกิน N วัน (ลาป่วยเดิม: เกิน 3 วัน)", () => {
    const sick = defaultLeaveRule(1);
    expect(codes(sick, { totalDays: 3 })).toEqual([]);
    expect(codes(sick, { totalDays: 3.5 })).toEqual(["DOCUMENT_REQUIRED"]);
    expect(codes(sick, { totalDays: 4, fileCount: 1 })).toEqual([]);
    expect(checkLeaveRules({ ...base, docRequiredAfterDays: 0 }, { ...input, totalDays: 0.5 })[0].message).toBe("ประเภทการลานี้ต้องแนบเอกสาร");
  });
  it("LR-05 ยื่นล่วงหน้าอย่างน้อย N วัน", () => {
    const r = { ...base, minNoticeDays: 3 };
    expect(codes(r, { today: "2026-11-13" })).toEqual([]); // ล่วงหน้า 3 วันพอดี
    expect(codes(r, { today: "2026-11-14" })).toEqual(["NOTICE_TOO_SHORT"]);
  });
  it("LR-06 ยื่นย้อนหลังได้ไม่เกิน N วัน / 0 = ห้ามย้อนหลัง", () => {
    expect(codes({ ...base, maxBackdateDays: 7 }, { today: "2026-11-23" })).toEqual([]); // ย้อน 7 วัน
    expect(codes({ ...base, maxBackdateDays: 7 }, { today: "2026-11-24" })).toEqual(["BACKDATE_TOO_FAR"]);
    expect(codes({ ...base, maxBackdateDays: 0 }, { today: "2026-11-16" })).toEqual([]); // วันเดียวกันได้
    expect(codes({ ...base, maxBackdateDays: 0 }, { today: "2026-11-17" })).toEqual(["BACKDATE_TOO_FAR"]);
  });
  it("LR-07 ลาครึ่งวันไม่ได้ (ทั้งวันแรกและวันสุดท้าย; วันเดียวดูแค่วันเริ่ม)", () => {
    const r = { ...base, allowHalfDay: false };
    expect(codes(r, { startType: "ครึ่งบ่าย" })).toEqual(["HALF_DAY_NOT_ALLOWED"]);
    expect(codes(r, { endType: "am" })).toEqual(["HALF_DAY_NOT_ALLOWED"]);
    expect(codes(r, { end: "2026-11-16", endType: "ครึ่งเช้า" })).toEqual([]);
  });
  it("LR-08 ผอ.สร้างแทน: ไม่ตรวจเวลายื่นและเอกสาร แต่ยังตรวจครั้งละไม่เกิน/ปิดใช้งาน", () => {
    const r = { ...base, minNoticeDays: 5, maxBackdateDays: 0, docRequiredAfterDays: 0, maxDaysPerRequest: 1, isActive: false };
    expect(codes(r, { today: "2026-12-31" }, { timing: false, documents: false })).toEqual(["LEAVETYPE_INACTIVE", "EXCEEDS_MAX_PER_REQUEST"]);
  });
  it("LR-09 แก้ใบลาโดยไม่เปลี่ยนวัน: ไม่ตรวจเวลายื่น (ใบที่ถูกตีกลับแก้ได้แม้เลยกำหนด)", () => {
    expect(codes({ ...base, maxBackdateDays: 0 }, { today: "2027-01-31" }, { timing: false })).toEqual([]);
  });
  it("LR-10 สรุปกฎเป็นข้อความ", () => {
    expect(describeRule(base)).toEqual([]);
    expect(describeRule({ ...base, maxDaysPerRequest: 15, minNoticeDays: 3, maxBackdateDays: 0, allowHalfDay: false, countMode: "calendar" })).toEqual([
      "ลาได้ครั้งละไม่เกิน 15 วัน",
      "ต้องยื่นล่วงหน้าอย่างน้อย 3 วัน",
      "ยื่นย้อนหลังไม่ได้",
      "ลาครึ่งวันไม่ได้",
      "นับรวมวันหยุด",
    ]);
  });
  it("LR-11 วันนี้ตามเวลาไทย (UTC 18:00 = วันถัดไปในไทย)", () => {
    expect(todayInThailand(new Date("2026-11-15T18:00:00Z"))).toBe("2026-11-16");
    expect(todayInThailand(new Date("2026-11-15T16:59:00Z"))).toBe("2026-11-15");
  });
});

describe("countLeaveDays แบบรวมวันหยุด (calendar)", () => {
  const H = holidayMapFrom([{ start: "2026-11-18", summary: "หยุด" }]);
  it("LR-20 จันทร์–อาทิตย์ = 7 วัน (ทำการ = 4 เพราะวันหยุดพุธ)", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-22", holidays: H, mode: "calendar" }).total).toBe(7);
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-22", holidays: H }).total).toBe(4);
  });
  it("LR-21 ลาวันเสาร์-อาทิตย์ได้เมื่อนับรวมวันหยุด + ไม่มีรายการวันที่ไม่นับ", () => {
    const r = countLeaveDays({ start: "2026-11-21", end: "2026-11-22", mode: "calendar" });
    expect(r).toEqual({ total: 2, excluded: [] });
  });
  it("LR-22 ครึ่งวันยังหักได้แม้วันแรกเป็นวันหยุด", () => {
    expect(countLeaveDays({ start: "2026-11-21", end: "2026-11-23", startType: "ครึ่งบ่าย", mode: "calendar" }).total).toBe(2.5);
  });
  it("LR-23 ลาคลอด 90 วันนับต่อเนื่อง", () => {
    expect(countLeaveDays({ start: "2026-11-01", end: "2027-01-29", mode: "calendar" }).total).toBe(90);
  });
});
