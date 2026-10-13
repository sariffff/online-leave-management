// การตั้งค่าระบบ: ค่าเริ่มต้น + การตรวจค่า (lib/settings-schema.ts)
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  acceptOf,
  checkAttachment,
  describeAttachments,
  SettingsError,
  defaultLeaveRule,
  mergeSettings,
  periodPartOf,
  validateAttachments,
  validateGeneral,
  validateLeaveRule,
  validatePeriods,
} from "@/lib/settings-schema";

const g = DEFAULT_SETTINGS.general;

describe("ค่าเริ่มต้น = พฤติกรรมเดิม", () => {
  it("ST-01 ไม่มีไฟล์ตั้งค่า → ได้ค่าเริ่มต้นทั้งหมด", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it("ST-02 ค่าเดิมที่เคยเขียนตายตัว", () => {
    expect(g.systemName).toBe("ระบบการลาของบุคลากร โรงเรียนบ้านตาสา");
    expect(g.approverTitle).toBe("ผู้อำนวยการโรงเรียนบ้านตาสา");
    expect(g.theme).toBe("blue");
    expect(DEFAULT_SETTINGS.leaveTypes["1"].docRequiredAfterDays).toBe(3); // ลาป่วยเกิน 3 วันแนบใบรับรองแพทย์
    expect(DEFAULT_SETTINGS.periods.periods).toHaveLength(6);
    expect(DEFAULT_SETTINGS.attachments).toEqual({ maxFileMB: 5, maxFiles: 5, kinds: ["pdf", "jpg", "png"] });
  });
  it("ST-03 ไฟล์ตั้งค่าเสีย/ค่าผิดรูป → ใช้ค่าเริ่มต้นเฉพาะหมวดที่เสีย", () => {
    const s = mergeSettings({ general: { systemName: "", theme: "rainbow" }, attachments: { maxFileMB: 5000 }, periods: { periods: [] } });
    expect(s.general).toEqual(g);
    expect(s.attachments).toEqual(DEFAULT_SETTINGS.attachments);
    expect(s.periods).toEqual(DEFAULT_SETTINGS.periods);
  });
  it("ST-04 บันทึกบางหมวด หมวดอื่นยังเป็นค่าเริ่มต้น", () => {
    const s = mergeSettings({ general: { ...g, systemName: "ระบบลา รร.ใหม่" } });
    expect(s.general.systemName).toBe("ระบบลา รร.ใหม่");
    expect(s.attachments).toEqual(DEFAULT_SETTINGS.attachments);
  });
  it("ST-05 ประเภทลาที่ไม่มีค่าเริ่มต้น (เพิ่มใหม่) ได้กฎว่าง", () => {
    expect(defaultLeaveRule(99)).toMatchObject({ isActive: true, maxDaysPerRequest: null, countMode: "working", allowHalfDay: true });
  });
});

describe("validateGeneral", () => {
  it("ST-10 ตัดช่องว่าง + เก็บค่าที่ไม่ได้ส่งไว้", () => {
    expect(validateGeneral({ systemName: "  ระบบลา  " }, g)).toEqual({ ...g, systemName: "ระบบลา" });
  });
  it("ST-11 ชื่อว่าง → error ภาษาไทย", () => {
    expect(() => validateGeneral({ systemName: "   " }, g)).toThrow(SettingsError);
    expect(() => validateGeneral({ systemName: "" }, g)).toThrow("กรุณากรอกชื่อระบบ");
  });
  it("ST-12 ยาวเกิน / สีไม่มีจริง / ลิงก์โลโก้ไม่ใช่ https → error", () => {
    expect(() => validateGeneral({ systemShortName: "x".repeat(41) }, g)).toThrow("ยาวเกิน");
    expect(() => validateGeneral({ theme: "rainbow" as never }, g)).toThrow("สี");
    expect(() => validateGeneral({ logoUrl: "javascript:alert(1)" }, g)).toThrow("โลโก้");
  });
  it("ST-13 ข้อความท้ายเมนูเว้นว่างได้", () => {
    expect(validateGeneral({ footerText: "" }, g).footerText).toBe("");
  });
});

describe("validateLeaveRule", () => {
  const prev = defaultLeaveRule(1);
  it("ST-20 ค่าว่าง = ไม่จำกัด, ส่ง null ลบค่าเดิมได้", () => {
    expect(validateLeaveRule({ maxDaysPerRequest: "" as never }, prev).maxDaysPerRequest).toBeNull();
    expect(validateLeaveRule({ docRequiredAfterDays: null }, prev).docRequiredAfterDays).toBeNull();
  });
  it("ST-21 ตัวเลขติดลบ/ทศนิยม/ครั้งละ 0 วัน → error", () => {
    expect(() => validateLeaveRule({ minNoticeDays: -1 }, prev)).toThrow();
    expect(() => validateLeaveRule({ maxBackdateDays: 1.5 }, prev)).toThrow();
    expect(() => validateLeaveRule({ maxDaysPerRequest: 0 }, prev)).toThrow();
  });
  it("ST-22 สี/วิธีนับวันไม่ถูกต้อง → error", () => {
    expect(() => validateLeaveRule({ color: "neon" }, prev)).toThrow();
    expect(() => validateLeaveRule({ countMode: "weekly" as never }, prev)).toThrow();
  });
});

describe("validatePeriods / periodPartOf", () => {
  const prev = DEFAULT_SETTINGS.periods;
  it("ST-30 เรียงเลขคาบใหม่ตามลำดับ", () => {
    const r = validatePeriods({ periods: [{ period_number: 9, start_time: "08:00", end_time: "09:00" }, { period_number: 3, start_time: "09:00", end_time: "10:00" }] }, prev);
    expect(r.periods.map((p) => p.period_number)).toEqual([1, 2]);
  });
  it("ST-31 เวลาผิดรูป / จบก่อนเริ่ม / คาบซ้อนกัน / ไม่มีคาบ → error", () => {
    expect(() => validatePeriods({ periods: [{ period_number: 1, start_time: "8:00", end_time: "09:00" }] }, prev)).toThrow("รูปแบบ");
    expect(() => validatePeriods({ periods: [{ period_number: 1, start_time: "09:00", end_time: "08:00" }] }, prev)).toThrow("หลังเวลาเริ่ม");
    expect(() =>
      validatePeriods({ periods: [{ period_number: 1, start_time: "08:00", end_time: "09:00" }, { period_number: 2, start_time: "08:30", end_time: "09:30" }] }, prev)
    ).toThrow("เริ่มก่อน");
    expect(() => validatePeriods({ periods: [] }, prev)).toThrow("1–12");
  });
  it("ST-32 ช่วงเช้า/บ่ายตามเวลาที่ตั้ง", () => {
    expect(periodPartOf(prev, 4)).toBe("am");
    expect(periodPartOf(prev, 5)).toBe("pm");
    expect(periodPartOf({ ...prev, afternoonStartsAt: "10:30" }, 4)).toBe("pm");
    expect(periodPartOf(prev, 1, "13:30:00")).toBe("pm"); // เวลาเริ่มของแถวตารางสอนมาก่อน
  });
});

describe("validateAttachments", () => {
  const prev = DEFAULT_SETTINGS.attachments;
  it("ST-40 ช่วงที่ยอมรับ", () => {
    expect(validateAttachments({ maxFileMB: 10, maxFiles: 3, kinds: ["pdf", "pdf", "heic"] }, prev)).toEqual({ maxFileMB: 10, maxFiles: 3, kinds: ["pdf", "heic"] });
  });
  it("ST-41 เกินเพดาน / ไม่มีชนิดไฟล์ / ชนิดแปลก → error หรือถูกตัดทิ้ง", () => {
    expect(() => validateAttachments({ maxFileMB: 50 }, prev)).toThrow();
    expect(() => validateAttachments({ maxFiles: 0 }, prev)).toThrow();
    expect(() => validateAttachments({ kinds: [] }, prev)).toThrow("อย่างน้อย 1");
    expect(() => validateAttachments({ kinds: ["exe" as never] }, prev)).toThrow("อย่างน้อย 1");
  });
});

describe("checkAttachment / acceptOf / describeAttachments", () => {
  const a = DEFAULT_SETTINGS.attachments;
  it("ค่าเริ่มต้น = PDF/JPG/PNG 5MB 5 ไฟล์ (เหมือนก่อนมีหน้าตั้งค่า)", () => {
    expect(describeAttachments(a)).toBe("PDF, JPG, PNG (สูงสุด 5MB ต่อไฟล์, ไม่เกิน 5 ไฟล์)");
    expect(acceptOf(a)).toContain(".jpeg");
    expect(checkAttachment(a, { name: "a.png", type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(checkAttachment(a, { name: "a.png", type: "image/png", size: 5 * 1024 * 1024 + 1 })?.code).toBe("FILE_TOO_LARGE");
    expect(checkAttachment(a, { name: "a.webp", type: "image/webp", size: 1 })?.message).toBe("a.webp ไม่ใช่ PDF, JPG, PNG");
  });
});
