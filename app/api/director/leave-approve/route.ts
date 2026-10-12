// app/api/supervisor/leave-approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFiscalYearFromISO } from "@/utils/year";

type Status = "reviewed" | "approved" | "rejected";
type Action = "approved" | "rejected";

/* ------------------------------- GET ------------------------------- */
/** 
 * GET /api/supervisor/leave-approve?status=all|reviewed|approved|rejected&q=...
 * ใช้แสดงรายการสำหรับ ผอ. (อนุมัติ/ไม่อนุมัติ)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "reviewed").toLowerCase();
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    let query = supabaseAdmin
      .from("leaverequest")
      .select(`
        leave_request_id,
        status,
        reason,
        date_start,
        date_end,
        date_start_type,
        date_end_type,
        total_day,
        leave_type_id,
        users:user_id ( prename, name, surname ),
        leavetype:leave_type_id ( leave_type_name )
      `)
      .order("date_start", { ascending: false });

    if (["reviewed", "approved", "rejected"].includes(status)) {
      query = query.eq("status", status as Status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // กรองค้นหาอย่างง่าย
    const items = (data || []).filter((r: any) => {
      if (!q) return true;
      const fullName = `${r.users?.name ?? ""} ${r.users?.surname ?? ""}`.toLowerCase();
      const email = (r.users?.email ?? "").toLowerCase();
      const typeName = (r.leavetype?.leave_type_name ?? "").toLowerCase();
      const idStr = `l${String(r.leave_request_id ?? "").padStart(3, "0")}`;
      return fullName.includes(q) || email.includes(q) || typeName.includes(q) || idStr.includes(q);
    });

    // จัดรูปทรงที่หน้า UI ใช้
    const shaped = items.map((r: any) => ({
      leave_request_id: Number(r.leave_request_id),
      status: r.status as Status,
      reason: r.reason ?? null,
      date_start: r.date_start ?? null,
      date_end: r.date_end ?? null,
      date_start_type: r.date_start_type ?? null,
      date_end_type: r.date_end_type ?? null,
      total_day: Number(r.total_day ?? 0),
      leave_type_name: r.leavetype?.leave_type_name ?? null,
      user: {
        name: r.users?.name ?? "",
        surname: r.users?.surname ?? "",
        email: r.users?.email ?? "",
      },
    }));

    return NextResponse.json({ items: shaped });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}

/* ------------------------------- POST ------------------------------ */
/**
 * POST /api/supervisor/leave-approve
 * body: { action: "approved" | "rejected", payload: { id:number, note?:string } }
 *
 * เงื่อนไข:
 * - อนุญาตเฉพาะใบลาที่ status = 'reviewed'
 * - approved  : userleavequota.total_used += total_day,
 *               userleavequota.total_remaining -= total_day,
 *               userleavequota.reserved = max(0, reserved - total_day)
 * - rejected  : userleavequota.reserved = max(0, reserved - total_day)
 */
export async function POST(req: NextRequest) {
  try {
    // ใช้ session จริงของ ผอ. (ผ่าน cookies/headers ของผู้ใช้) 
    const base = NextResponse.json({});
    const supabase = createSupabaseServerRoute(req, base);

    // auth ผอ.
    const { data: u, error: uErr } = await supabase.auth.getUser();
    const approver = u?.user;
    if (uErr || !approver?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || "").toString() as Action;
    const id = Number(body?.payload?.id);
    const note = (body?.payload?.note || "").toString().trim();

    if (!id || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    // 1) ต้องเป็น reviewed เท่านั้น
    const { data: lr, error: lrErr } = await supabase
      .from("leaverequest")
      .select("leave_request_id, user_id, leave_type_id, total_day, year, status, date_start")
      .eq("leave_request_id", id)
      .single();

    if (lrErr || !lr) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
    if (lr.status !== "reviewed") {
      return NextResponse.json({ error: "NOT_APPROVABLE" }, { status: 409 });
    }

    const totalDay = Number(lr.total_day ?? 0);
    const fiscalYear =
      typeof lr.year === "number" && !Number.isNaN(lr.year)
        ? lr.year
        : getFiscalYearFromISO(String(lr.date_start));

    // 2) อัปเดตสถานะใบลาเป็น approved|rejected
    {
      const { error } = await supabase
        .from("leaverequest")
        .update({
          status: action,
          approved_by: approver.id,
          approved_at: new Date().toISOString(),
          comment: note || null,
          year: fiscalYear,
        })
        .eq("leave_request_id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3) อัปเดต quota ของปีงบ (ใช้ admin client เพื่อความชัวร์เรื่อง RLS)
    const { data: quota, error: qErr } = await supabaseAdmin
      .from("userleavequota")
      .select("user_leave_quota_id, total_used, total_remaining, reserved")
      .eq("user_id", lr.user_id)
      .eq("leave_type_id", lr.leave_type_id)
      .eq("year", fiscalYear)
      .maybeSingle();

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });
    if (!quota) return NextResponse.json({ error: "QUOTA_NOT_FOUND" }, { status: 409 });

    const usedNow = Number(quota.total_used ?? 0);
    const remainingNow = Number(quota.total_remaining ?? 0);
    const reservedNow = Number(quota.reserved ?? 0);

    if (action === "approved") {
      // ใช้สิทธิ์จริง: used+, remaining-, reserved-
      const next = {
        total_used: usedNow + totalDay,
        total_remaining: remainingNow - totalDay,
        reserved: Math.max(0, reservedNow - totalDay),
      };
      const { error } = await supabaseAdmin
        .from("userleavequota")
        .update(next)
        .eq("user_leave_quota_id", quota.user_leave_quota_id);

      if (error) {
        // rollback สถานะใบลา
        await supabase.from("leaverequest").update({ status: "reviewed" }).eq("leave_request_id", id);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      // คืนสิทธิ์ที่จองไว้: reserved-
      const next = { reserved: Math.max(0, reservedNow - totalDay) };
      const { error } = await supabaseAdmin
        .from("userleavequota")
        .update(next)
        .eq("user_leave_quota_id", quota.user_leave_quota_id);

      if (error) {
        await supabase.from("leaverequest").update({ status: "reviewed" }).eq("leave_request_id", id);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, id, status: action, year: fiscalYear });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
