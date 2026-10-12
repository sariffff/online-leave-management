// app/api/supervisor/reviewed-history/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type FileItem = { key: string; url: string | null };

type Row = {
  leave_request_id: number;
  date_start: string | null;
  date_end: string | null;
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number | string | null;
  reason: string | null;
  status: string | null;        // reviewed | approved | rejected | failed | ...
  timestamp: string | null;
  comment: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  file: string | string[] | null; // เก็บคีย์ไฟล์ใน storage (string หรือ JSON string[])
  users: { prename?: string|null; name?: string|null; surname?: string|null } | null;
  leavetype: { leave_type_name: string | null } | null;
};

const BUCKET = "leave-attachments";
const SIGN_TTL = 60 * 5; // 5 นาที

// ✅ รวม failed ด้วย
const STATUS_FOR_REVIEWED_PAGE = ["reviewed", "approved", "rejected", "failed"] as const;

function toFYRange(yearStr?: string | null) {
  if (!yearStr || !/^\d{4}$/.test(yearStr)) return null;
  const y = Number(yearStr);
  // ปีงบประมาณ: 1 ต.ค. (y-1) ถึง 30 ก.ย. (y)
  return { start: `${y - 1}-10-01`, end: `${y}-09-30` };
}

// บนหน้านี้อยากติดป้าย "reviewed" เหมือนกันสำหรับ reviewed/approved/rejected/failed
const toStatusLabel = (s?: string | null) => {
  const v = (s || "").toLowerCase();
  return (STATUS_FOR_REVIEWED_PAGE as readonly string[]).includes(v) ? "reviewed" : (s || "");
};

// แปลง file -> string[]
function toKeyList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
      } catch {}
    }
    return [s];
  }
  return [];
}

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  try {
    const url = new URL(req.url);
    const page      = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize  = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 10)));
    const leaveType = (url.searchParams.get("leaveType") || "").trim(); // ชื่อประเภทลา (ไทย)
    const year      = (url.searchParams.get("year") || "").trim();      // ปีงบประมาณ (ค.ศ.)
    const startDate = (url.searchParams.get("startDate") || "").trim(); // yyyy-MM-dd
    const endDate   = (url.searchParams.get("endDate") || "").trim();   // yyyy-MM-dd

    // ✅ คิวรีเฉพาะใบลาที่อยู่ในชุด reviewed/approved/rejected/failed และ "ฉันเป็นผู้รีวิว"
    let q = g.supa
      .from("leaverequest")
      .select(
        `
        leave_request_id,
        date_start,
        date_end,
        date_start_type,
        date_end_type,
        total_day,
        reason,
        status,
        timestamp,
        comment,
        reviewed_by,
        approved_by,
        approved_at,
        file,
        users:user_id ( prename, name, surname ),
        leavetype:leave_type_id ( leave_type_name )
        `,
        { count: "exact" }
      )
      .in("status", STATUS_FOR_REVIEWED_PAGE as unknown as string[])
      .eq("reviewed_by", g.user.id)
      .order("leave_request_id", { ascending: false });

    if (leaveType) {
      q = q.eq("leavetype.leave_type_name", leaveType);
    }

    // ปีงบประมาณ (ยึด date_start)
    const fy = toFYRange(year);
    if (fy) q = q.gte("date_start", fy.start).lte("date_start", fy.end);

    // ช่วงวันที่ (ยึด date_start)
    if (startDate) q = q.gte("date_start", startDate);
    if (endDate)   q = q.lte("date_start", endDate);

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const { data, error, count } = await q.range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Row[];

    // ✅ สร้าง signed URL ให้ไฟล์แนบตามคีย์ใน BUCKET
    const items = [];
    for (const r of rows) {
      const keys = toKeyList(r.file);
      const files: FileItem[] = [];
      for (const key of keys) {
        const { data: s, error: se } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(key, SIGN_TTL);
        files.push({ key, url: se ? null : (s?.signedUrl ?? null) });
      }

      const rawStatus = (r.status || "").toLowerCase();
      const statusLabel = toStatusLabel(rawStatus);

      items.push({
        id: String(r.leave_request_id),
        leaveType: r.leavetype?.leave_type_name ?? "ไม่ระบุ",
        startDate: r.date_start ?? "",
        endDate: r.date_end ?? "",
        date_start_type: r.date_start_type ?? "full",
        date_end_type: r.date_end_type ?? "full",
        totalDays: Number(r.total_day ?? 0),

        status: rawStatus,     // raw จาก DB
        statusLabel,           // สำหรับโชว์บน reviewed-history

        submittedAt: r.timestamp ?? null,
        reason: r.reason ?? null,
        comment: r.comment ?? null,
        approvedBy: r.approved_by ?? null,
        approvedAt: r.approved_at ?? null,

        user: {
          name: r.users?.name ?? "",
          surname: r.users?.surname ?? "",
        },

        files, // [{ key, url }]
      });
    }

    return NextResponse.json({
      data: items,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}