// app/api/holidays/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';

const KEY_FILE_PATH = path.join(process.cwd(), '.service-account-key.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
});

const CALENDAR_ID = 'th.th#holiday@group.v.calendar.google.com';

// ---------- helpers: ช่วงเวลา ----------
function toISOZ(d: Date) { return d.toISOString(); }

// เดือน
function startOfMonthUTC(y: number, m0: number) { // m0: 0-11
  return new Date(Date.UTC(y, m0, 1, 0, 0, 0));
}
function firstDayOfNextMonthUTC(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 1, 0, 0, 0));
}

// ปีปฏิทิน
function startOfYearUTC(y: number) { return new Date(Date.UTC(y, 0, 1, 0, 0, 0)); }
function startOfNextYearUTC(y: number) { return new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0)); }

// ปีงบประมาณไทย (1 ต.ค. ปีก่อนหน้า → 1 ต.ค. ปีนั้น แบบ exclusive)
function fiscalRangeUTC(fiscalYear: number) {
  const start = new Date(Date.UTC(fiscalYear - 1, 9, 1, 0, 0, 0)); // Oct 1 (month=9)
  const endExclusive = new Date(Date.UTC(fiscalYear, 9, 1, 0, 0, 0)); // next Oct 1
  return { start, endExclusive };
}

// ---------- Google Calendar ----------
async function getThaiHolidays(timeMinISO: string, timeMaxISOExclusive: string) {
  const authClient = await auth.getClient();
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const resp = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: timeMinISO,
    timeMax: timeMaxISOExclusive, // exclusive
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false,
  });

  const items = resp.data.items ?? [];
  return items
    .map(ev => ({
      start: ev.start?.date ?? ev.start?.dateTime ?? null,
      end: ev.end?.date ?? ev.end?.dateTime ?? null, // หมายเหตุ: end ของ all-day เป็นวันถัดไป (exclusive)
      summary: ev.summary ?? '',
      id: ev.id ?? '',
    }))
    .filter(h => !!h.start)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
}

// ---------- Handler ----------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // โหมด 1: month=YYYY-MM
    const month = searchParams.get('month');

    // โหมด 2: year=YYYY (ปีปฏิทิน)
    const year = searchParams.get('year');

    // โหมด 3: fiscal=YYYY (ปีงบประมาณ)
    const fiscal = searchParams.get('fiscal');

    // โหมด 4: start/end = YYYY-MM-DD (กำหนดเอง)
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let timeMinISO = '';
    let timeMaxISOExclusive = '';

    if (month) {
      const m = month.match(/^(\d{4})-(\d{2})$/);
      if (!m) return NextResponse.json({ error: 'Invalid month. Use month=YYYY-MM' }, { status: 400 });
      const y = Number(m[1]);
      const mm0 = Number(m[2]) - 1;
      const s = startOfMonthUTC(y, mm0);
      const e = firstDayOfNextMonthUTC(y, mm0);
      timeMinISO = toISOZ(s);
      timeMaxISOExclusive = toISOZ(e);
    } else if (year) {
      const y = Number(year);
      if (!/^\d{4}$/.test(year)) return NextResponse.json({ error: 'Invalid year. Use year=YYYY' }, { status: 400 });
      const s = startOfYearUTC(y);
      const e = startOfNextYearUTC(y);
      timeMinISO = toISOZ(s);
      timeMaxISOExclusive = toISOZ(e);
    } else if (fiscal) {
      const fy = Number(fiscal);
      if (!/^\d{4}$/.test(fiscal)) return NextResponse.json({ error: 'Invalid fiscal. Use fiscal=YYYY' }, { status: 400 });
      const { start: s, endExclusive: e } = fiscalRangeUTC(fy);
      timeMinISO = toISOZ(s);
      timeMaxISOExclusive = toISOZ(e);
    } else if (start || end) {
      if (!start || !end) return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }
      const s = new Date(`${start}T00:00:00Z`);
      const e = new Date(`${end}T00:00:00Z`);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
      // ทำ end เป็น exclusive (+1 วัน)
      e.setUTCDate(e.getUTCDate() + 1);
      timeMinISO = toISOZ(s);
      timeMaxISOExclusive = toISOZ(e);
    } else {
      // ไม่ส่งอะไรเลย → เดือนปัจจุบัน (UTC)
      const now = new Date();
      const s = startOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth());
      const e = firstDayOfNextMonthUTC(now.getUTCFullYear(), now.getUTCMonth());
      timeMinISO = toISOZ(s);
      timeMaxISOExclusive = toISOZ(e);
    }

    const holidays = await getThaiHolidays(timeMinISO, timeMaxISOExclusive);

    return NextResponse.json({
      start: timeMinISO,
      end: timeMaxISOExclusive, // exclusive
      holidays,
    });
  } catch (error: any) {
    console.error('API Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
