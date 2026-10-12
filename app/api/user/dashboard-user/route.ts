// app/api/user/dashbord-user/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";
import { createSupabaseServerRSC } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

// แปลงสถานะจาก DB -> ไทย
function thStatus(s?: string | null) {
  const v = String(s ?? "").toLowerCase().trim();
  switch (v) {
    case "pending":   return "รอพิจารณา";
    case "reviewed":  return "ตรวจสอบแล้ว (รออนุมัติ)";
    case "approved":  return "อนุมัติ";
    case "rejected":  return "ไม่อนุมัติ";
    case "failed":    return "ไม่ผ่านตรวจสอบ";
    case "cancelled": return "ยกเลิก";
    default:          return "รอพิจารณา";
  }
}

// ปฏิทินปกติ (ม.ค.-ธ.ค.)
function buildCalendarRange(year?: number, month?: number) {
  const y = Number.isFinite(year) ? Number(year) : new Date().getFullYear();
  if (month && month >= 1 && month <= 12) {
    const start = new Date(Date.UTC(y, month - 1, 1, 0, 0, 0));
    const end   = new Date(Date.UTC(y, month, 0, 23, 59, 59));
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }
  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(y, 11, 31, 23, 59, 59));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * ปีงบประมาณไทย: 1 ต.ค. (ปี-1) ถึง 30 ก.ย. (ปี)
 * fy = 2026 => 2025-10-01..2026-09-30
 * fmonth 1..12: 1=ต.ค., 2=พ.ย., ..., 12=ก.ย.
 */
function buildFiscalRange(fy?: number, fmonth?: number) {
  const F = Number.isFinite(fy) ? Number(fy) : getCurrentFY();
  if (fmonth && fmonth >= 1 && fmonth <= 12) {
    // map เดือนปีงบ -> เดือนปฏิทิน
    // ต.ค.=10 => fmonth 1 -> 10, 2->11, 3->12, 4->1, ..., 12->9
    const calMonth = ((fmonth + 9) % 12) + 1; // 1..12
    const calYear  = calMonth >= 10 ? F - 1 : F;
    const start = new Date(Date.UTC(calYear, calMonth - 1, 1, 0, 0, 0));
    const end   = new Date(Date.UTC(calYear, calMonth, 0, 23, 59, 59));
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }
  // ทั้งปีงบ
  const start = new Date(Date.UTC(F - 1, 9, 1, 0, 0, 0));  // Oct 1 (เดือน 9 = ต.ค.)
  const end   = new Date(Date.UTC(F, 8, 30, 23, 59, 59));  // Sep 30 (เดือน 8 = ก.ย.)
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function getCurrentFY() {
  const d = new Date();
  const m = d.getUTCMonth() + 1; // 1..12
  const y = d.getUTCFullYear();
  return m >= 10 ? y + 1 : y; // ต.ค.-ธ.ค. นับเป็นปีงบถัดไป
}

/**
 * GET /api/user/dashbord-user
 * โหมดปฏิทิน:   ?year=YYYY&month=MM
 * โหมดปีงบประมาณ: ?fy=YYYY&fmonth=1..12 (1=ต.ค.)
 */
export async function GET(req: Request) {
  try {
    // 1) auth
    const g = await requireAuth();
    if (!g.ok) return NextResponse.json({ data: [], error: "UNAUTHORIZED" }, { status: 401 });
    const userId = g.user.id;

    // 2) supabase
    const supabase = await createSupabaseServerRSC();

    // 3) query params -> สร้างช่วงวัน
    const { searchParams } = new URL(req.url);

    // โหมดปีงบ (ถ้ามี fy ให้ถือว่าใช้โหมดปีงบ)
    const fy      = Number(searchParams.get("fy") ?? "");
    const fmonth  = Number(searchParams.get("fmonth") ?? "");
    const year    = Number(searchParams.get("year") ?? "");
    const month   = Number(searchParams.get("month") ?? "");

    const { startISO, endISO } =
      Number.isFinite(fy) && fy > 0
        ? buildFiscalRange(fy, fmonth || undefined)
        : buildCalendarRange(year, month || undefined);

    // 4) ดึงคำขอลา + JOIN leavetype
    const { data: rows, error } = await supabase
      .from("leaverequest")
      .select(`
        leave_request_id,
        user_id,
        leave_type_id,
        status,
        total_day,
        date_start,
        date_end,
        timestamp,
        reason,
        approved_by,
        leavetype:leave_type_id ( leave_type_name )
      `)
      .eq("user_id", userId)
      .gte("date_start", startISO)
      .lte("date_start", endISO)
      .order("date_start", { ascending: false });

    if (error) {
      return NextResponse.json({ data: [], error: `QUERY_ERROR: ${error.message}` }, { status: 500 });
    }

    // 5) map -> LeaveRow
    const data = (rows ?? []).map((r: any) => {
      const status_code = String(r.status ?? "").toLowerCase().trim();
      const leaveType = r?.leavetype?.leave_type_name ?? "ไม่ระบุ";
      return {
        id: String(r.leave_request_id),
        leaveType,
        startDate: r.date_start ? new Date(r.date_start).toISOString() : null,
        endDate:   r.date_end   ? new Date(r.date_end).toISOString()   : null,
        totalDays: Number(r.total_day ?? 0),
        status:    thStatus(status_code),
        status_code,
        submittedAt: r.timestamp ? new Date(r.timestamp).toISOString() : null,
        reason:    r.reason ?? null,
        approvedBy:r.approved_by ?? null,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e?.message ?? "INTERNAL_ERROR" }, { status: 500 });
  }
}
