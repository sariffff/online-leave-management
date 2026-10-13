// อ่านไฟล์ iCalendar (.ics) ของปฏิทินวันหยุดไทยจาก Google (ลิงก์สาธารณะ ไม่ต้องใช้คีย์)
// ปฏิทินนี้มีทั้ง "วันหยุดนักขัตฤกษ์" (หยุดจริง) และ "วันสำคัญ" (วาเลนไทน์, ตรุษจีน, คริสต์มาส — ไม่หยุด)
// ดูจากบรรทัดแรกของ DESCRIPTION แล้วเก็บเฉพาะวันหยุดนักขัตฤกษ์

export const THAI_HOLIDAY_ICS_URL =
  "https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics";

export type IcsHoliday = { date: string; summary: string };

const DAY_MS = 86_400_000;
const isoOf = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** ค่าข้อความใน iCalendar: \n \, \; \\ */
function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** แปลง .ics เป็นรายการวันหยุดทีละวัน (event หลายวันถูกแตกเป็นรายวัน) เรียงตามวันที่ ไม่ซ้ำ */
export function parseHolidayIcs(text: string): IcsHoliday[] {
  // RFC 5545: บรรทัดที่ขึ้นต้นด้วยช่องว่าง/แท็บคือบรรทัดต่อจากบรรทัดก่อน
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const byDate = new Map<string, string>();

  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (name: string) => {
      const m = new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, "m").exec(body);
      return m ? m[1].trim() : "";
    };
    if (/^CANCELLED$/i.test(field("STATUS"))) continue;

    const description = unescapeText(field("DESCRIPTION"));
    if (!description.startsWith("วันหยุดนักขัตฤกษ์")) continue; // ข้าม "วันสำคัญ"

    const start = /^(\d{8})/.exec(field("DTSTART"))?.[1];
    if (!start) continue;
    const startIso = isoOf(start);
    const endRaw = /^(\d{8})/.exec(field("DTEND"))?.[1];
    const endExclusive = endRaw ? isoOf(endRaw) : nextDay(startIso); // DTEND ของ all-day event เป็นวันถัดไป

    const summary = unescapeText(field("SUMMARY")).replace(/​/g, "") || "วันหยุดราชการ";
    for (let d = startIso; d < endExclusive; d = nextDay(d)) {
      if (!byDate.has(d)) byDate.set(d, summary);
    }
  }

  return [...byDate]
    .map(([date, summary]) => ({ date, summary }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
