// app/api/academic/leaves/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);
    const toInt = (v: string | null, d = 1) => {
      const n = Number(v ?? d);
      return Number.isFinite(n) && n > 0 ? n : d;
    };

    const page     = toInt(url.searchParams.get("page"), 1);
    const pageSize = toInt(url.searchParams.get("pageSize"), 10);
    const status   = (url.searchParams.get("status") || "approved").toLowerCase();
    const year     = url.searchParams.get("year") || undefined;
    const leaveType = url.searchParams.get("leaveType") || undefined;

    // 1) ดึงใบลา (รวม user + ประเภทลา)
    let q = g.supa
      .from("leaverequest")
      .select(
        `
        leave_request_id,
        user_id,
        date_start,
        date_end,
        date_start_type,
        date_end_type,
        total_day,
        reason,
        timestamp,
        status,
        comment,
        approved_by,
        leavetype(leave_type_name),
        user:user_id(
          user_id,
          prename,
          name,
          surname
                )
      `,
        { count: "exact" }
      )
      .eq("status", status)
      .order("timestamp", { ascending: false });

    if (leaveType) q = q.eq("leavetype.leave_type_name", leaveType);

    // ปีงบประมาณ 
    if (year && /^\d{4}$/.test(year)) {
      const fy = Number(year);
      const start = `${fy - 1}-10-01`;
      const end   = `${fy}-09-30`;
      q = q.gte("date_start", start).lte("date_start", end);
    }

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const { data: raw, error, count } = await q.range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = Array.isArray(raw) ? raw : [];

    // 2) กรองคนที่เป็นครู
    const userIds = Array.from(
      new Set(
        rows.map((r: any) => r?.user_id).filter((v: any) => typeof v === "string" && v.length > 0)
      )
    );

    let teacherUserIds = new Set<string>();
    if (userIds.length > 0) {
      const t = await g.supa
        .from("teacher")
        .select("user_id")
        .in("user_id", userIds);
      if (t.error) return NextResponse.json({ error: t.error.message }, { status: 500 });
      teacherUserIds = new Set(
        (t.data || [])
          .map((x: any) => x?.user_id)
          .filter((v: any) => typeof v === "string" && v.length > 0)
      );
    }

    const filtered = rows.filter((r: any) => teacherUserIds.has(r.user_id));

    const items = filtered.map((r: any) => ({
      id: String(r.leave_request_id),
      fullName: [r.user?.prename, r.user?.name, r.user?.surname].filter(Boolean).join(" ").trim(),
      leaveType: r.leavetype?.leave_type_name ?? "ไม่ระบุ",
      startDate: r.date_start,
      endDate: r.date_end,
      date_start_type: r.date_start_type ?? "full",
      date_end_type: r.date_end_type ?? "full",
      totalDays: Number(r.total_day ?? 0),
      status: r.status,
      submittedAt: r.timestamp,
      reason: r.reason ?? null,
      approvedBy: r.approved_by ?? null,
      comment: r.comment ?? null,
    }));

    return NextResponse.json({
      data: items,
      total: count ?? filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? filtered.length) / pageSize)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) || "failed" }, { status: 500 });
  }
}
