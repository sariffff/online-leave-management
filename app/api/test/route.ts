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

async function getThaiHolidays(startDate: string, endDate: string) {
  try {
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      singleEvents: true,
      showDeleted: false,
    });
    
    // ดึงเฉพาะข้อมูลที่ต้องการ
    const holidays = response.data.items?.map(event => ({
      start: event.start?.date,
      end: event.end?.date,
      summary: event.summary
    })) || [];

    // กรองค่า null ออกและเรียงลำดับตามวันที่
    const sortedHolidays = holidays
      .filter(h => h.start)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return sortedHolidays;
  } catch (err) {
    console.error("Failed to fetch holidays:", err);
    throw new Error("Failed to fetch holidays from Google API.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
    }

    const holidays = await getThaiHolidays(start, end);

    return NextResponse.json({ holidays });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}