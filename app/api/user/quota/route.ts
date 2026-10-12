// app/api/user/quota/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

// ✅ พยายามรองรับทั้ง supabaseAdmin และ supabaseServer โดยไม่ให้แตกแม้ export ต่างรูปแบบ
import * as Admin from "@/lib/supabaseAdmin";
import * as Server from "@/lib/supabaseServer";

export const runtime = "nodejs";

/** แปลง พ.ศ. -> ค.ศ. */
function thToCe(th: number) {
  return th - 543;
}

/** ปีงบประมาณค.ศ. -> ช่วงวันที่ (ค.ศ.) เช่น 2026 => 2025-10-01 .. 2026-09-30 */
function getFiscalYearRange(fiscalYearCE: number) {
  const start = new Date(fiscalYearCE - 1, 9, 1); // Oct 1 of previous CE year
  const end = new Date(fiscalYearCE, 8, 30, 23, 59, 59, 999); // Sep 30 of this CE year
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** ปีงบประมาณปัจจุบัน (ค.ศ.) */
function currentFiscalYearCE(today = new Date()): number {
  const m = today.getMonth(); // 0=Jan ... 9=Oct
  const y = today.getFullYear();
  return m >= 9 ? y + 1 : y;
}

/** parse ตัวเลขที่อาจเป็น string/number */
function toNumber(n: unknown, fallback = 0): number {
  const x =
    typeof n === "string" ? parseFloat(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(x) ? x : fallback;
}

/** สร้าง supabase client แบบกันพัง ไม่ว่าคุณจะ export มาเป็น instance หรือ function */
function getSupabaseSafe() {
  // ลอง supabaseServer ก่อน
  const maybeServer =
    (Server as any)?.default ?? (Server as any)?.supabaseServer ?? null;
  if (maybeServer) {
    try {
      return typeof maybeServer === "function" ? maybeServer() : maybeServer;
    } catch {
      // ถ้าเรียกแล้วพัง ให้ตกมาลอง admin ต่อ
    }
  }

  // ลอง supabaseAdmin ต่อ
  const maybeAdmin =
    (Admin as any)?.default ?? (Admin as any)?.supabaseAdmin ?? null;
  if (maybeAdmin) {
    try {
      return typeof maybeAdmin === "function" ? maybeAdmin() : maybeAdmin;
    } catch {
      // ถ้ายังพัง ค่อย throw ด้านล่าง
    }
  }

  throw new Error(
    "Supabase client not found. Please export supabaseAdmin or supabaseServer from /lib."
  );
}

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth();
    const supabase = getSupabaseSafe();

    const { searchParams } = new URL(req.url);
    const leaveTypeId = Number(searchParams.get("leaveTypeId") || 0);
    if (!leaveTypeId) {
      return NextResponse.json(
        { error: "ต้องระบุ leaveTypeId (number)" },
        { status: 400 }
      );
    }

    // ปีงบประมาณ
    let fiscalYearCE: number;
    if (searchParams.get("fy_th")) {
      fiscalYearCE = thToCe(Number(searchParams.get("fy_th")));
    } else if (searchParams.get("fiscalYear")) {
      fiscalYearCE = Number(searchParams.get("fiscalYear"));
    } else {
      fiscalYearCE = currentFiscalYearCE();
    }
    const { startDate, endDate } = getFiscalYearRange(fiscalYearCE);

    // === ดึง max_leave_day จากตารางประเภทการลา (เผื่อบางโปรเจกต์ใช้ชื่อ leavetype หรือ leave_type) ===
    let maxDays = 0;

    // 1) ลอง leavetype
    {
      const { data, error } = await supabase
        .from("leavetype")
        .select("leave_type_id, max_leave_day")
        .eq("leave_type_id", leaveTypeId)
        .maybeSingle();

      if (!error && data) {
        maxDays = toNumber(data.max_leave_day, 0);
      }
    }

    // 2) ถ้ายังไม่ได้ ลอง leave_type
    if (!maxDays) {
      const { data, error } = await supabase
        .from("leave_type")
        .select("leave_type_id, max_leave_day")
        .eq("leave_type_id", leaveTypeId)
        .maybeSingle();

      if (!error && data) {
        maxDays = toNumber(data.max_leave_day, 0);
      }
    }

    // ถ้าไม่มีในตาราง type ให้เป็น 0 (UI จะจัดการ fallback เอง)
    // === รวมใบลาในช่วงปีงบประมาณนี้ ===
    const { data: rows, error: lrErr } = await supabase
      .from("leaverequest")
      .select("total_day, status, date_start")
      .eq("user_id", user.id)
      .eq("leave_type_id", leaveTypeId)
      .gte("date_start", startDate)
      .lte("date_start", endDate);

    if (lrErr) {
      return NextResponse.json(
        { error: "อ่านใบลาผิดพลาด", detail: lrErr.message },
        { status: 500 }
      );
    }

    let used = 0;
    let reserved = 0;
    for (const r of rows || []) {
      const d = toNumber(r.total_day, 0);
      if (r.status === "approved") used += d;
      else if (r.status === "pending") reserved += d;
      // ถ้ามีสถานะอื่นที่นับจองสิทธิ์ด้วย เพิ่มที่นี่
      // else if (r.status === "reviewed" || r.status === "under_review") reserved += d;
    }

    const remaining = Math.max(0, maxDays - used);

    return NextResponse.json(
      {
        quota: {
          user_leave_quota_id: null, // ถ้ามีตาราง quota จริง ใส่ได้
          user_id: user.id,
          leave_type_id: leaveTypeId,
          total_used: used,
          total_remaining: remaining,
          reserved,
          year: fiscalYearCE, // เก็บค.ศ. ของปีงบ
        },
        max_days: maxDays,
        meta: {
          fiscal_year_ce: fiscalYearCE,
          fiscal_year_th: fiscalYearCE + 543,
          range: { start: startDate, end: endDate },
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}