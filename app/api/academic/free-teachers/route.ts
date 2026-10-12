// app/api/academic/free-teachers/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || "";            // YYYY-MM-DD
    const periodStr = url.searchParams.get("period") || "";     // 1..7
    const excludeUserId = url.searchParams.get("excludeUserId") || ""; // user_id ของผู้ลา
    const subjectGroupStr = url.searchParams.get("subjectGroup");      // id กลุ่มสาระของผู้ลา (อาจว่าง)

    // --- validate inputs ---
    const d = new Date(`${date}T00:00:00`);
    if (!date || Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "bad_request", detail: "invalid date" }, { status: 400 });
    }
    const period = Number(periodStr);
    if (!Number.isFinite(period) || period < 1 || period > 7) {
      return NextResponse.json({ error: "bad_request", detail: "invalid period" }, { status: 400 });
    }

    // 1) resolve กลุ่มสาระของผู้ลา
    let resolvedSubjectGroup: number | null = null;

    // 1.1 จาก query โดยตรง
    if (subjectGroupStr != null && subjectGroupStr !== "" && Number.isFinite(Number(subjectGroupStr))) {
      resolvedSubjectGroup = Number(subjectGroupStr);
    }

    // 1.2 จาก user_id ของผู้ลา (fallback)
    if (resolvedSubjectGroup === null && excludeUserId) {
      const sg1 = await g.supa
        .from("teacher")
        .select("subject_group_id")
        .eq("user_id", excludeUserId)
        .maybeSingle();

      if (!sg1.error && sg1.data?.subject_group_id != null) {
        const sgNum = Number(sg1.data.subject_group_id);
        if (Number.isFinite(sgNum)) resolvedSubjectGroup = sgNum;
      } else {
        const sg2 = await g.supa
          .from("teacher")
          .select("subject_group_id")
          .eq("user_id", excludeUserId)
          .limit(1);
        if (!sg2.error && sg2.data && sg2.data[0]?.subject_group_id != null) {
          const sgNum = Number(sg2.data[0].subject_group_id);
          if (Number.isFinite(sgNum)) resolvedSubjectGroup = sgNum;
        }
      }
    }

    // 2) mapping วัน: 0..6 (0=อาทิตย์)
    const dbDow = d.getDay();

    // 3) ช่วงวันสำหรับเช็ค substitute ในวันเดียวกัน
    const startISO = `${date}T00:00:00`;
    const nextDay = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const endISO = `${nextDay.toISOString().slice(0, 10)}T00:00:00`;

    // 4) ครูทั้งหมด (มี subject_group_id เสมอ)
    const t = await g.supa
      .from("teacher")
      .select(`
        teacher_id,
        user_id,
        subject_group_id,
        user:user_id (
          user_id,
          prename,
          name,
          surname
        )
      `);

    if (t.error) {
      return NextResponse.json({ error: "db_error", detail: t.error.message }, { status: 500 });
    }

    const allTeachers = (t.data || [])
      .filter((r: any) => r?.user?.user_id)
      .map((r: any) => ({
        teacher_id: String(r.teacher_id),
        user_id: String(r.user.user_id),
        name: [r.user.prename, r.user.name, r.user.surname].filter(Boolean).join(" ").trim() || "-",
        subjectGroupId: Number(r.subject_group_id),
      }));

    const userIdToTeacherId = new Map(allTeachers.map(tt => [tt.user_id, tt.teacher_id]));

    // 5) ไม่ว่างจาก teachingschedule
    const busyTeach = await g.supa
      .from("teachingschedule")
      .select("teacher_id")
      .eq("day_of_week", dbDow)
      .eq("period_number", period);

    if (busyTeach.error) {
      return NextResponse.json({ error: "db_error", detail: busyTeach.error.message }, { status: 500 });
    }
    const busyTeacherIds = new Set((busyTeach.data || []).map((r: any) => String(r.teacher_id)));

    // 6) ไม่ว่างเพราะถูกสอนแทนในคาบเดียวกันแล้ว
    const subs = await g.supa
      .from("substituteuserteaching")
      .select("substitute_user_id, teaching_schedule_id, date_time")
      .gte("date_time", startISO)
      .lt("date_time", endISO);

    if (subs.error) {
      return NextResponse.json({ error: "db_error", detail: subs.error.message }, { status: 500 });
    }

    const schedIds = Array.from(new Set((subs.data || []).map((r: any) => r.teaching_schedule_id).filter(Boolean)));
    if (schedIds.length > 0) {
      const sched = await g.supa
        .from("teachingschedule")
        .select("teaching_schedule_id, period_number")
        .in("teaching_schedule_id", schedIds)
        .eq("period_number", period);

      if (sched.error) {
        return NextResponse.json({ error: "db_error", detail: sched.error.message }, { status: 500 });
      }

      const okIds = new Set((sched.data || []).map((r: any) => String(r.teaching_schedule_id)));
      for (const r of subs.data || []) {
        if (okIds.has(String(r.teaching_schedule_id))) {
          const tid = userIdToTeacherId.get(String(r.substitute_user_id));
          if (tid) busyTeacherIds.add(tid);
        }
      }
    }

    // 7) คนว่างจริง
    let free = allTeachers.filter((tt) => !busyTeacherIds.has(tt.teacher_id));

    // 8) exclude เจ้าของใบลา (user_id)
    if (excludeUserId) {
      free = free.filter((tt) => String(tt.user_id) !== String(excludeUserId));
    }

    // 9) แยกเป็น data1/data2
    const pack = (tt: any) => ({
      id: tt.teacher_id,   // teacher_id
      name: tt.name,
      user_id: tt.user_id, // ใช้ POST /api/academic/substitutions
      subjectGroup: tt.subjectGroupId,
    });

    let data1: any[] = [];
    let data2: any[] = [];

    if (resolvedSubjectGroup !== null) {
      const sameGroup = free.filter(tt => Number(tt.subjectGroupId) === resolvedSubjectGroup);
      const otherGroups = free.filter(tt => Number(tt.subjectGroupId) !== resolvedSubjectGroup);
      data1 = sameGroup.map(pack);
      data2 = otherGroups.map(pack);
    } else {
      data2 = free.map(pack);
    }

    return NextResponse.json({
      data1,
      data2,
      data1Count: data1.length,
      data2Count: data2.length,
      resolvedSubjectGroup, // debug ช่วยตรวจสอบฝั่ง client ได้
    });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected_error", detail: String(e?.message || e) }, { status: 500 });
  }
}
