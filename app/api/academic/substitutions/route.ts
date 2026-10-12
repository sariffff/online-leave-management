// app/api/academic/substitutions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/academic/substitutions?start=YYYY-MM-DD&end=YYYY-MM-DD&ts=1,2,3
 * - ดึงรายการ "สอนแทนที่มีอยู่แล้ว" ช่วงวัน (start..end)
 * - ถ้าส่ง ts (CSV ของ teaching_schedule_id) จะกรองเฉพาะ IDs นั้น ๆ (ลด payload)
 * response: { substitutions: { id, date, teaching_schedule_id, period_number, substitute_user_id, substitute_name }[] }
 */
export async function GET(req: NextRequest) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const { searchParams } = new URL(req.url);
  const start = (searchParams.get("start") || "").trim();
  const end = (searchParams.get("end") || "").trim();
  const tsCsv = (searchParams.get("ts") || "").trim();

  if (!start || !end) {
    return NextResponse.json({ error: "missing start/end" }, { status: 422 });
  }

  // ครอบเวลาเต็มวัน
  const startAt = `${start} 00:00:00`;
  const endAt = `${end} 23:59:59`;

  const select = `
    substitute_teaching_id,
    date_time,
    substitute_user_id,
    teaching_schedule_id,
    substitute:substitute_user_id (
      user_id,
      prename,
      name,
      surname
    ),
    ts:teaching_schedule_id (
      teaching_schedule_id,
      period_number,
      day_of_week,
      start_time,
      end_time
    )
  `;

  let q = g.supa
    .from("substituteuserteaching")
    .select(select)
    .gte("date_time", startAt)
    .lte("date_time", endAt);

  // กรองด้วย set ของ teaching_schedule_id เพื่อลดผลลัพธ์
  const ids = tsCsv
    ? tsCsv.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  if (ids.length > 0) q = q.in("teaching_schedule_id", ids);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const substitutions = (data ?? []).map((row: any) => {
    const dt = new Date(row.date_time);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");

    const sub = row.substitute || {};
    const substitute_name = [sub.prename, sub.name, sub.surname].filter(Boolean).join(" ").trim();

    return {
      id: row.substitute_teaching_id,
      date: `${y}-${m}-${d}`,
      teaching_schedule_id: row.teaching_schedule_id ?? null,
      period_number: row.ts?.period_number ?? null,
      substitute_user_id: row.substitute_user_id ?? null,
      substitute_name,
    };
  });

  return NextResponse.json({ substitutions });
}

/**
 * POST /api/academic/substitutions
 * body: { teachingScheduleId: number, dateISO: "YYYY-MM-DD", substituteUserId: string }
 * - ป้องกันซ้ำด้วย (teaching_schedule_id, date_time)
 * - date_time = join(dateISO, start_time ของ teachingschedule นั้น)
 */
export async function POST(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const body = await req.json().catch(() => ({}));
    const teachingScheduleId = Number(body?.teachingScheduleId);
    const dateISO = String(body?.dateISO || "");
    const substituteUserId = String(body?.substituteUserId || "");

    // -------- validate basic --------
    if (!Number.isFinite(teachingScheduleId) || teachingScheduleId <= 0) {
      return NextResponse.json({ error: "bad_request", detail: "invalid teachingScheduleId" }, { status: 400 });
    }
    // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return NextResponse.json({ error: "bad_request", detail: "invalid dateISO" }, { status: 400 });
    }
    if (!substituteUserId) {
      return NextResponse.json({ error: "bad_request", detail: "invalid substituteUserId" }, { status: 400 });
    }

    // -------- load teaching schedule (need start_time) --------
    const tsRes = await g.supa
      .from("teachingschedule")
      .select("teaching_schedule_id, start_time, period_number")
      .eq("teaching_schedule_id", teachingScheduleId)
      .maybeSingle();

    if (tsRes.error) {
      return NextResponse.json({ error: "db_error", detail: tsRes.error.message }, { status: 500 });
    }
    if (!tsRes.data) {
      return NextResponse.json({ error: "not_found", detail: "teaching schedule not found" }, { status: 404 });
    }

    // join date_time = `${dateISO} ${start_time}`
    const startTime = (tsRes.data as any).start_time as string | null;
    const hhmmss = (startTime || "08:00:00").slice(0, 8); // fallback
    const dateTime = `${dateISO} ${hhmmss}`;

    // -------- prevent duplicate (teaching_schedule_id, date_time) --------
    const dup = await g.supa
      .from("substituteuserteaching")
      .select("substitute_teaching_id")
      .eq("teaching_schedule_id", teachingScheduleId)
      .eq("date_time", dateTime)
      .limit(1);

    if (dup.error) {
      return NextResponse.json({ error: "db_error", detail: dup.error.message }, { status: 500 });
    }
    if (Array.isArray(dup.data) && dup.data.length > 0) {
      return NextResponse.json(
        { error: "conflict", detail: "duplicate substitution" },
        { status: 409 }
      );
    }

    // -------- insert --------
    const ins = await g.supa
      .from("substituteuserteaching")
      .insert({
        date_time: dateTime,
        substitute_user_id: substituteUserId,
        teaching_schedule_id: teachingScheduleId,
      })
      .select("substitute_teaching_id, date_time, substitute_user_id, teaching_schedule_id")
      .single();

    if (ins.error) {
      return NextResponse.json({ error: "db_error", detail: ins.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: ins.data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected_error", detail: String(e?.message || e) }, { status: 500 });
  }
}

/* 
แนะนำเสริม (ฐานข้อมูล):
1) เพิ่ม unique index กันซ้ำที่ DB เลย (กัน race condition ได้ดีที่สุด)
CREATE UNIQUE INDEX IF NOT EXISTS uq_substitute_by_ts_date 
ON public.substituteuserteaching (teaching_schedule_id, date_time);

2) ถ้าต้องการ upsert:
  .upsert({ ... }, { onConflict: "teaching_schedule_id, date_time", ignoreDuplicates: true })
*/
