import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // instance

export const runtime = "nodejs";

type SummaryItem = {
  leave_type_id: number;
  name: string;
  note: string | null;
  max_leave_day: number | null;
  carry_over_max: number | null;
  used: number;
  remaining: number;
  reserved: number;
  total: number;
  available: number;
  percentUsed: number;
};

type DebugRow = {
  id: number | string;
  leave_type_id: number;
  status: string;
  total_day: number;
  date_start: string;
  date_end: string;
  year?: number;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// สร้างวันที่แบบ UTC เพื่อไม่ให้ toISOString() ลบวัน
const toISO = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

// FY ไทย: 1 ต.ค. (ปี-1) – 30 ก.ย. (ปี)
function fiscalRangeUTC(year: number) {
  return { start: toISO(year - 1, 9, 1), end: toISO(year, 8, 30) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";
  const wantBreakdown = searchParams.get("breakdown") === "1";

  try {
    const g = await requireAuth();
    if (!g.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    const userId = g.user.id as string;

    const scope = searchParams.get("scope") ?? "summary";
    const yearParam = Number(searchParams.get("year") ?? new Date().getFullYear());
    const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
    if (scope !== "summary") {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_SCOPE" }, { status: 400 });
    }

    const { start: fyStart, end: fyEnd } = fiscalRangeUTC(year);
    const { start: prevStart, end: prevEnd } = fiscalRangeUTC(year - 1);

    const supabase = supabaseAdmin;

    // 1) ประเภทการลา (คอลัมน์จริง leave_type_name)
    const { data: typesRaw, error: typeErr } = await supabase
      .from("leavetype")
      .select("leave_type_id, leave_type_name, note, max_leave_day, carry_over_max")
      .order("leave_type_id", { ascending: true });

    if (typeErr) {
      return NextResponse.json(
        { ok: false, error: "TYPE_FETCH_FAILED", detail: debug ? typeErr : undefined },
        { status: 500 }
      );
    }
    if (!typesRaw?.length) {
      return NextResponse.json({ ok: true, userId, year, items: [] as SummaryItem[] });
    }

    // 2) ปีงบ "ปัจจุบัน" → ใช้คอลัมน์ `year = ปีที่เลือก`
    const { data: nowReq, error: nowErr } = await supabase
      .from("leaverequest")
      .select("leave_request_id, leave_type_id, total_day, status, date_start, date_end, user_id, year")
      .eq("user_id", userId)
      .eq("year", year) // ✅ กำหนดตามปีงบในคอลัมน์
      .in("status", ["approved", "pending"]);

    if (nowErr) {
      return NextResponse.json(
        { ok: false, error: "NOW_FETCH_FAILED", detail: debug ? nowErr : undefined },
        { status: 500 }
      );
    }

    // 3) ปีงบ "ก่อนหน้า" (สำหรับ carry) → `year = ปีที่เลือก - 1` เฉพาะ approved
    const { data: prevReq, error: prevErr } = await supabase
      .from("leaverequest")
      .select("leave_request_id, leave_type_id, total_day, status, date_start, date_end, user_id, year")
      .eq("user_id", userId)
      .eq("year", year - 1) // ✅ ปีงบก่อนหน้า
      .in("status", ["approved"]);

    if (prevErr) {
      return NextResponse.json(
        { ok: false, error: "PREV_FETCH_FAILED", detail: debug ? prevErr : undefined },
        { status: 500 }
      );
    }

    // 4) รวมยอด
    const usedNow = new Map<number, number>();
    const reservedNow = new Map<number, number>();
    const dbgNow: Record<number, { approved: DebugRow[]; pending: DebugRow[] }> = {};
    const dbgPrev: Record<number, { approved: DebugRow[] }> = {};

    for (const r of nowReq ?? []) {
      const k = Number(r.leave_type_id);
      const d = num(r.total_day);
      if (r.status === "approved") {
        usedNow.set(k, num(usedNow.get(k)) + d);
        if (wantBreakdown) (dbgNow[k] ??= { approved: [], pending: [] }).approved.push({
          id: r.leave_request_id, leave_type_id: k, status: r.status, total_day: d,
          date_start: r.date_start, date_end: r.date_end, year: r.year
        });
      } else if (r.status === "pending") {
        reservedNow.set(k, num(reservedNow.get(k)) + d);
        if (wantBreakdown) (dbgNow[k] ??= { approved: [], pending: [] }).pending.push({
          id: r.leave_request_id, leave_type_id: k, status: r.status, total_day: d,
          date_start: r.date_start, date_end: r.date_end, year: r.year
        });
      }
    }

    const usedPrev = new Map<number, number>();
    for (const r of prevReq ?? []) {
      const k = Number(r.leave_type_id);
      const d = num(r.total_day);
      usedPrev.set(k, num(usedPrev.get(k)) + d);
      if (wantBreakdown) (dbgPrev[k] ??= { approved: [] }).approved.push({
        id: r.leave_request_id, leave_type_id: k, status: r.status, total_day: d,
        date_start: r.date_start, date_end: r.date_end, year: r.year
      });
    }

    // 5) คำนวณผลลัพธ์
    const items: SummaryItem[] = (typesRaw as any[]).map((t) => {
      const k = Number(t.leave_type_id);
      const name = String(t.leave_type_name ?? "");
      const note = t.note ?? null;
      const maxLeave = num(t.max_leave_day);
      const carryMax = num(t.carry_over_max);

      const prevUsed = num(usedPrev.get(k));
      const prevRemain = Math.max(0, maxLeave - prevUsed);
      const carriedOver = Math.max(0, Math.min(prevRemain, carryMax));

      const total = Math.max(0, maxLeave + carriedOver);
      const used = Math.max(0, num(usedNow.get(k)));
      const reserved = Math.max(0, num(reservedNow.get(k)));

      const remaining = Math.max(0, total - used);
      const available = Math.max(0, total - used - reserved);
      const percentUsed = total > 0 ? Math.min(100, Math.max(0, +(((used / total) * 100).toFixed(2)))) : 0;

      return {
        leave_type_id: k,
        name, note,
        max_leave_day: t.max_leave_day ?? 0,
        carry_over_max: t.carry_over_max ?? 0,
        used, reserved, total, remaining, available, percentUsed,
      };
    });

    if (wantBreakdown) {
      return NextResponse.json({
        ok: true,
        userId,
        year,
        items,
        breakdown: {
          now: dbgNow,
          prev: dbgPrev,
          fy: { start: fyStart, end: fyEnd },
          prevFy: { start: prevStart, end: prevEnd }
        }
      });
    }

    return NextResponse.json({ ok: true, userId, year, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "INTERNAL_ERROR", stack: debug ? e?.stack : undefined },
      { status: 500 }
    );
  }
}
