// คำนวณโควตา (lib/leave/quota.ts) — จำลองตาราง leavetype/leaverequest ด้วย mock ของ supabaseAdmin
import { beforeEach, describe, expect, it, vi } from "vitest";

type Req = { leave_request_id: number; leave_type_id: number; total_day: number; status: string; date_start: string };
const db: { types: unknown[]; reqs: Req[] } = { types: [], reqs: [] };

vi.mock("@/lib/supabaseAdmin", () => {
  const chain = (rows: () => unknown[]) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const b = {
      select: () => b,
      order: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v || c === "user_id"), b),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      then: (res: (x: unknown) => unknown) =>
        res({ data: rows().filter((r) => filters.every((f) => f(r as Record<string, unknown>))), error: null }),
    };
    return b;
  };
  return {
    supabaseAdmin: {
      from: (t: string) => chain(() => (t === "leavetype" ? db.types : db.reqs)),
    },
  };
});

const { computeQuota, assertQuotaAvailable } = await import("@/lib/leave/quota");

const TYPES = [
  { leave_type_id: 1, leave_type_name: "ลาป่วย", max_leave_day: 60, carry_over_max: null, note: null },
  { leave_type_id: 3, leave_type_name: "ลาพักผ่อน", max_leave_day: 10, carry_over_max: 20, note: null },
  { leave_type_id: 6, leave_type_name: "ลาไปช่วยเหลือคู่สมรส", max_leave_day: null, carry_over_max: null, note: null },
];

let id = 1;
const req = (type: number, days: number, status: string, date: string): Req => ({
  leave_request_id: id++,
  leave_type_id: type,
  total_day: days,
  status,
  date_start: date,
});

beforeEach(() => {
  db.types = TYPES;
  db.reqs = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.now() + 120_000)); // ข้าม cache ประเภทลา 60 วินาที
  vi.useRealTimers();
});

const item = async (type: number, fy = 2027, opts = {}) => (await computeQuota("u1", fy, opts)).find((i) => i.leave_type_id === type)!;

describe("computeQuota", () => {
  it("Q-01 ไม่มีใบลา: ลาป่วย 60/60", async () => {
    const i = await item(1);
    expect(i).toMatchObject({ total: 60, used: 0, reserved: 0, remaining: 60, available: 60, unlimited: false });
  });
  it("Q-02 approved + covered นับเป็น used, pending + reviewed นับเป็น reserved", async () => {
    db.reqs = [
      req(1, 2, "approved", "2026-11-02"),
      req(1, 1, "covered", "2026-11-10"),
      req(1, 3, "pending", "2026-12-01"),
      req(1, 0.5, "reviewed", "2026-12-05"),
    ];
    const i = await item(1);
    expect(i).toMatchObject({ used: 3, reserved: 3.5, remaining: 57, available: 53.5 });
  });
  it("Q-03 rejected / failed / cancelled ไม่นับ", async () => {
    db.reqs = [req(1, 5, "rejected", "2026-11-02"), req(1, 5, "failed", "2026-11-02"), req(1, 5, "cancelled", "2026-11-02")];
    expect((await item(1)).used).toBe(0);
    expect((await item(1)).reserved).toBe(0);
  });
  it("Q-04 แยกตามปีงบจาก date_start (30 ก.ย. = ปีก่อน, 1 ต.ค. = ปีนี้)", async () => {
    db.reqs = [req(1, 2, "approved", "2026-09-30"), req(1, 4, "approved", "2026-10-01")];
    expect((await item(1, 2027)).used).toBe(4);
    expect((await item(1, 2026)).used).toBe(2);
  });
  it("Q-05 ไม่จำกัด (max_leave_day = null): total/remaining/available = null", async () => {
    db.reqs = [req(6, 5, "approved", "2026-11-02")];
    expect(await item(6)).toMatchObject({ unlimited: true, total: null, remaining: null, available: null, used: 5 });
  });
  it("Q-06 วันสะสมลาพักผ่อน: ปีก่อนใช้ 4 → สะสม 6 → สิทธิ์ 16", async () => {
    db.reqs = [req(3, 4, "approved", "2026-03-02")];
    expect(await item(3)).toMatchObject({ carried: 6, total: 16 });
  });
  it("Q-07 วันสะสมของผู้ที่ไม่มีประวัติปีก่อน → ได้สะสมเต็ม 10 (สิทธิ์ 20)", async () => {
    // บันทึก: ระบบไม่รู้ว่าบุคลากรเริ่มงานเมื่อไร คนที่เพิ่งเข้าปีนี้จะได้ 20 วันทันที
    expect(await item(3)).toMatchObject({ carried: 10, total: 20 });
  });
  it("Q-08 สะสมนับเฉพาะ used ปีก่อน (pending ปีก่อนไม่หักวันสะสม)", async () => {
    db.reqs = [req(3, 10, "pending", "2026-03-02")];
    expect((await item(3)).carried).toBe(10);
  });
  it("Q-09 excludeRequestId ข้ามใบที่กำลังแก้", async () => {
    const r = req(1, 5, "pending", "2026-11-02");
    db.reqs = [r];
    expect((await item(1, 2027, { excludeRequestId: r.leave_request_id })).reserved).toBe(0);
  });
  it("Q-10 percentUsed ไม่เกิน 100 และ remaining ไม่ติดลบ", async () => {
    db.reqs = [req(1, 70, "approved", "2026-11-02")];
    expect(await item(1)).toMatchObject({ percentUsed: 100, remaining: 0, available: 0 });
  });
});

describe("assertQuotaAvailable", () => {
  it("Q-20 พอ → ผ่าน", async () => {
    await expect(assertQuotaAvailable({ userId: "u1", leaveTypeId: 1, fiscalYear: 2027, days: 60 })).resolves.toBeTruthy();
  });
  it("Q-21 เกิน → INSUFFICIENT_QUOTA 400", async () => {
    db.reqs = [req(1, 58, "approved", "2026-11-02")];
    await expect(assertQuotaAvailable({ userId: "u1", leaveTypeId: 1, fiscalYear: 2027, days: 3 })).rejects.toMatchObject({
      status: 400,
      message: "INSUFFICIENT_QUOTA",
    });
  });
  it("Q-22 ไม่จำกัด → ผ่านเสมอ", async () => {
    await expect(assertQuotaAvailable({ userId: "u1", leaveTypeId: 6, fiscalYear: 2027, days: 999 })).resolves.toBeTruthy();
  });
  it("Q-23 ประเภทที่ไม่มี → 404", async () => {
    await expect(assertQuotaAvailable({ userId: "u1", leaveTypeId: 99, fiscalYear: 2027, days: 1 })).rejects.toMatchObject({ status: 404 });
  });
});
