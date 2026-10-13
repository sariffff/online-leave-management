// คำนวณจำนวนวันลา (lib/leave/days.ts)
// ปฏิทินอ้างอิง: 2026-11-16 = จันทร์, 2026-11-21 = เสาร์, 2026-11-22 = อาทิตย์
import { describe, expect, it } from "vitest";
import { countLeaveDays, holidayMapFrom, isNonWorkingISO, isWeekendISO } from "@/lib/leave/days";

const H = holidayMapFrom([{ start: "2026-11-18", summary: "วันหยุดทดสอบ" }]); // พุธ

describe("isWeekendISO", () => {
  it("D-01 เสาร์/อาทิตย์ = true", () => {
    expect(isWeekendISO("2026-11-21")).toBe(true);
    expect(isWeekendISO("2026-11-22")).toBe(true);
  });
  it("D-02 จันทร์–ศุกร์ = false", () => {
    for (const d of ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) expect(isWeekendISO(d)).toBe(false);
  });
  it("D-03 isNonWorkingISO รวมวันหยุด", () => {
    expect(isNonWorkingISO("2026-11-18", H)).toBe(true);
    expect(isNonWorkingISO("2026-11-17", H)).toBe(false);
  });
});

describe("countLeaveDays", () => {
  it("D-10 วันเดียว เต็มวัน = 1", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-16" }).total).toBe(1);
  });
  it("D-11 วันเดียว ครึ่งเช้า/ครึ่งบ่าย = 0.5", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-16", startType: "ครึ่งเช้า" }).total).toBe(0.5);
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-16", startType: "pm" }).total).toBe(0.5);
  });
  it("D-12 จันทร์–ศุกร์ = 5", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-20" }).total).toBe(5);
  });
  it("D-13 ข้ามเสาร์-อาทิตย์ (ศุกร์–จันทร์) = 2 และรายการวันที่ตัดออก = 2", () => {
    const r = countLeaveDays({ start: "2026-11-20", end: "2026-11-23" });
    expect(r.total).toBe(2);
    expect(r.excluded.map((e) => e.date)).toEqual(["2026-11-21", "2026-11-22"]);
  });
  it("D-14 ตัดวันหยุดราชการ (จันทร์–ศุกร์ มีวันหยุดพุธ) = 4", () => {
    const r = countLeaveDays({ start: "2026-11-16", end: "2026-11-20", holidays: H });
    expect(r.total).toBe(4);
    expect(r.excluded).toEqual([{ date: "2026-11-18", isHoliday: true, name: "วันหยุดทดสอบ" }]);
  });
  it("D-15 ครึ่งบ่ายวันแรก + ครึ่งเช้าวันสุดท้าย (จันทร์–พุธ) = 2", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-18", startType: "ครึ่งบ่าย", endType: "ครึ่งเช้า" }).total).toBe(2);
  });
  it("D-16 ลาเฉพาะเสาร์-อาทิตย์ = 0", () => {
    expect(countLeaveDays({ start: "2026-11-21", end: "2026-11-22" }).total).toBe(0);
  });
  it("D-17 วันเดียวที่เป็นวันหยุด = 0", () => {
    expect(countLeaveDays({ start: "2026-11-18", end: "2026-11-18", holidays: H }).total).toBe(0);
  });
  it("D-18 วันสิ้นสุดก่อนวันเริ่ม = 0", () => {
    expect(countLeaveDays({ start: "2026-11-20", end: "2026-11-16" }).total).toBe(0);
  });
  it("D-19 ค่าว่าง = 0", () => {
    expect(countLeaveDays({ start: "", end: "" }).total).toBe(0);
  });
  it("D-20 ครึ่งวันบนวันเริ่มที่เป็นเสาร์ ไม่ถูกหักซ้ำ (เสาร์–จันทร์ ครึ่งเช้าเริ่ม) = 1", () => {
    expect(countLeaveDays({ start: "2026-11-21", end: "2026-11-23", startType: "ครึ่งเช้า" }).total).toBe(1);
  });
  it("D-21 ข้ามเดือน/ปี (31 ธ.ค. 2026 พฤ – 4 ม.ค. 2027 จ) = 3", () => {
    expect(countLeaveDays({ start: "2026-12-31", end: "2027-01-04" }).total).toBe(3);
  });
  it("D-22 ปีอธิกสุรทิน 28 ก.พ.–1 มี.ค. 2028 (จ–พ) = 3", () => {
    expect(countLeaveDays({ start: "2028-02-28", end: "2028-03-01" }).total).toBe(3);
  });
  it("D-23 ช่วงยาว 90 วันปฏิทิน ไม่ติดลูป/คำนวณถูก", () => {
    const r = countLeaveDays({ start: "2026-11-02", end: "2027-01-30" });
    expect(r.total).toBe(65); // จ 2 พ.ย. – ศ 29 ม.ค. = 13 สัปดาห์เต็ม
  });
  it("D-24 ค่าประเภทครึ่งวันที่ไม่รู้จัก → ถือเป็นเต็มวัน", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-16", startType: "xyz" }).total).toBe(1);
  });
  it("D-25 ลาวันเดียว ช่องวันสิ้นสุดเป็นครึ่งวันแต่วันเริ่มเต็มวัน → ใช้ค่าวันเริ่ม = 1", () => {
    expect(countLeaveDays({ start: "2026-11-16", end: "2026-11-16", endType: "ครึ่งเช้า" }).total).toBe(1);
  });
});

describe("partOfDay / leaveCoversPeriod", async () => {
  const { partOfDay, leaveCoversPeriod } = await import("@/lib/leave/days");
  const single = (t: string) => ({ date_start: "2026-11-16", date_end: "2026-11-16", date_start_type: t });
  const multi = { date_start: "2026-11-16", date_end: "2026-11-18", date_start_type: "ครึ่งบ่าย", date_end_type: "ครึ่งเช้า" };
  it("D-30 วันเดียว: เต็มวัน/ครึ่งเช้า/ครึ่งบ่าย", () => {
    expect(partOfDay(single("เต็มวัน"), "2026-11-16")).toBe("full");
    expect(partOfDay(single("ครึ่งเช้า"), "2026-11-16")).toBe("am");
    expect(partOfDay(single("ครึ่งบ่าย"), "2026-11-16")).toBe("pm");
    expect(partOfDay(single("เต็มวัน"), "2026-11-17")).toBeNull();
  });
  it("D-31 หลายวัน: วันแรกบ่าย / กลางเต็มวัน / วันสุดท้ายเช้า", () => {
    expect(partOfDay(multi, "2026-11-16")).toBe("pm");
    expect(partOfDay(multi, "2026-11-17")).toBe("full");
    expect(partOfDay(multi, "2026-11-18")).toBe("am");
  });
  it("D-33 leaveCoversPeriod", () => {
    expect(leaveCoversPeriod(single("ครึ่งบ่าย"), "2026-11-16", "am")).toBe(false);
    expect(leaveCoversPeriod(single("ครึ่งบ่าย"), "2026-11-16", "pm")).toBe(true);
    expect(leaveCoversPeriod(multi, "2026-11-17", "am")).toBe(true);
  });
});
