// ตัวช่วย validate ขนาดเล็ก (ไม่พึ่ง library เพิ่ม)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** ค่าที่ไม่ได้ส่งมา (null/undefined/สตริงว่าง) ใช้ fallback — ระวัง Number(null) = 0 */
export function toInt(v: unknown, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** ไม่เกินช่วงของคอลัมน์ integer ใน Postgres */
const PG_INT_MAX = 2_147_483_647;

export function toPosInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= PG_INT_MAX ? n : null;
}

export function cleanStr(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * เตรียมคำค้นสำหรับ ilike ใน filter ของ PostgREST (.or(...))
 * ตัดอักขระที่เป็นไวยากรณ์ของ filter ( , ( ) " ) ออก และ escape ตัวแทนของ LIKE ( % _ \ )
 */
export function escapeLike(v: string): string {
  return v.replace(/[,()"]/g, " ").replace(/[%_\\]/g, (c) => `\\${c}`).trim();
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
