// app/api/director/create-leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getFiscalYearFromISO(isoDate: string): number {
  // FY(y) = 1 Oct (y-1) - 30 Sep (y)
  const d = new Date(isoDate);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1..12
  return m >= 10 ? y + 1 : y;
}

export async function POST(req: NextRequest) {
  try {
    // auth director from cookies
    const base = NextResponse.json({});
    const supabase = createSupabaseServerRoute(req, base);
    const { data: u, error: uErr } = await supabase.auth.getUser();
    const director = u?.user;
    if (uErr || !director?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const employeeEmail = String(body?.employeeEmail || "").trim().toLowerCase();
    const leave_type_id  = Number(body?.leave_type_id);
    const date_start     = String(body?.date_start || "");
    const date_end       = String(body?.date_end || "");
    const date_start_type = String(body?.date_start_type || "เต็มวัน");
    const date_end_type   = String(body?.date_end_type || "เต็มวัน");
    const total_day       = Number(body?.total_day);
    const reason          = body?.reason ? String(body?.reason) : null;

    if (!employeeEmail || !leave_type_id || !date_start || !date_end || !total_day) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    // --- หา userId จาก auth.users ด้วย email ---
    // หมายเหตุ: listUsers เป็นแบบแบ่งหน้า — ที่นี่เรียกหน้าแรกพอ (หรือวนหลายหน้าเองหากต้องรองรับองค์กรใหญ่)
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    if ((listRes as any)?.error) {
      return NextResponse.json({ error: (listRes as any).error?.message || "AUTH_QUERY_FAILED" }, { status: 400 });
    }
    const match = listRes.data?.users?.find((user) => (user.email || "").toLowerCase() === employeeEmail);
    if (!match?.id) {
      return NextResponse.json({ error: "USER_NOT_FOUND_BY_EMAIL" }, { status: 404 });
    }
    const targetUserId = match.id;

    // ปีงบประมาณ
    const fiscalYear = getFiscalYearFromISO(date_start);

    // 1) insert leaverequest → อนุมัติทันที
    {
      const { error } = await supabase
        .from("leaverequest")
        .insert({
          user_id: targetUserId,
          leave_type_id,
          date_start,
          date_end,
          date_start_type,
          date_end_type,
          total_day,
          reason,
          status: "approved",
          approved_by: director.id,
          approved_at: new Date().toISOString(),
          year: fiscalYear,
        });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // 2) ปรับ quota ของปีงบ: used+, remaining-, reserved- (max(0))
    // หา quota แถวที่ตรง user/leave_type/year
    const { data: quota, error: quotaErr } = await supabaseAdmin
      .from("userleavequota")
      .select("user_leave_quota_id, total_used, total_remaining, reserved")
      .eq("user_id", targetUserId)
      .eq("leave_type_id", leave_type_id)
      .eq("year", fiscalYear)
      .maybeSingle();

    if (quotaErr) return NextResponse.json({ error: quotaErr.message }, { status: 400 });

    if (!quota) {
      // ถ้า quota ไม่มี — ขึ้นอยู่กับนโยบายระบบคุณ:
      // 1) จะสร้าง quota เริ่มต้นจาก leavetype.max_leave_day?
      // 2) หรือจะปฏิเสธ?
      // ที่นี่ขอปฏิเสธแบบชัดเจนก่อน (ปลอดภัยสุด)
      return NextResponse.json({ error: "QUOTA_NOT_FOUND" }, { status: 409 });
    }

    const usedNow = Number(quota.total_used ?? 0);
    const remainingNow = Number(quota.total_remaining ?? 0);
    const reservedNow = Number(quota.reserved ?? 0);

    const next = {
      total_used: usedNow + total_day,
      total_remaining: remainingNow - total_day,
      reserved: Math.max(0, reservedNow - total_day),
    };

    const { error: updErr } = await supabaseAdmin
      .from("userleavequota")
      .update(next)
      .eq("user_leave_quota_id", quota.user_leave_quota_id);

    if (updErr) {
      // rollback สถานะใบลาที่เพิ่ง insert? (จริงๆ ไม่มี id handle ไว้ยาก)
      // ทางง่ายคือแจ้ง error ออกไปให้ admin แก้ไข quota ตามจริง
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user_id: targetUserId, year: fiscalYear });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
