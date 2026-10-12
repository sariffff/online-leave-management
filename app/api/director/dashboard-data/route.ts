// app/api/director/dashboard-data/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/* ===================== Types ===================== */
type Row = {
  leave_request_id: number;
  user_id: string | null;
  date_start: string | null;  // "YYYY-MM-DD"
  date_end: string | null;    // "YYYY-MM-DD"
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number | string | null;
  reason: string | null;
  status: string | null;      // approved | rejected
  timestamp: string | null;
  comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  users: {
    prename?: string | null;
    name?: string | null;
    surname?: string | null;
    email?: string | null;
  } | null;
  leavetype: { leave_type_name: string | null } | null;
};

type Item = {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type: string;
  date_end_type: string;
  totalDays: number;
  status: "approved" | "rejected";
  statusLabel: "approved" | "rejected";
  submittedAt: string | null;
  reason: string | null;
  comment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  user: {
    name: string;
    surname: string;
    email: string;
  };
};

const STATUS_SET = ["approved", "rejected"] as const;

/* ============== Helpers: ช่วงวันที่ (FY/Calendar/Month) ============== */
// FY(y) = 1 ต.ค. (y-1) – 30 ก.ย. (y)
function fyRange(y: number) {
  return { start: `${y - 1}-10-01`, end: `${y}-09-30` };
}
function calendarRange(y: number) {
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}
function monthRange(y: number, m: number) {
  const mm = String(m).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/* ============== ดึง email จาก auth.users ด้วย Service role ============== */
async function fetchEmailsByIds(userIds: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  const emailMap: Record<string, string> = {};
  for (const id of uniq) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (!error && data?.user) {
      emailMap[id] = data.user.email ?? "";
    } else {
      emailMap[id] = "";
    }
  }
  return emailMap;
}

