// ปีงบไทย: 1 ต.ค. - 30 ก.ย.
export const FISCAL_START_MONTH = 10; // ตุลาคม

/** สร้าง Date แบบไม่โดน timezone เล่นงาน (ใช้ UTC) จาก 'YYYY-MM-DD' */
function dateOnlyUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** รับ Date → คืนปีงบ (เช่น 2025) */
export function getFiscalYear(d: Date, startMonth = FISCAL_START_MONTH): number {
  const month = d.getUTCMonth() + 1; // 1..12
  const year = d.getUTCFullYear();
  return month >= startMonth ? year + 1 : year;
}

/** รับ 'YYYY-MM-DD' → คืนปีงบ */
export function getFiscalYearFromISO(iso: string, startMonth = FISCAL_START_MONTH): number {
  return getFiscalYear(dateOnlyUTC(iso), startMonth);
}

/** ให้ช่วงวันที่ของปีงบนั้น (ISO: 'YYYY-MM-DD') */
export function getFiscalRange(fy: number, startMonth = FISCAL_START_MONTH) {
  // ตัวอย่าง: FY2025 => 2024-10-01 ถึง 2025-09-30
  const startCalYear = fy - 1;
  const start = new Date(Date.UTC(startCalYear, startMonth - 1, 1)); // Oct 1 (UTC)
  const end = new Date(Date.UTC(startCalYear + 1, startMonth - 1, 1)); // Oct 1 next year
  end.setUTCDate(end.getUTCDate() - 1); // Sep 30
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

/** true ถ้า start และ end อยู่ปีงบเดียวกัน */
export function isSameFiscalYear(startISO: string, endISO: string, startMonth = FISCAL_START_MONTH) {
  return getFiscalYearFromISO(startISO, startMonth) === getFiscalYearFromISO(endISO, startMonth);
}
