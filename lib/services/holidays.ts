// วันหยุด = วันหยุดนักขัตฤกษ์ไทย (ปฏิทินสาธารณะของ Google แบบ .ics — ฟรี ไม่ต้องใช้คีย์) + ตาราง holiday (วันหยุดสถานศึกษาที่ admin เพิ่ม)
// เดิมใช้ Google Calendar API ผ่าน service account ซึ่งคีย์ใช้ไม่ได้แล้ว (invalid_grant) และนับ "วันสำคัญ" (วาเลนไทน์/ตรุษจีน/คริสต์มาส) เป็นวันหยุดด้วย
// มี cache ในหน่วยความจำ เพราะแทบทุกหน้าจอเรียกขอวันหยุดของทั้งปี — ไฟล์เดียวครอบคลุมหลายปี จึงโหลดครั้งเดียว
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { holidayMapFrom, type HolidayMap } from "@/lib/leave/days";
import { parseHolidayIcs, THAI_HOLIDAY_ICS_URL } from "@/lib/services/holidayIcs";
import { timed } from "@/lib/perf";

export type Holiday = {
  start: string; // YYYY-MM-DD (วันหยุดหลายวันถูกแตกเป็นทีละวัน)
  end: string;
  summary: string;
  source: "google" | "school";
};

/** เปลี่ยนแหล่งได้ด้วย env (ต้องเป็น .ics ที่มี DESCRIPTION แบบเดียวกัน) */
const ICS_URL = process.env.HOLIDAY_ICS_URL || THAI_HOLIDAY_ICS_URL;
const TTL_MS = 6 * 60 * 60 * 1000;
/** จำความล้มเหลวไว้ช่วงหนึ่ง ไม่ให้ทุกคำขอรอเครือข่ายซ้ำ */
const FAIL_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let feed: { at: number; list: Holiday[] } | null = null;
let failedAt = 0;
let inflight: Promise<Holiday[]> | null = null;

async function fetchFeed(): Promise<Holiday[]> {
  const res = await fetch(ICS_URL, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = parseHolidayIcs(await res.text());
  if (list.length === 0) throw new Error("ไฟล์ปฏิทินไม่มีวันหยุดนักขัตฤกษ์");
  return list.map((h) => ({ start: h.date, end: h.date, summary: h.summary, source: "google" as const }));
}

/** วันหยุดราชการทั้งหมดในไฟล์ (ok = false เมื่อโหลดไม่สำเร็จและไม่มีข้อมูลเก่าในหน่วยความจำ) */
async function publicHolidays(): Promise<{ list: Holiday[]; ok: boolean }> {
  if (feed && Date.now() - feed.at < TTL_MS) return { list: feed.list, ok: true };
  if (failedAt && Date.now() - failedAt < FAIL_TTL_MS) return { list: feed?.list ?? [], ok: !!feed };

  if (!inflight) inflight = fetchFeed().finally(() => (inflight = null));
  try {
    const list = await inflight;
    feed = { at: Date.now(), list };
    failedAt = 0;
    return { list, ok: true };
  } catch (e) {
    console.error("[holidays] public holiday feed failed", e instanceof Error ? e.message : e);
    failedAt = Date.now();
    // ใช้ข้อมูลเก่าที่ค้างอยู่ถ้ามี ดีกว่าไม่มีอะไรเลย
    return { list: feed?.list ?? [], ok: !!feed };
  }
}

async function schoolHolidays(start: string, end: string): Promise<Holiday[]> {
  const { data, error } = await supabaseAdmin
    .from("holiday")
    .select("holiday_name, holiday_date")
    .gte("holiday_date", start)
    .lte("holiday_date", end);
  if (error) {
    console.error("[holidays] school holidays failed", error.message);
    return [];
  }
  return (data ?? [])
    .filter((r) => r.holiday_date)
    .map((r) => ({
      start: r.holiday_date as string,
      end: r.holiday_date as string,
      summary: r.holiday_name ?? "วันหยุดสถานศึกษา",
      source: "school" as const,
    }));
}

/** วันหยุดในช่วง [start, end] (รวมปลายทั้งสองข้าง) */
export async function getHolidays(start: string, end: string): Promise<{ items: Holiday[]; degraded: boolean }> {
  const [pub, school] = await Promise.all([
    timed("holidays.public", () => publicHolidays()),
    timed("db.holiday", () => schoolHolidays(start, end)),
  ]);

  const items = [...pub.list, ...school]
    .filter((h) => h.start >= start && h.start <= end)
    .sort((a, b) => a.start.localeCompare(b.start));

  return { items, degraded: !pub.ok };
}

export async function getHolidayMap(start: string, end: string): Promise<{ map: HolidayMap; degraded: boolean }> {
  const { items, degraded } = await getHolidays(start, end);
  return { map: holidayMapFrom(items), degraded };
}