/* ===================== ROUTE ===================== */
export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);

    // --- พารามิเตอร์ (optional) ---
    const mode = (url.searchParams.get("mode") || "all").toLowerCase(); // all|fy|calendar|month
    const year = Number(url.searchParams.get("year") || 0);             // 2025 ...
    const month = Number(url.searchParams.get("month") || 0);           // 1-12
    const leaveType = (url.searchParams.get("leaveType") || "").trim(); // ชื่อประเภทลา
    const statusParam = (url.searchParams.get("status") || "").trim().toLowerCase(); // approved|rejected|all
    const mineParam = (url.searchParams.get("mine") || "").toLowerCase();
    const mine = mineParam === "1" || mineParam === "true";             // เฉพาะที่ฉันอนุมัติ?

    // “ดึงทั้งหมด” (ไม่ paginate) ตั้งเพดานสูงพอสำหรับ dashboard
    const page = 1;
    const pageSize = Math.min(10000, Number(url.searchParams.get("pageSize") || 10000));

    // --- select fields ---
    const baseFields = [
      "leave_request_id",
      "user_id",
      "date_start",
      "date_end",
      "date_start_type",
      "date_end_type",
      "total_day",
      "reason",
      "status",
      "timestamp",
      "comment",
      "reviewed_by",
      "reviewed_at",
      "approved_by",
      "approved_at",
      "users:user_id ( prename, name, surname )",
      leaveType
        ? "leavetype:leave_type_id!inner( leave_type_name )"
        : "leavetype:leave_type_id( leave_type_name )",
    ].join(", ");

    let q = g.supa
      .from("leaverequest")
      .select(baseFields, { count: "exact" })
      .in("status", STATUS_SET as unknown as string[])
      .order("date_start", { ascending: false });

    if (mine) {
      q = q.eq("approved_by", g.user.id);
    }
    if (leaveType) {
      q = q.eq("leavetype.leave_type_name", leaveType);
    }
    if (statusParam && statusParam !== "all") {
      const s = statusParam === "approved" ? "approved" : "rejected";
      q = q.eq("status", s);
    }

    // --- กรองช่วงวันที่ตาม mode (ถ้าอยากกรอง) ---
    if (mode === "fy" && year) {
      const r = fyRange(year);
      q = q.gte("date_start", r.start).lte("date_start", r.end);
    } else if (mode === "calendar" && year) {
      const r = calendarRange(year);
      q = q.gte("date_start", r.start).lte("date_start", r.end);
    } else if (mode === "month" && year && month) {
      const r = monthRange(year, month);
      q = q.gte("date_start", r.start).lte("date_start", r.end);
    }
    // mode=all => ไม่กรองช่วงวันที่ (ดึงทั้งหมด)

    // --- ดึงข้อมูลทั้งหมดภายใต้เพดาน pageSize ---
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await q.range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data as Row[]) ?? [];

    // enrich email จาก auth.users
    const userIds = rows.map((r) => r.user_id).filter((v): v is string => !!v);
    const emailMap = await fetchEmailsByIds(userIds);

    // map -> items
    const items: Item[] = rows.map((r) => {
      const totalDays = Number(r.total_day ?? 0);
      const rawStatus = (r.status || "").toLowerCase();
      const status = (rawStatus === "approved" ? "approved" : "rejected") as Item["status"];
      const emailFromAuth = r.user_id ? (emailMap[r.user_id] ?? "") : "";
      return {
        id: String(r.leave_request_id),
        userId: r.user_id ?? "",
        leaveType: r.leavetype?.leave_type_name ?? "ไม่ระบุ",
        startDate: r.date_start ?? "",
        endDate: r.date_end ?? "",
        date_start_type: r.date_start_type ?? "เต็มวัน",
        date_end_type: r.date_end_type ?? "เต็มวัน",
        totalDays,
        status,
        statusLabel: status,
        submittedAt: r.timestamp ?? null,
        reason: r.reason ?? null,
        comment: r.comment ?? null,
        reviewedBy: r.reviewed_by ?? null,
        reviewedAt: r.reviewed_at ?? null,
        approvedBy: r.approved_by ?? null,
        approvedAt: r.approved_at ?? null,
        user: {
          name: r.users?.name ?? "",
          surname: r.users?.surname ?? "",
          email: emailFromAuth,
        },
      };
    });

    // -------- Summary --------
    // byUser
    const byUserMap = new Map<string, { userId: string; name: string; surname: string; email: string; count: number }>();
    for (const it of items) {
      const key = it.userId || `NA-${it.id}`;
      const existed = byUserMap.get(key);
      if (existed) existed.count += 1;
      else byUserMap.set(key, { userId: it.userId, name: it.user.name, surname: it.user.surname, email: it.user.email, count: 1 });
    }
    const byUser = Array.from(byUserMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

    // byType
    const byTypeMap = new Map<string, number>();
    for (const it of items) {
      const t = it.leaveType || "ไม่ระบุ";
      byTypeMap.set(t, (byTypeMap.get(t) || 0) + 1);
    }
    const byType = Array.from(byTypeMap, ([name, count]) => ({ name, count }));

    // byStatus
    let approvedCount = 0, rejectedCount = 0;
    for (const it of items) (it.status === "approved" ? approvedCount++ : rejectedCount++);

    // ปี/เดือนที่ปรากฏในข้อมูล (เผื่อ UI ใช้เป็นตัวเลือก)
    const yearsInData = Array.from(
      new Set(
        items
          .map((it) => it.startDate || it.endDate)
          .filter(Boolean)
          .map((d) => Number(String(d).slice(0, 4)))
      )
    ).filter((y) => !isNaN(y as number)).sort((a, b) => a - b);

    // bucket เดือนในปีที่เลือก (ถ้าส่ง year มา)
    let monthsInYear: { month: number; count: number }[] | undefined = undefined;
    if (year) {
      const bucket: Record<number, number> = { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0 };
      for (const it of items) {
        const s = it.startDate || it.endDate;
        if (!s) continue;
        const y = Number(s.slice(0, 4));
        const m = Number(s.slice(5, 7));
        if (y === year && m >= 1 && m <= 12) bucket[m] = (bucket[m] || 0) + 1;
      }
      monthsInYear = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: bucket[i + 1] || 0 }));
    }

    return NextResponse.json({
      data: items,
      total: count ?? items.length,
      requestCount: items.length,
      summary: {
        byUser,
        byType,
        byStatus: { approved: approvedCount, rejected: rejectedCount },
      },
      yearsInData,
      monthsInYear, // ถ้า year ถูกระบุ
      page,
      pageSize,
      totalPages: 1, // โหมดดึงทั้งหมด
      mode, year, month,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}