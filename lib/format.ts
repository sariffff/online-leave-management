// ตัวช่วยจัดรูปแบบที่ใช้ร่วมกันทั้ง client และ server

export type NameParts = { prename?: string | null; name?: string | null; surname?: string | null } | null | undefined;

/** "นายสมชาย ใจดี" — prename ติดชื่อ, เว้นวรรคก่อนนามสกุล */
export function fullName(u: NameParts): string {
  if (!u) return "";
  return `${u.prename ?? ""}${u.name ?? ""} ${u.surname ?? ""}`.replace(/\s+/g, " ").trim();
}

export const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "5 ตุลาคม 2568" จาก 'YYYY-MM-DD' (ไม่ผ่าน Date เพื่อกัน timezone เลื่อนวัน) */
export function thaiDate(iso: string | null | undefined, short = false): string {
  const p = parts(iso ?? "");
  if (!p) return "-";
  const month = short ? TH_MONTHS_SHORT[p.m - 1] : TH_MONTHS_FULL[p.m - 1];
  return `${p.d} ${month} ${p.y + 543}`;
}

/** ปีงบ ค.ศ. ← ค่าที่ผู้ใช้กรอก (รับทั้ง พ.ศ. และ ค.ศ.) */
export function normalizeFiscalYear(input: string | number | null | undefined): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 2400 ? n - 543 : n;
}
