import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

// JS 0..6 -> 1..7 (Mon=1, Sun=7)
function dayOfWeekNum(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const js = d.getDay(); // 0 Sun .. 6 Sat
  return js === 0 ? 7 : js;
}
function timeLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return "";
  const fmt = (t: string) => t.slice(0, 5).replace(":", ".");
  return `${fmt(start)} - ${fmt(end)} น.`;
}

/**
 * GET /api/academic/leave-schedule?leaveId=48&start=YYYY-MM-DD&end=YYYY-MM-DD
 * - คืน "ตารางสอนของผู้ลาตามช่วงวันของใบลา"
 * - ช่วยให้หน้า PlanSubstituteModal แสดงเฉพาะวัน/คาบที่เกี่ยวข้อง
 */
export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const url = new URL(req.url);
  const leaveId = Number(url.searchParams.get("leaveId") || "0");
  const start   = url.searchParams.get("start") || "";
  const end     = url.searchParams.get("end") || "";

  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "invalid leaveId" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "invalid date range" }, { status: 400 });
  }

  // 1) ใบลา -> user_id
  const lr = await g.supa
    .from("leaverequest")
    .select("user_id")
    .eq("leave_request_id", leaveId)
    .single();
  if (lr.error || !lr.data) return NextResponse.json({ error: "leave_not_found" }, { status: 404 });

  // 2) user_id -> teacher_id
  const t = await g.supa
    .from("teacher")
    .select("teacher_id")
    .eq("user_id", (lr.data as any).user_id)
    .maybeSingle();
  if (t.error || !t.data?.teacher_id) {
    return NextResponse.json({ error: "not_teacher" }, { status: 400 });
  }
  const teacherId = Number(t.data.teacher_id);

  // 3) ทำลิสต์วันที่ในช่วง
  const dates: string[] = [];
  {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end   + "T00:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  const wantedDow = Array.from(new Set(dates.map(dayOfWeekNum)));

  // 4) ดึงคาบสอนของครูคนนี้สำหรับ dow ที่เกี่ยว
  const q = await g.supa
    .from("teachingschedule")
    .select(`
      day_of_week,
      period_number,
      start_time, end_time,
      subject_id, classroom_id,
      subject:subject_id(subject_name,subject_group_name),
      classroom:classroom_id(room_name)
    `)
    .eq("teacher_id", teacherId)
    .in("day_of_week", wantedDow)
    .order("day_of_week")
    .order("period_number");
  if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });

  const byDow = new Map<number, any[]>();
  (q.data || []).forEach((r) => {
    const arr = byDow.get(r.day_of_week) ?? [];
    arr.push(r);
    byDow.set(r.day_of_week, arr);
  });

  const data = dates.map((iso) => {
    const dow = dayOfWeekNum(iso);
    const slots = (byDow.get(dow) || []).map((r) => ({
      period: Number(r.period_number),
      time: timeLabel(r.start_time, r.end_time),
      subject: r.subject?.subject_name ?? "-",
      room: r.classroom?.room_name ?? "-",
    }));
    return { date: iso, weekdayLabel: "", slots };
  });

  return NextResponse.json({ data });
}
