// ตัวช่วยที่ไม่แตะฐานข้อมูล: สถานะ, validate, ปีงบ, รูปแบบชื่อ/วันที่, เบอร์โทร
import { describe, expect, it } from "vitest";
import { isLeaveStatus, normalizeHalf, statusBadge, statusLabel, STATUS_BADGE } from "@/lib/leave/status";
import { cleanStr, escapeLike, isISODate, toInt, toPosInt, UUID_RE } from "@/lib/validate";
import { getFiscalRange, getFiscalYearFromISO, isSameFiscalYear } from "@/utils/year";
import { fullName, normalizeFiscalYear, thaiDate } from "@/lib/format";
import { fromDbPhone, toE164 } from "@/utils/phone";
import { ROLE, ROLE_HOME } from "@/lib/roles";

describe("status", () => {
  it("S-01 isLeaveStatus", () => {
    expect(isLeaveStatus("approved")).toBe(true);
    expect(isLeaveStatus("APPROVED")).toBe(false);
    expect(isLeaveStatus("foo")).toBe(false);
    expect(isLeaveStatus(1)).toBe(false);
  });
  it("S-02 statusLabel ไม่สนตัวพิมพ์ และ null = รอพิจารณา", () => {
    expect(statusLabel("Approved")).toBe("อนุมัติ");
    expect(statusLabel(null)).toBe("รอพิจารณา");
    expect(statusLabel("unknown")).toBe("unknown");
  });
  it("S-03 statusBadge ค่าแปลก → สีเทา", () => {
    expect(statusBadge("weird")).toBe(STATUS_BADGE.cancelled);
  });
  it("S-04 normalizeHalf รับทั้งไทย/อังกฤษ", () => {
    expect(normalizeHalf("AM")).toBe("ครึ่งเช้า");
    expect(normalizeHalf(" บ่าย ")).toBe("ครึ่งบ่าย");
    expect(normalizeHalf(undefined)).toBe("เต็มวัน");
    expect(normalizeHalf("full")).toBe("เต็มวัน");
  });
});

describe("validate", () => {
  it("V-01 isISODate ตรวจวันที่จริง", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2026-1-01")).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
  it("V-02 toInt จำกัดช่วงและตัดทศนิยม", () => {
    expect(toInt("5.9", 1)).toBe(5);
    expect(toInt("abc", 7)).toBe(7);
    expect(toInt("-3", 1)).toBe(1);
    expect(toInt("999", 1, 1, 100)).toBe(100);
  });
  it("V-02b toInt ค่า null/ว่าง (พารามิเตอร์ที่ไม่ได้ส่ง) → ใช้ fallback", () => {
    expect(toInt(null, 10, 1, 100)).toBe(10);
    expect(toInt("", 10, 1, 100)).toBe(10);
    expect(toInt(undefined, 10, 1, 100)).toBe(10);
  });
  it("V-03 toPosInt", () => {
    expect(toPosInt("3")).toBe(3);
    expect(toPosInt("0")).toBeNull();
    expect(toPosInt("1.5")).toBeNull();
    expect(toPosInt(null)).toBeNull();
    expect(toPosInt("2147483647")).toBe(2147483647);
    expect(toPosInt("99999999999999999999")).toBeNull(); // เกิน integer ของ Postgres
  });
  it("V-04 cleanStr ตัดช่องว่างและความยาว / ไม่ใช่ string = ''", () => {
    expect(cleanStr("  ab  ")).toBe("ab");
    expect(cleanStr("abcdef", 3)).toBe("abc");
    expect(cleanStr(123)).toBe("");
  });
  it("V-05 escapeLike กันไวยากรณ์ PostgREST และ wildcard", () => {
    expect(escapeLike("a,b(c)")).toBe("a b c");
    expect(escapeLike("50%_x")).toBe("50\\%\\_x");
  });
  it("V-06 UUID_RE", () => {
    expect(UUID_RE.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(UUID_RE.test("not-a-uuid")).toBe(false);
  });
});

describe("fiscal year", () => {
  it("Y-01 ต.ค. ขึ้นปีงบใหม่", () => {
    expect(getFiscalYearFromISO("2026-09-30")).toBe(2026);
    expect(getFiscalYearFromISO("2026-10-01")).toBe(2027);
  });
  it("Y-02 ช่วงปีงบ", () => {
    expect(getFiscalRange(2027)).toEqual({ start: "2026-10-01", end: "2027-09-30" });
  });
  it("Y-03 isSameFiscalYear", () => {
    expect(isSameFiscalYear("2026-09-29", "2026-10-02")).toBe(false);
    expect(isSameFiscalYear("2026-10-01", "2027-09-30")).toBe(true);
  });
  it("Y-04 normalizeFiscalYear รับ พ.ศ./ค.ศ.", () => {
    expect(normalizeFiscalYear("2570")).toBe(2027);
    expect(normalizeFiscalYear(2027)).toBe(2027);
    expect(normalizeFiscalYear("")).toBeNull();
    expect(normalizeFiscalYear("abc")).toBeNull();
  });
});

describe("format", () => {
  it("F-01 fullName", () => {
    expect(fullName({ prename: "นาย", name: "สมชาย", surname: "ใจดี" })).toBe("นายสมชาย ใจดี");
    expect(fullName({ name: "ก", surname: null })).toBe("ก");
    expect(fullName(null)).toBe("");
  });
  it("F-02 thaiDate เป็น พ.ศ. ไม่เลื่อนวัน", () => {
    expect(thaiDate("2026-10-05")).toBe("5 ตุลาคม 2569");
    expect(thaiDate("2026-01-01", true)).toBe("1 ม.ค. 2569");
    expect(thaiDate("bad")).toBe("-");
  });
});

describe("phone", () => {
  it("P-01 toE164", () => {
    expect(toE164("081-234-5678")).toBe("66812345678");
    expect(toE164("+66812345678")).toBe("66812345678");
    expect(toE164("")).toBe("");
  });
  it("P-02 fromDbPhone", () => {
    expect(fromDbPhone("66812345678")).toBe("0812345678");
    expect(fromDbPhone("0812345678")).toBe("0812345678");
  });
});

describe("roles", () => {
  it("R-01 ทุกบทบาทมีหน้าแรก", () => {
    for (const r of Object.values(ROLE)) expect(ROLE_HOME[r]).toMatch(/^\//);
  });
});
