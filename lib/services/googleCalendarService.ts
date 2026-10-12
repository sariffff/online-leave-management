// /lib/services/googleCalendarService.ts
import { google } from 'googleapis';
import path from 'path';

// กำหนด path ไปยังไฟล์ JSON Key
// process.cwd() คือ path ของ root project
const KEY_FILE_PATH = path.join(process.cwd(), '.service-account-key.json');

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'], // สิทธิ์ที่ต้องการ: อ่านข้อมูล Event
});

const CALENDAR_ID = 'th.th#holiday@group.v.calendar.google.com';

/**
 * ดึงข้อมูลวันหยุดราชการ
 */
export const getThaiHolidays = async (startDate: string, endDate: string): Promise<string[]> => {
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
        
        const events = response.data.items;
        if (!events) {
            return [];
        }
        
        // ดึงเฉพาะวันที่ของวันหยุด และกรองค่าที่เป็น null หรือ undefined ออก
        const holidays = events
            .map(event => event.start?.date)
            .filter((date): date is string => Boolean(date));
            
        return holidays;
    } catch (err) {
        console.error("Failed to fetch holidays:", err);
        return [];
    }
};