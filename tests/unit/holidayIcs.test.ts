// อ่านปฏิทินวันหยุดไทย (.ics) — lib/services/holidayIcs.ts
import { describe, expect, it } from "vitest";
import { parseHolidayIcs } from "@/lib/services/holidayIcs";

const ev = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const ICS = [
  "BEGIN:VCALENDAR",
  ev(["DTSTART;VALUE=DATE:20270413", "DTEND;VALUE=DATE:20270414", "SUMMARY:วันสงกรานต์", "DESCRIPTION:วันหยุดนักขัตฤกษ์"]),
  ev(["DTSTART;VALUE=DATE:20270214", "DTEND;VALUE=DATE:20270215", "SUMMARY:วันวาเลนไทน์", "DESCRIPTION:วันสำคัญ\\nหากต้องการซ่อนวันสำคัญ"]),
  // event หลายวัน + SUMMARY ถูกพับบรรทัด (RFC 5545 folding) + ช่องว่างความกว้างศูนย์
  ev(["DTSTART;VALUE=DATE:20271230", "DTEND;VALUE=DATE:20280102", "SUMMARY:​วันหยุด", " ปีใหม่", "DESCRIPTION:วันหยุดนักขัตฤกษ์"]),
  ev(["DTSTART;VALUE=DATE:20270101", "SUMMARY:ซ้ำวันเดิม", "DESCRIPTION:วันหยุดนักขัตฤกษ์"]),
  ev(["DTSTART;VALUE=DATE:20270505", "SUMMARY:ถูกยกเลิก", "STATUS:CANCELLED", "DESCRIPTION:วันหยุดนักขัตฤกษ์"]),
  ev(["DTSTART;VALUE=DATE:20270506", "SUMMARY:ไม่มีคำอธิบาย"]),
  "END:VCALENDAR",
].join("\r\n");

describe("parseHolidayIcs", () => {
  const list = parseHolidayIcs(ICS);
  const dates = list.map((h) => h.date);

  it("HI-01 เก็บวันหยุดนักขัตฤกษ์", () => {
    expect(list).toContainEqual({ date: "2027-04-13", summary: "วันสงกรานต์" });
  });
  it("HI-02 ข้าม 'วันสำคัญ' (วาเลนไทน์)", () => {
    expect(dates).not.toContain("2027-02-14");
  });
  it("HI-03 event หลายวันแตกเป็นรายวัน (DTEND ไม่รวม) และต่อบรรทัดที่พับ + ลบ zero-width space", () => {
    expect(list.filter((h) => h.summary === "วันหยุดปีใหม่").map((h) => h.date)).toEqual(["2027-12-30", "2027-12-31", "2028-01-01"]);
  });
  it("HI-04 ไม่มี DTEND = วันเดียว, วันเดียวกันไม่ซ้ำ", () => {
    expect(dates.filter((d) => d === "2027-01-01").length).toBe(1);
  });
  it("HI-05 ข้าม event ที่ถูกยกเลิก และที่ไม่มีคำอธิบาย", () => {
    expect(dates).not.toContain("2027-05-05");
    expect(dates).not.toContain("2027-05-06");
  });
  it("HI-06 เรียงตามวันที่", () => {
    expect([...dates].sort()).toEqual(dates);
  });
  it("HI-07 ไฟล์ว่าง/ผิดรูปแบบ → []", () => {
    expect(parseHolidayIcs("")).toEqual([]);
    expect(parseHolidayIcs("<html>error</html>")).toEqual([]);
  });
});
