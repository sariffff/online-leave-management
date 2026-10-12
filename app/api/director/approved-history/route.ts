// app/api/supervisor/approved-history/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** แถวจาก DB (อิงตามสคีมาจาก INSERT ที่ให้มา) */
type Row = {
  leave_request_id: number;
  user_id: string | null;
  date_start: string | null;
  date_end: string | null;
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number | string | null;
  reason: string | null;
  status: string | null;            // approved | rejected
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
    email?: string | null; // อาจไม่มี แต่เผื่อไว้
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
    email: string; // มาจาก auth.users เป็นหลัก
  };
};

/** FY(y) = 1 ต.ค. (y-1) – 30 ก.ย. (y) */
function toFYRange(yearStr?: string | null) {
  if (!yearStr || !/^\d{4}$/.test(yearStr)) return null;
  const y = Number(yearStr);
  return { start: `${y - 1}-10-01`, end: `${y}-09-30` };
}

const STATUS_FOR_APPROVED_PAGE = ["approved", "rejected"] as const;

/** ดึงอีเมลจาก auth.users ด้วย service role */
async function fetchEmailsByIds(userIds: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  const emailMap: Record<string, string> = {};

  // ทางเลือกง่าย/ตรงไปตรงมา: ดึงทีละ id (อ่านง่ายสุด)
  // ถ้าจำนวนผู้ใช้เยอะมาก ค่อยปรับเป็น listUsers + กรอง/แคช
  for (const id of uniq) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (!error && data?.user) {
      emailMap[id] = data.user.email ?? "";
    } else {
      emailMap[id] = ""; // กัน null
    }
  }
  return emailMap;
}

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);
    const page     = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 10)));
    const leaveType = (url.searchParams.get("leaveType") || "").trim(); // ชื่อประเภทลา
    const year      = (url.searchParams.get("year") || "").trim();      // FY (ค.ศ.)
    const mineParam = (url.searchParams.get("mine") || "").toLowerCase();
    const mine      = mineParam === "1" || mineParam === "true";        // เฉพาะที่ฉันอนุมัติ?

    // สร้าง select สะอาดๆ (ไม่มีคอมเมนต์ในสตริง)
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
    ];
    const baseSelect = baseFields.join(", ");

    let q = g.supa
      .from("leaverequest")
      .select(baseSelect, { count: "exact" })
      .in("status", STATUS_FOR_APPROVED_PAGE as unknown as string[])
      .order("leave_request_id", { ascending: false });

    if (mine) {
      q = q.eq("approved_by", g.user.id);
    }

    if (leaveType) {
      q = q.eq("leavetype.leave_type_name", leaveType);
    }

    const fy = toFYRange(year);
    if (fy) {
      q = q.gte("date_start", fy.start).lte("date_start", fy.end);
    }

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const { data, error, count } = await q.range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data as Row[]) ?? [];

    // enrich email จาก auth.users
    const userIds = rows.map(r => r.user_id).filter((v): v is string => !!v);
    const emailMap = await fetchEmailsByIds(userIds);

    const items: Item[] = rows.map((r) => {
      const totalDays = Number(r.total_day ?? 0);
      const rawStatus = ((r.status || "") as string).toLowerCase();
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
          email: emailFromAuth, // ใช้ email จาก auth.users
        },
      };
    });

    // --------- Summary: นับใบลาต่อคน + ตามประเภท/สถานะ ----------
    // 1) นับใบลาต่อคน (ชื่อ + อีเมล)
    const byUserMap = new Map<
      string,
      { userId: string; name: string; surname: string; email: string; count: number }
    >();
    for (const it of items) {
      const key = it.userId || `NA-${it.id}`;
      const existed = byUserMap.get(key);
      if (existed) {
        existed.count += 1;
      } else {
        byUserMap.set(key, {
          userId: it.userId,
          name: it.user.name,
          surname: it.user.surname,
          email: it.user.email,
          count: 1,
        });
      }
    }
    const byUser = Array.from(byUserMap.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

    // 2) นับตามประเภท
    const byTypeMap = new Map<string, number>();
    // 3) นับตามสถานะ
    let approvedCount = 0, rejectedCount = 0;

    for (const it of items) {
      const typeName = it.leaveType || "ไม่ระบุ";
      byTypeMap.set(typeName, (byTypeMap.get(typeName) || 0) + 1);
      if (it.status === "approved") approvedCount++;
      else rejectedCount++;
    }
    const byType = Array.from(byTypeMap, ([name, count]) => ({ name, count }));

    return NextResponse.json({
      data: items,
      total: count ?? 0,
      requestCount: items.length,
      summary: {
        byUser,                         // [{ userId, name, surname, email, count }]
        byType,                         // [{ name, count }]
        byStatus: { approved: approvedCount, rejected: rejectedCount },
      },
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
