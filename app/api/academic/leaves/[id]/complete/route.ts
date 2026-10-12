// app/api/academic/leaves/[id]/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

/**
 * ✅ ฟังก์ชันช่วย: คืน YYYY-MM-DD ตามเวลา "เครื่อง/โลคอล" เพื่อกันปัญหา toISOString เลื่อนวัน (UTC ↔︎ Asia/Bangkok)
 */
function fmtLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * ✅ สรุปความคืบหน้าการมอบหมายสอนแทนของใบลา
 * - ขยายช่วงวันจาก date_start..date_end แบบ Local
 * - match ตารางสอนของผู้ลาในแต่ละวัน (จันทร์=1..ศุกร์=5)
 * - ตรวจการมอบหมายจาก substituteuserteaching โดยนับ:
 *    1) เคสปกติ: มี teaching_schedule_id ตรง + วันตรง
 *    2) (รองรับ legacy ถ้าจำเป็น) ไม่มี tsId แต่เวลา HH:MM ของ date_time ตรงกับ start_time ของคาบ
 */
async function computeProgress(g: any, leaveId: string) {
  // 1) โหลดใบลา
  const leaveRes = await g.supa
    .from("leaverequest")
    .select("leave_request_id, user_id, date_start, date_end, status")
    .eq("leave_request_id", leaveId)
    .maybeSingle();

  if (leaveRes.error || !leaveRes.data) {
    return { error: leaveRes.error?.message || "leave not found", status: 404 } as const;
  }

  const leave = leaveRes.data as {
    leave_request_id: number | string;
    user_id: string;
    date_start: string; // YYYY-MM-DD
    date_end: string;   // YYYY-MM-DD
    status: string;
  };

  // 2) หา teacher_id จาก user_id ผู้ลา
  const teacherRes = await g.supa
    .from("teacher")
    .select("teacher_id")
    .eq("user_id", leave.user_id)
    .maybeSingle();

  if (teacherRes.error || !teacherRes.data) {
    return { error: "teacher not found for leave.user_id", status: 404 } as const;
  }

  const teacherId = Number(teacherRes.data.teacher_id);

  // 3) ดึงตารางสอนทั้งหมดของผู้ลา (ใช้ day_of_week/period_number/start_time)
  const tsRes = await g.supa
    .from("teachingschedule")
    .select("teaching_schedule_id, day_of_week, period_number, start_time")
    .eq("teacher_id", teacherId);

  if (tsRes.error) {
    return { error: tsRes.error.message, status: 500 } as const;
  }

  type TsRow = {
    teaching_schedule_id: number;
    day_of_week: number; // 1..5
    period_number: number | null;
    start_time: string;  // HH:MM:SS
  };

  const tsRows = (tsRes.data || []) as TsRow[];

  // 4) map tsId -> HH:MM (ใช้กับ fallback legacy ถ้าจำเป็น)
  const tsStartHHMM = new Map<number, string>();
  for (const r of tsRows) {
    tsStartHHMM.set(Number(r.teaching_schedule_id), String(r.start_time || "00:00:00").slice(0, 5));
  }

  // 5) ขยายวัน (แบบ Local) ระหว่าง date_start..date_end
  const sd = new Date(`${leave.date_start}T00:00:00`);
  const ed = new Date(`${leave.date_end}T00:00:00`);
  const to15 = (jsDow: number) => ({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } as Record<number, number>)[jsDow] ?? null;

  type Need = { date: string; tsId: number; period?: number | null; hhmm?: string };
  const needed: Need[] = [];

  // เดินวันแบบเพิ่ม 1 วัน โดยคง concept "วันท้องถิ่น"
  for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 1)) {
    const dateISO = fmtLocalYMD(d);     // YYYY-MM-DD (local-safe)
    const jsDow = d.getDay();           // 0..6
    const dow15 = to15(jsDow);          // 1..5 เฉพาะ จันทร์..ศุกร์
    if (!dow15) continue;

    for (const r of tsRows) {
      if (Number(r.day_of_week) === dow15) {
        needed.push({
          date: dateISO,
          tsId: Number(r.teaching_schedule_id),
          period: r.period_number ?? null,
          hhmm: tsStartHHMM.get(Number(r.teaching_schedule_id)),
        });
      }
    }
  }

  const required = needed.length;
  if (required === 0) {
    return {
      ok: true,
      leave: { id: leave.leave_request_id, status: leave.status, date_start: leave.date_start, date_end: leave.date_end },
      progress: { required, assigned: 0, complete: false },
      details: { needed, missing: needed },
    } as const;
  }

  // 6) ดึงข้อมูลสอนแทนในช่วงวันทั้งหมด แล้วนับ assigned
  //    - ใช้คิวรี "รายวัน" เพื่อลดความเสี่ยง timezone และคัดใน JS ให้แม่น
  let assigned = 0;
  const missing: Need[] = [];

  // สร้าง index เร็ว ๆ
  const neededByDate = new Map<string, Need[]>();
  for (const n of needed) {
    const arr = neededByDate.get(n.date) || [];
    arr.push(n);
    neededByDate.set(n.date, arr);
  }

  // เดินตรวจรายวัน
  for (const [dateISO, needs] of neededByDate.entries()) {
    // สร้างช่วงเวลา "วันนั้น" ชัด ๆ
    const startDay = `${dateISO} 00:00:00`;
    const endDay = `${dateISO} 23:59:59`;

    // ดึงสอนแทนของวันนั้นทั้งหมด
    const subsRes = await g.supa
      .from("substituteuserteaching")
      .select("teaching_schedule_id, date_time")
      .gte("date_time", startDay)
      .lte("date_time", endDay);

    if (subsRes.error) {
      return { error: subsRes.error.message, status: 500 } as const;
    }

    // set สำหรับเช็คแบบเร็ว
    const takenByTsId = new Set<number>();          // tsId ที่ถูกมอบหมายภายในวันนั้น
    const takenByHHMM = new Set<string>();          // `${HH:MM}` (กรณี legacy ไม่มี tsId)

    for (const row of (subsRes.data || []) as Array<{ teaching_schedule_id: number | null; date_time: string }>) {
      const tsId = row.teaching_schedule_id;
      const dt = String(row.date_time);
      if (tsId != null) {
        takenByTsId.add(Number(tsId));
      } else {
        // รองรับฐานเก่า: ไม่มี tsId → เก็บเวลา HH:MM ไว้เทียบกับ start_time
        takenByHHMM.add(dt.slice(11, 16)); // HH:MM
      }
    }

    // เดินเช็ค need ของวันนั้น
    for (const n of needs) {
      if (takenByTsId.has(n.tsId)) {
        assigned += 1;
      } else if (n.hhmm && takenByHHMM.has(n.hhmm)) {
        // fallback legacy: เวลา HH:MM ตรงกับ start_time
        assigned += 1;
      } else {
        missing.push(n);
      }
    }
  }

  const complete = assigned >= required;

  return {
    ok: true,
    leave: { id: leave.leave_request_id, status: leave.status, date_start: leave.date_start, date_end: leave.date_end },
    progress: { required, assigned, complete },
    details: { needed, missing },
  } as const;
}

/**
 * GET /api/academic/leaves/:id/complete
 * - ใช้ตรวจความคืบหน้าว่ามอบหมายครบหรือยัง (ไม่เปลี่ยนสถานะ)
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const result = await computeProgress(g, params.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    leave: result.leave,
    progress: result.progress,
    details: result.details,
  });
}

/**
 * PATCH /api/academic/leaves/:id/complete
 * - ถ้ามอบหมายครบ (assigned >= required) → อัปเดตสถานะใบลาเป็น 'covered'
 * - ถ้ายังไม่ครบ → 409 พร้อมรายละเอียด
 */
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const result = await computeProgress(g, params.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { leave, progress } = result;

  if (!progress.complete) {
    return NextResponse.json({ error: "not_complete", ...progress }, { status: 409 });
  }

  // อัปเดตสถานะใบลาเป็น 'covered'
  const up = await g.supa
    .from("leaverequest")
    .update({ status: "covered" })
    .eq("leave_request_id", leave.id as any);

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  return NextResponse.json({ ...progress, status: "covered" });
}
