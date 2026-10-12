import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

// ตรวจรูปแบบเวลาอย่างหยาบ ๆ HH:mm
function isTimeLike(v: any) {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

type IncomingRow = {
  day_of_week?: any;
  period_number?: any;
  start_time?: any;
  end_time?: any;
  subject_id?: any;
  classroom_id?: any;
  user_id?: any;
};

function normalizeOne(input: IncomingRow, index?: number) {
  const ix = index ?? 0;
  const err = (m: string) =>
    new Error(`แถวที่ ${ix + 1}: ${m}`);

  const dayNum =
    input.day_of_week === null || input.day_of_week === undefined
      ? null
      : Number(input.day_of_week);

  const periodNum =
    input.period_number === null || input.period_number === undefined
      ? null
      : Number(input.period_number);

  const userId =
    input.user_id === undefined || input.user_id === null
      ? ""
      : String(input.user_id).trim();

  if (!userId) throw err("user_id เป็นค่าว่าง");
  if (dayNum === null || Number.isNaN(dayNum)) throw err("day_of_week ไม่ถูกต้อง");
  if (periodNum === null || Number.isNaN(periodNum)) throw err("period_number ไม่ถูกต้อง");

  // start/end time: ถ้าให้มาก็ต้องรูปแบบ HH:mm, ไม่มีก็เป็น null
  const startTime =
    input.start_time === null || input.start_time === undefined || input.start_time === ""
      ? null
      : String(input.start_time);

  const endTime =
    input.end_time === null || input.end_time === undefined || input.end_time === ""
      ? null
      : String(input.end_time);

  if (startTime && !isTimeLike(startTime)) throw err("start_time ต้องเป็นรูปแบบ HH:mm");
  if (endTime && !isTimeLike(endTime)) throw err("end_time ต้องเป็นรูปแบบ HH:mm");

  // subject_id / classroom_id อาจเป็น string/uuid/เลข ก็ส่งผ่านตามที่เข้ามา (หรือ null)
  const subjectId =
    input.subject_id === undefined || input.subject_id === "" ? null : input.subject_id;
  const classroomId =
    input.classroom_id === undefined || input.classroom_id === "" ? null : input.classroom_id;

  return {
    day_of_week: dayNum,
    period_number: periodNum,
    start_time: startTime,   // 'HH:mm' | null
    end_time: endTime,       // 'HH:mm' | null
    subject_id: subjectId,   // any | null (ให้ตาม schema ฐานข้อมูล)
    classroom_id: classroomId, // any | null
    user_id: userId,
  };
}
export async function GET(req: NextRequest) {
  try {
    const res = NextResponse.next();
    const supabase = createSupabaseServerRoute(req, res);

    const { searchParams } = new URL(req.url);
    const teacherIdParam = searchParams.get("teacher_id"); // number
    const userIdParam    = searchParams.get("user_id");    // uuid
    const dayParam       = searchParams.get("day_of_week"); // 1..5 (string)

    // SELECT teachingschedule พร้อม join ความสัมพันธ์
    // หมายเหตุ: คอลัมน์ฝั่ง schedule ใช้ชื่อ foreign key ว่า teacher_id / subject_id / classroom_id
    // สามารถ filter ด้วย teacher_id หรือ user_id (ผ่านความสัมพันธ์) และ day_of_week
    let query = supabase
      .from("teachingschedule")
      .select(
        `
        teaching_schedule_id,
        day_of_week,
        period_number,
        start_time,
        end_time,
        subject:subject_id (
          subject_id,
          subject_name
        ),
        classroom:classroom_id (
          classroom_id,
          classroom_name,
          classroom_level:classroom_level (
            level_id,
            level_name
          )
        ),
        teacher:teacher_id (
          teacher_id,
          user:user_id (
            user_id,
            prename,
            name,
            surname
          )
        )
      `
      )
      .order("day_of_week", { ascending: true })
      .order("period_number", { ascending: true });

    // กรองตาม teacher_id (ตรงตาราง schedule)
    if (teacherIdParam) {
      const num = Number(teacherIdParam);
      if (!Number.isNaN(num)) {
        query = query.eq("teacher_id", num);
      }
    }

    // กรองตาม user_id (ผ่านความสัมพันธ์ teacher -> user)
    if (userIdParam) {
      // PostgREST รองรับ filter บน embedded resource ด้วย dot notation
      query = query.eq("teacher.user.user_id", userIdParam);
    }

    // กรองตามวัน
    if (dayParam) {
      const dayNum = Number(dayParam);
      if (!Number.isNaN(dayNum)) {
        query = query.eq("day_of_week", dayNum);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // ส่งคืนแบบปกติ (ไม่ map flatten) เพื่อให้ UI เลือก map เองได้ยืดหยุ่น
    // shape: { schedules: Array<{
    //   teaching_schedule_id, day_of_week, period_number, start_time, end_time,
    //   subject: { subject_id, subject_name },
    //   classroom: { classroom_id, classroom_name, classroom_level: { level_id, level_name } },
    //   teacher: { teacher_id, user: { user_id, prename, name, surname } }
    // }>}
    return NextResponse.json({ schedules: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดตารางสอนได้" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const body = await req.json();

    // รองรับได้ทั้ง:
    // 1) อ็อบเจ็กต์เดี่ยว
    // 2) อาเรย์ของอ็อบเจ็กต์
    // 3) { rows: [...] }
    let rawRows: IncomingRow[] = [];
    if (Array.isArray(body)) {
      rawRows = body;
    } else if (Array.isArray(body?.rows)) {
      rawRows = body.rows;
    } else if (typeof body === "object" && body !== null) {
      rawRows = [body as IncomingRow];
    } else {
      return NextResponse.json(
        { error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น object, array, หรือ { rows: [...] })" },
        { status: 400 }
      );
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ schedules: [] });
    }

    // ทำความสะอาด + validate ทีละแถว
    const toInsert = rawRows.map((r, i) => normalizeOne(r, i));

    // insert ทีเดียว (Supabase จะทำเป็น bulk insert ให้)
    const { data, error } = await supabase
      .from("teachingschedule")
      .insert(toInsert)
      .select(
        `
        teaching_schedule_id,
        day_of_week,
        period_number,
        start_time,
        end_time,
        subject_id,
        classroom_id,
        user_id
      `
      );

    if (error) throw error;

    // ✅ คืนค่ารูปแบบ "แบนราบ" ให้เหมือน select ใช้ง่ายในหน้า UI
    const schedules =
      (data ?? []).map((row: any) => ({
        teaching_schedule_id: String(row.teaching_schedule_id),
        day_of_week: row.day_of_week ?? null,
        period_number: row.period_number ?? null,
        start_time: row.start_time ?? null,
        end_time: row.end_time ?? null,
        subject_id: row.subject_id ?? null,
        classroom_id: row.classroom_id ?? null,
        user_id: row.user_id ?? null,
      })) || [];

    return NextResponse.json({ schedules });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "บันทึกตารางสอนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
