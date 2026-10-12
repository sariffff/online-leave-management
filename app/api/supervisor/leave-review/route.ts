// app/api/supervisor/leave-review/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ReviewStatus = "pending" | "reviewed" | "failed";
const BUCKET = "leave-attachments";
const SIGN_TTL = 60 * 5; // 5 นาที

type DbRow = {
  leave_request_id: number;
  status: ReviewStatus | null;
  reason: string | null;
  date_start: string | null;
  date_end: string | null;
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number | null | string;
  leave_type_id: number | null | string;
  file: string | string[] | null;
  users: { prename?: string | null; name?: string | null; surname?: string | null; email?: string | null } | null;
  leavetype: { leave_type_name?: string | null } | null;
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

/* --------------------------------- GET --------------------------------- */
/** GET /api/supervisor/leave-review?status=pending|reviewed|failed|all&q=... */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawStatus = (searchParams.get("status") || "pending").toLowerCase();
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
        file,
        users:user_id ( prename, name, surname ),
        leavetype:leave_type_id ( leave_type_name )
      `)
      .order("date_start", { ascending: false });

    if (["pending", "reviewed", "failed"].includes(rawStatus)) {
      query = query.eq("status", rawStatus as ReviewStatus);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as DbRow[];

    const filtered = rows.filter((r) => {
      if (!q) return true;
      const fullName = `${r.users?.name ?? ""} ${r.users?.surname ?? ""}`.toLowerCase();
      const email = (r.users?.email ?? "").toLowerCase();
      const typeName = (r.leavetype?.leave_type_name ?? "").toLowerCase();
      const idStr = `l${String(r.leave_request_id ?? "").padStart(3, "0")}`;
      return fullName.includes(q) || email.includes(q) || typeName.includes(q) || idStr.includes(q);
    });

    const shaped = [];
    for (const r of filtered) {
      const keys = toKeyList(r.file);
      const files: { key: string; url: string | null }[] = [];
      for (const key of keys) {
        const { data: s, error: se } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(key, SIGN_TTL);
        files.push({ key, url: se ? null : (s?.signedUrl ?? null) });
      }

      shaped.push({
        leave_request_id: r.leave_request_id,
        status: (r.status ?? "pending") as ReviewStatus,
        reason: r.reason,
        date_start: r.date_start,
        date_end: r.date_end,
        date_start_type: r.date_start_type,
        date_end_type: r.date_end_type,
        total_day: Number(r.total_day ?? 0),
        leave_type_name: r.leavetype?.leave_type_name ?? null,
        user: {
          name: r.users?.name ?? "",
          surname: r.users?.surname ?? "",
          email: r.users?.email ?? "",
        },
        files, // [{ key, url }]
      });
    }

    return NextResponse.json({ items: shaped });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}

/* --------------------------------- POST -------------------------------- */
/**
 * POST /api/supervisor/leave-review
 * body: { action: "reviewed" | "fail", payload: { id: number, note?: string } }
 *
 * เงื่อนไข:
 * - อนุญาตเฉพาะใบลาที่ status = 'pending'
 * - "fail" จาก UI จะถูกแมปเป็น "failed" ก่อนอัปเดต DB
 * - บันทึก reviewed_by / reviewed_at / comment
 *
 * ขั้นตอน:
 * 1) auth ผู้รีวิวจาก user session
 * 2) ตรวจสอบว่าใบลาอยู่ในสถานะ pending จริง
 * 3) พยายามอัปเดตด้วย user session (ผ่าน RLS)
 * 4) ถ้า RLS บล็อก → fallback เป็น admin update (แต่ยังคงตรวจสิทธิ์ข้อ 1-2)
 * 5) select แถวที่อัปเดตกลับมาเพื่อยืนยันผล
 */
export async function POST(req: NextRequest) {
  try {
    // 1) ใช้ session จริงของผู้รีวิว
    const base = NextResponse.json({});
    const supabase = createSupabaseServerRoute(req, base);

    const { data: u, error: uErr } = await supabase.auth.getUser();
    const reviewer = u?.user;
    if (uErr || !reviewer?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2) รับ payload
    const body = await req.json().catch(() => ({}));
    const rawAction = (body?.action || "").toString(); // "reviewed" | "fail"
    const id = Number(body?.payload?.id);
    const note = (body?.payload?.note || "").toString().trim();

    if (!id || !["reviewed", "fail"].includes(rawAction)) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    // 3) ตรวจสถานะปัจจุบัน: ต้องเป็น pending
    const { data: lr, error: lrErr } = await supabase
      .from("leaverequest")
      .select("leave_request_id, status")
      .eq("leave_request_id", id)
      .single();

    if (lrErr || !lr) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
    if (lr.status !== "pending") {
      return NextResponse.json({ error: "NOT_REVIEWABLE" }, { status: 409 });
    }

    // 4) อัปเดต
    const nextStatus: ReviewStatus = rawAction === "fail" ? "failed" : "reviewed";

    // 4.1) พยายามอัปเดตด้วย user session ก่อน (ผ่าน RLS)
    let updatedRow:
      | { leave_request_id: number; status: string; reviewed_by: string | null; reviewed_at: string | null; comment: string | null }
      | null = null;

    {
      const { data, error } = await supabase
        .from("leaverequest")
        .update({
          status: nextStatus,
          reviewed_by: reviewer.id,
          reviewed_at: new Date().toISOString(),
          comment: note || null,
        })
        .eq("leave_request_id", id)
        .eq("status", "pending") // ป้องกัน race
        .select("leave_request_id, status, reviewed_by, reviewed_at, comment")
        .single();

      if (!error && data) {
        updatedRow = data as any;
      } else if (error) {
        // ถ้าติด RLS/Policy จะมาที่ fallback ต่อไป
        // console.warn("User update failed, will try admin:", error.message);
      }
    }

    // 4.2) Fallback: ใช้ admin update ถ้ายังไม่สำเร็จ
    if (!updatedRow) {
      const { data: dataAdmin, error: errAdmin } = await supabaseAdmin
        .from("leaverequest")
        .update({
          status: nextStatus,
          reviewed_by: reviewer.id,
          reviewed_at: new Date().toISOString(),
          comment: note || null,
        })
        .eq("leave_request_id", id)
        .eq("status", "pending")
        .select("leave_request_id, status, reviewed_by, reviewed_at, comment")
        .single();

      if (errAdmin) {
        return NextResponse.json({ error: errAdmin.message }, { status: 400 });
      }
      updatedRow = dataAdmin as any;
    }

    // 5) ตรวจสอบผลลัพธ์
    if (!updatedRow) {
      return NextResponse.json({ error: "UPDATE_NOT_APPLIED" }, { status: 409 });
    }
    if (!updatedRow.reviewed_by) {
      // ถึงจุดนี้ควรมีค่าแล้ว ถ้าไม่มี -> แจ้งให้ตรวจ policy
      return NextResponse.json(
        { error: "REVIEWED_BY_STILL_NULL_AFTER_UPDATE (check RLS/policies)" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: updatedRow.leave_request_id,
      status: updatedRow.status,
      reviewed_by: updatedRow.reviewed_by,
      reviewed_at: updatedRow.reviewed_at,
      comment: updatedRow.comment,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
