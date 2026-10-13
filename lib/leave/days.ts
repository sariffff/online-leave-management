// คำนวณจำนวนวันลา — ใช้ร่วมกันทั้งฟอร์มยื่นลา, แก้ไขใบลา, ผอ.สร้างใบลา และ server
import { normalizeHalf } from "@/lib/leave/status";

export type ExcludedDay = { date: string; isHoliday: boolean; name: string };
export type HolidayMap = ReadonlyMap<string, string>; // YYYY-MM-DD -> ชื่อวันหยุด

const DAY_MS = 86_400_000;

function parseISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isWeekendISO(iso: string): boolean {
  const dow = new Date(parseISO(iso)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function isNonWorkingISO(iso: string, holidays?: HolidayMap): boolean {
  return isWeekendISO(iso) || !!holidays?.has(iso);
}

export function holidayMapFrom(list: ReadonlyArray<{ start: string; summary?: string | null }>): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of list) if (h.start) m.set(h.start.slice(0, 10), h.summary || "วันหยุดราชการ");
  return m;
}

/**
 * นับวันทำการ (ตัดเสาร์-อาทิตย์และวันหยุด) พร้อมหักครึ่งวันของวันแรก/วันสุดท้าย
 * คำนวณด้วย UTC เพื่อไม่ให้ timezone ทำให้วันเลื่อน
 */
export function countLeaveDays(input: {
  start: string;
  end: string;
  startType?: string | null;
  endType?: string | null;
  holidays?: HolidayMap;
}): { total: number; excluded: ExcludedDay[] } {
  const { start, end, holidays } = input;
  if (!start || !end) return { total: 0, excluded: [] };

  const s = parseISO(start);
  const e = parseISO(end);
  if (Number.isNaN(s) || Number.isNaN(e) || s > e) return { total: 0, excluded: [] };

  let working = 0;
  const excluded: ExcludedDay[] = [];

  for (let t = s; t <= e; t += DAY_MS) {
    const iso = toISO(t);
    if (isWeekendISO(iso)) {
      excluded.push({ date: iso, isHoliday: false, name: "วันหยุดสุดสัปดาห์" });
    } else if (holidays?.has(iso)) {
      excluded.push({ date: iso, isHoliday: true, name: holidays.get(iso) || "วันหยุดราชการ" });
    } else {
      working += 1;
    }
  }

  if (working === 0) return { total: 0, excluded };

  const startType = normalizeHalf(input.startType);
  const endType = normalizeHalf(input.endType);

  if (start === end) {
    // วันเดียว: ใช้ประเภทของวันเริ่มเท่านั้น (ช่องวันสิ้นสุดถูกปิดในฟอร์ม)
    return { total: startType === "เต็มวัน" ? 1 : 0.5, excluded };
  }

  if (startType !== "เต็มวัน" && !isNonWorkingISO(start, holidays)) working -= 0.5;
  if (endType !== "เต็มวัน" && !isNonWorkingISO(end, holidays)) working -= 0.5;

  return { total: Math.max(0, Math.round(working * 2) / 2), excluded };
}

/* ---------------- ครึ่งวัน: ใช้ตรวจวันลาทับกันและคาบที่ต้องสอนแทน ---------------- */
export type LeaveSpan = {
  date_start: string;
  date_end: string;
  date_start_type?: string | null;
  date_end_type?: string | null;
};
export type DayPart = "full" | "am" | "pm";

/** ช่วงที่ลาในวันนั้น (null = ไม่ได้ลา) — หลายวัน: วันแรกครึ่งวัน = เริ่มตอนบ่าย, วันสุดท้ายครึ่งวัน = ลาถึงเที่ยง */
export function partOfDay(l: LeaveSpan, date: string): DayPart | null {
  if (date < l.date_start || date > l.date_end) return null;
  const st = normalizeHalf(l.date_start_type);
  const et = normalizeHalf(l.date_end_type);
  if (l.date_start === l.date_end) return st === "ครึ่งเช้า" ? "am" : st === "ครึ่งบ่าย" ? "pm" : "full";
  if (date === l.date_start && st !== "เต็มวัน") return "pm";
  if (date === l.date_end && et !== "เต็มวัน") return "am";
  return "full";
}

/** คาบนี้อยู่ช่วงเช้าหรือบ่าย — ใช้เวลาเริ่มถ้ามี ไม่งั้นใช้เลขคาบ (คาบ 1–4 เช้า ตาม lib/periods.ts) */
export function periodPart(period: number, startTime?: string | null): "am" | "pm" {
  if (startTime && /^\d{2}:\d{2}/.test(startTime)) return startTime.slice(0, 5) < "12:00" ? "am" : "pm";
  return period <= 4 ? "am" : "pm";
}

/** ใบลานี้ทำให้ไม่อยู่ในคาบนั้นหรือไม่ */
export function leaveCoversPeriod(l: LeaveSpan, date: string, part: "am" | "pm"): boolean {
  const p = partOfDay(l, date);
  return p === "full" || p === part;
}
