// ฟังก์ชันล้วนในไฟล์แนบ (lib/leave/files.ts) และตารางสอน (lib/services/schedule.ts)
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: {} }));

const { parseFileField, serializeFileField, toStorageKey, fileDisplayName, validateUploads, MAX_FILE_BYTES } = await import(
  "@/lib/leave/files"
);
const { eachDate, teachingDow, coverageOf, hhmm } = await import("@/lib/services/schedule");
const { parseFilters } = await import("@/lib/leave/queries");

const fakeFile = (name: string, type: string, size: number) => ({ name, type, size }) as unknown as File;

describe("files", () => {
  it("FL-01 parseFileField รองรับ JSON array / string เดี่ยว / ค่าว่าง", () => {
    expect(parseFileField('["a.pdf","b.png"]')).toEqual(["a.pdf", "b.png"]);
    expect(parseFileField("x.pdf")).toEqual(["x.pdf"]);
    expect(parseFileField('"x.pdf"')).toEqual(["x.pdf"]);
    expect(parseFileField("")).toEqual([]);
    expect(parseFileField(null)).toEqual([]);
    expect(parseFileField(["a", ""])).toEqual(["a"]);
    expect(parseFileField("[broken")).toEqual(["[broken"]);
  });
  it("FL-02 serializeFileField", () => {
    expect(serializeFileField([])).toBeNull();
    expect(serializeFileField(["a"])).toBe('["a"]');
  });
  it("FL-03 toStorageKey: ชื่อไฟล์เปล่า → public/<owner>/", () => {
    expect(toStorageKey("a.pdf", "U")).toBe("public/U/a.pdf");
    expect(toStorageKey("/public/X/a.pdf", "U")).toBe("public/X/a.pdf");
    expect(toStorageKey("  ", "U")).toBe("");
  });
  it("FL-04 fileDisplayName ถอด URL encoding", () => {
    expect(fileDisplayName("public/U/%E0%B8%81.pdf?x=1")).toBe("ก.pdf");
  });
  it("FL-05 validateUploads: ชนิด/ขนาด/จำนวน", () => {
    expect(() => validateUploads([fakeFile("a.pdf", "application/pdf", 10)])).not.toThrow();
    expect(() => validateUploads([fakeFile("a.exe", "application/x-msdownload", 10)])).toThrow("FILE_TYPE_NOT_ALLOWED");
    expect(() => validateUploads([fakeFile("a.pdf", "application/pdf", MAX_FILE_BYTES + 1)])).toThrow("FILE_TOO_LARGE");
    expect(() => validateUploads(Array.from({ length: 6 }, (_, i) => fakeFile(`${i}.pdf`, "application/pdf", 1)))).toThrow(
      "TOO_MANY_FILES"
    );
  });
});

describe("schedule helpers", () => {
  it("SC-01 eachDate รวมปลายทั้งสองด้าน / ช่วงผิด = []", () => {
    expect(eachDate("2026-11-30", "2026-12-02")).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(eachDate("2026-12-02", "2026-11-30")).toEqual([]);
    expect(eachDate("bad", "2026-11-30")).toEqual([]);
  });
  it("SC-02 eachDate จำกัด 400 วัน", () => {
    expect(eachDate("2020-01-01", "2030-01-01").length).toBe(400);
  });
  it("SC-03 teachingDow จ=1 … ศ=5, เสาร์/อาทิตย์ = null", () => {
    expect(teachingDow("2026-11-16")).toBe(1);
    expect(teachingDow("2026-11-20")).toBe(5);
    expect(teachingDow("2026-11-21")).toBeNull();
  });
  it("SC-04 coverageOf", () => {
    const slot = (id: number, sub: string | null) => ({
      teachingScheduleId: id,
      period: id,
      time: "",
      subject: "",
      room: "",
      substituteUserId: sub,
      substituteName: null,
    });
    const r = coverageOf([{ date: "2026-11-16", weekday: 1, slots: [slot(1, "x"), slot(2, null)] }]);
    expect(r).toMatchObject({ required: 2, assigned: 1, complete: false, missing: [{ date: "2026-11-16", tsId: 2, period: 2 }] });
    expect(coverageOf([]).complete).toBe(true);
  });
  it("SC-05 hhmm", () => {
    expect(hhmm("08:50:00")).toBe("08:50");
    expect(hhmm(null)).toBe("");
  });
});

describe("parseFilters", () => {
  it("PF-01 ค่าเริ่มต้นและการจำกัด pageSize", () => {
    const f = parseFilters(new URL("http://x/?pageSize=9999&page=-1"), { pageSize: 10, maxPageSize: 100 });
    expect(f).toMatchObject({ page: 1, pageSize: 100, statuses: [], q: "", fiscalYear: null });
  });
  it("PF-03 ไม่ส่ง page/pageSize เลย → ใช้ค่าเริ่มต้น (หน้า 1, pageSize ตามที่กำหนด)", () => {
    const f = parseFilters(new URL("http://x/"), { pageSize: 8 });
    expect(f.page).toBe(1);
    expect(f.pageSize).toBe(8);
  });
  it("PF-02 แปลงสถานะ/ปี พ.ศ./วันที่", () => {
    const f = parseFilters(new URL("http://x/?status=Approved,%20covered&year=2570&startDate=2026-10-01&endDate=bad&leaveTypeId=3"));
    expect(f).toMatchObject({ statuses: ["approved", "covered"], fiscalYear: 2027, startDate: "2026-10-01", endDate: null, leaveTypeId: 3 });
  });
});
