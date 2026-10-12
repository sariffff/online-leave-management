// app/api/academic/substitutions/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

// ฟอร์แมตชื่อ-สกุลให้สั้นและกัน null
function fullName(u?: { prename?: string | null; name?: string | null; surname?: string | null } | null) {
  if (!u) return "";
  return [u.prename, u.name, u.surname].filter(Boolean).join(" ").trim();
}

/**
 * GET /api/academic/substitutions/history
 * โหมด A: ?leaveId=48
 * โหมด B: ?from=YYYY-MM-DD&to=YYYY-MM-DD[&teacherUserId=uuid]
 *
 * คืน shape:
 * {
 *   items: Array<{
 *     id: number;
 *     date: string;         // YYYY-MM-DD
 *     time: string;         // HH:MM
 *     tsId: number | null;  // teaching_schedule_id (อาจ null ในฐานเก่า)
 *     period?: number | null;
 *     subject?: string;
 *     classroom?: string;
 *     leaver?: string;      // ผู้ลา (เจ้าของตาราง)
 *     substitute?: string;  // ผู้สอนแทน
 *   }>
 * }
 */
export async function GET(req: NextRequest) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);
    const leaveId = url.searchParams.get("leaveId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const teacherUserId = url.searchParams.get("teacherUserId") || undefined;

    // ===== เตรียมกรอบค้นหา =====
    let dateStart: string | null = null;
    let dateEnd: string | null = null;
    let teacherId: number | null = null;

    if (leaveId) {
      // โหมด A: ใช้ช่วงวันจากใบลา + owner ของใบลา
      const leaveRes = await g.supa
        .from("leaverequest")
        .select("leave_request_id, user_id, date_start, date_end")
        .eq("leave_request_id", leaveId)
        .maybeSingle();

      if (leaveRes.error || !leaveRes.data) {
        return NextResponse.json({ error: leaveRes.error?.message || "leave not found" }, { status: 404 });
      }
      dateStart = String(leaveRes.data.date_start);
      dateEnd = String(leaveRes.data.date_end);

      // หา teacher_id ของผู้ลา
      const tRes = await g.supa
        .from("teacher")
        .select("teacher_id")
        .eq("user_id", String(leaveRes.data.user_id))
        .maybeSingle();

      if (tRes.error || !tRes.data) {
        return NextResponse.json({ error: "teacher not found for leave.user_id" }, { status: 404 });
      }
      teacherId = Number(tRes.data.teacher_id);
    } else {
      // โหมด B: ใช้ช่วงวันจาก query
      if (!from || !to) {
        return NextResponse.json(
          { error: "bad_request", detail: "require either leaveId or (from & to)" },
          { status: 400 }
        );
      }
      dateStart = String(from);
      dateEnd = String(to);

      if (teacherUserId) {
        const tRes = await g.supa
          .from("teacher")
          .select("teacher_id")
          .eq("user_id", teacherUserId)
          .maybeSingle();

        if (tRes.error || !tRes.data) {
          return NextResponse.json({ error: "teacher not found for teacherUserId" }, { status: 404 });
        }
        teacherId = Number(tRes.data.teacher_id);
      }
    }

    // ===== ดึงสอนแทนในช่วงวัน =====
    // - เลือก fields ที่จำเป็น + join ตารางหลักๆ ตามสคีมา
    // - กรองวันด้วยช่วง 00:00:00..23:59:59
    const subs = await g.supa
      .from("substituteuserteaching")
      .select(`
        substitute_teaching_id,
        date_time,
        substitute_user_id,
        teaching_schedule_id,
        teachingschedule:teaching_schedule_id (
          teaching_schedule_id,
          period_number,
          start_time,
          teacher_id,
          subject:subject_id (
            subject_id,
            subject_name
          ),
          classroom:classroom_id (
            classroom_id,
            classroom_name
          ),
          teacher:teacher_id (
            teacher_id,
            user_id:user_id (
              user_id,
              prename,
              name,
              surname
            )
          )
        ),
        substitute_user:substitute_user_id (
          user_id,
          prename,
          name,
          surname
        )
      `)
      .gte("date_time", `${dateStart} 00:00:00`)
      .lte("date_time", `${dateEnd} 23:59:59`)
      .order("date_time", { ascending: true });

    if (subs.error) {
      return NextResponse.json({ error: subs.error.message }, { status: 500 });
    }

    // ===== ถ้ากำหนด teacherId ให้ filter ให้เหลือเฉพาะตารางของครูคนนั้น =====
    const rows = (subs.data || []).filter((r: any) => {
      if (!teacherId) return true;
      const tsTeacherId = r?.teachingschedule?.teacher?.teacher_id ?? null;
      return Number(tsTeacherId) === Number(teacherId);
    });

    // ===== map response =====
    const items = rows.map((r: any) => {
      const dt = String(r.date_time || "");
      const date = dt.slice(0, 10);
      const time = dt.slice(11, 16); // HH:MM
      const ts = r.teachingschedule ?? null;

      return {
        id: Number(r.substitute_teaching_id),
        date,
        time,
        tsId: ts?.teaching_schedule_id ?? r.teaching_schedule_id ?? null,
        period: ts?.period_number ?? null,
        subject: ts?.subject?.subject_name ?? "",
        classroom: ts?.classroom?.classroom_name ?? "",
        leaver: fullName(ts?.teacher?.user_id ?? null),        // เจ้าของตาราง (ผู้ลา)
        substitute: fullName(r?.substitute_user ?? null),      // ผู้สอนแทน
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
