// วันที่แบบไทย: แปลงข้อความที่พิมพ์ ↔ ISO (lib/thaiDate.ts)
import { describe, expect, it } from "vitest";
import { formatThaiDate, longThai, parseThaiDate } from "@/lib/thaiDate";

describe("parseThaiDate / formatThaiDate", () => {
  it("TD-01 พ.ศ. วว/ดด/ปปปป → ISO และกลับ", () => {
    expect(parseThaiDate("16/11/2569")).toBe("2026-11-16");
    expect(parseThaiDate("1/2/2570")).toBe("2027-02-01");
    expect(formatThaiDate("2026-11-16")).toBe("16/11/2569");
  });
  it("TD-02 รับ ค.ศ., ISO, ขีด/จุด", () => {
    expect(parseThaiDate("16/11/2026")).toBe("2026-11-16");
    expect(parseThaiDate("2026-11-16")).toBe("2026-11-16");
    expect(parseThaiDate("16-11-2569")).toBe("2026-11-16");
    expect(parseThaiDate("16.11.2569")).toBe("2026-11-16");
  });
  it("TD-03 วันที่ไม่มีจริง/รูปแบบผิด → null", () => {
    expect(parseThaiDate("31/02/2569")).toBeNull();
    expect(parseThaiDate("29/02/2569")).toBeNull(); // 2026 ไม่ใช่ปีอธิกสุรทิน
    expect(parseThaiDate("29/02/2571")).toBe("2028-02-29");
    expect(parseThaiDate("16/13/2569")).toBeNull();
    expect(parseThaiDate("16/11")).toBeNull();
    expect(parseThaiDate("")).toBeNull();
    expect(formatThaiDate("bad")).toBe("");
  });
  it("TD-04 ชื่อเต็มสำหรับโปรแกรมอ่านหน้าจอ", () => {
    expect(longThai("2026-11-16")).toBe("16 พฤศจิกายน 2569");
  });
});
