// app/api/admin/schedule/table/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

/* ---------- helpers ---------- */

// HH:mm คร่าว ๆ
function isTimeLike(v: any) {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

type IncomingRow = {
  day_of_week?: any;   // 1..5
  period_number?: any; // 1..7
  start_time?: any;    // "HH:mm" | null
  end_time?: any;      // "HH:mm" | null
  subject_id?: any;    // optional
  classroom_id?: any;  // optional
};

// validate/normalize ต่อแถว (ยังไม่ใส่ teacher_id ณ จุดนี้)
function normalizeOne(input: IncomingRow, index?: number) {
  const ix = index ?? 0;
  const err = (m: string) => new Error(`แถวที่ ${ix + 1}: ${m}`);

  const dayNum =
    input.day_of_week === null || input.day_of_week === undefined
      ? null
      : Number(input.day_of_week);
  const periodNum =
    input.period_number === null || input.period_number === undefined
      ? null
      : Number(input.period_number);

  if (dayNum === null || Number.isNaN(dayNum)) throw err("day_of_week ไม่ถูกต้อง");
  if (periodNum === null || Number.isNaN(periodNum)) throw err("period_number ไม่ถูกต้อง");

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

  const subjectId   = input.subject_id   === undefined || input.subject_id   === "" ? null : input.subject_id;
  const classroomId = input.classroom_id === undefined || input.classroom_id === "" ? null : input.classroom_id;

  return {
    day_of_week: dayNum,
    period_number: periodNum,
    start_time: startTime,     // 'HH:mm' | null
    end_time: endTime,         // 'HH:mm' | null
    subject_id: subjectId,     // any | null
    classroom_id: classroomId, // any | null
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = NextResponse.next();
    const supabase = createSupabaseServerRoute(req, res);

    const userIdParam = params.id?.trim();
    if (!userIdParam) {
      return NextResponse.json({ error: "invalid user_id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get("day_of_week"); // optional

    // 1) map user_id (UUID) -> teacher_id (number) ก่อน
    const { data: teacherRow, error: tErr } = await supabase
      .from("teacher")
      .select("teacher_id")
      .eq("user_id", userIdParam)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!teacherRow?.teacher_id) {
      // ไม่เจอครูที่ผูกกับ user_id นี้ → คืนว่าง
      return NextResponse.json({ schedules: [] });
    }

    const teacherId = teacherRow.teacher_id;

    // 2) ค่อย query ตารางสอนแบบกรองตรงคอลัมน์จริง .eq('teacher_id', teacherId)
    let query = supabase
      .from("teachingschedule")
      .select(`
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
          teacher_id
        )
      `)
      .eq("teacher_id", teacherId)  // ✅ กรองตรง ๆ ด้วย teacher_id
      // กันแถวขยะที่ day/period เป็น null หลุดมา
      .not("day_of_week", "is", null)
      .not("period_number", "is", null)
      .order("day_of_week", { ascending: true })
      .order("period_number", { ascending: true });

    if (dayParam) {
      const d = Number(dayParam);
      if (!Number.isNaN(d)) query = query.eq("day_of_week", d);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ schedules: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดตารางสอนได้" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const userIdParam = params.id?.trim();
    if (!userIdParam) {
      return NextResponse.json({ error: "invalid user_id" }, { status: 400 });
    }

    // 1) หา teacher_id จาก user_id ก่อน
    const { data: teacherRow, error: teacherErr } = await supabase
      .from("teacher")
      .select("teacher_id, user_id")
      .eq("user_id", userIdParam)
      .maybeSingle();

    if (teacherErr) throw teacherErr;
    if (!teacherRow?.teacher_id) {
      return NextResponse.json(
        { error: "ไม่พบ teacher_id ที่แมปกับ user_id นี้" },
        { status: 404 }
      );
    }
    const teacherId = teacherRow.teacher_id;

    // 2) อ่าน body และ normalize
    const body = await req.json();

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

    const cleaned = rawRows.map((r, i) => normalizeOne(r, i));

    // 3) สร้าง payload ใส่ teacher_id (ไม่ใช่ user_id)
    const toInsert = cleaned.map((row) => ({
      ...row,
      teacher_id: teacherId, // << key จริงในตาราง teachingschedule
    }));

    // 4) insert แล้ว select กลับพร้อม relations
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
      );

    if (error) throw error;

    return NextResponse.json({ schedules: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "บันทึกตารางสอนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
