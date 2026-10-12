// app/api/user/leave-history/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

// ===== Config =====
const DEFAULT_PAGE_SIZE = 10;
const BUCKET = process.env.SUPABASE_LEAVE_BUCKET || "leave-attachments";
const SIGN_TTL_SECONDS = Number(process.env.SUPABASE_SIGN_TTL || 60 * 5); // 5 นาที

// ===== Helpers =====
function thStatus(s?: string | null) {
  if (!s || s === "pending") return "รอพิจารณา";
  if (s === "rewiewed") return "ผ่านการตรวจสอบรออนุมัติ";
  if (s === "approved") return "อนุมัติ";
  if (s === "rejected") return "ไม่อนุมัติ";
  if (s === "failed") return "ไม่ผ่านตรวจสอบ";
  if (s === "covered") return "จัดสอนแทนแล้ว";
  if (s === "cancelled") return "ยกเลิก";
  return s;
}

// พยายาม parse ถ้าเป็น JSON string
function safeParseMaybeJson(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const s = input.trim();
  if (!s) return s;
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      return JSON.parse(s);
    } catch {
      return input;
    }
  }
  return input;
}

// ทำความสะอาด path ที่มาผิดรูป เช่น ["public/..."] , "public/..." , encode แปลก ๆ
function cleanPath(p: string): string {
  if (!p) return "";
  let s = p;
  try { s = decodeURIComponent(s); } catch {}
  s = s.trim();

  if (s.startsWith('["') && s.endsWith('"]')) {
    s = s.slice(2, -2);
  } else if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  } else if (s.startsWith("[") && s.endsWith("]")) {
    s = s.slice(1, -1);
  }

  s = s.replace(/^["']+|["']+$/g, "").trim();
  return s;
}

// แปลงค่า file จาก DB → array ของ path (รองรับ array / JSON-string / string เดี่ยว / คั่น comma)
function toPathArray(raw: unknown): string[] {
  const parsed = safeParseMaybeJson(raw);
  if (Array.isArray(parsed)) {
    return parsed.map((v) => cleanPath(String(v || ""))).filter(Boolean);
  }
  if (typeof parsed === "string") {
    const s = cleanPath(parsed);
    if (!s) return [];
    if (s.includes(",")) return s.split(",").map(cleanPath).filter(Boolean);
    return [s];
  }
  return [];
}

// แปลง URL เต็มของ Supabase → key ภายใต้ bucket; หรือ path ภายในโปรเจกต์ให้เป็น key ตาม BUCKET
function toObjectKey(p: string): string | null {
  if (!p) return null;

  // ถ้าเป็น URL ของ Supabase (storage/v1/object/...)
  if (p.startsWith("http")) {
    try {
      const u = new URL(p);
      const parts = u.pathname.split("/").filter(Boolean);
      const i = parts.indexOf("object");
      if (i >= 0) {
        const bucket = parts[i + 2];
        const key = parts.slice(i + 3).join("/");
        if (bucket === BUCKET && key) return key;
      }
    } catch {
      /* ignore */
    }
  }

  // ถ้าเป็น path ภายในโปรเจกต์ เช่น "public/<uid>/file.pdf" หรือมี prefix เป็นชื่อบัคเก็ต
  let s = p.replace(/^\/+/, "");
  if (s.startsWith(`${BUCKET}/`)) s = s.slice(BUCKET.length + 1);
  return s || null;
}

// ชื่อแสดงผลใน UI
function displayNameFromPath(path: string) {
  const base = (path.split("?")[0] || "").split("/").pop() || path;
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) {
    return NextResponse.json({ error: g.message, items: [] }, { status: g.status });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE));

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  const { data, error, count } = await g.supa
    .from("leaverequest")
    .select(
      `
      leave_request_id,
      date_start, date_end,
      date_start_type, date_end_type,
      total_day, reason, file,
      timestamp, status, comment,
      reviewed_by, reviewed_at,
      approved_by, approved_at,
      year,
      leavetype(leave_type_name)
    `,
      { count: "exact" }
    )
    .eq("user_id", g.user.id)
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json({ error: error.message, items: [] }, { status: 500 });
  }

  const storage = (g as any).supaAdmin?.storage ?? g.supa.storage;

  const items = await Promise.all(
    (data ?? []).map(async (r: any) => {
      const status_code = String(r.status || "pending").toLowerCase();

      const leaveTypeObj = Array.isArray(r.leavetype) ? r.leavetype[0] : r.leavetype;
      const leaveTypeName = leaveTypeObj?.leave_type_name ?? "ไม่ระบุ";

      // เตรียมไฟล์แนบ → คืน { name, path, url } (url = signed URL)
      const paths = toPathArray(r.file);
      const files = await Promise.all(
        paths.map(async (raw) => {
          const path = cleanPath(raw);
          const name = displayNameFromPath(path);

          // ถ้าเดิมเป็น signed URL (มี token=) ใช้ต่อได้เลย
          if (path.includes("token=")) {
            return { name, path, url: path };
          }

          const key = toObjectKey(path);
          if (!key) return { name, path, url: "" };

          const { data: signed, error: se } = await storage.from(BUCKET).createSignedUrl(key, SIGN_TTL_SECONDS);
          return { name, path, url: se ? "" : signed?.signedUrl ?? "" };
        })
      );

      return {
        id: String(r.leave_request_id),
        leaveType: leaveTypeName,
        leave_type_name: leaveTypeName,
        startDate: r.date_start,
        endDate: r.date_end,
        date_start_type: r.date_start_type ?? "เต็มวัน",
        date_end_type: r.date_end_type ?? "เต็มวัน",
        totalDays: Number(r.total_day ?? 0),
        reason: r.reason ?? "",
        files, // [{ name, path, url }]
        status: thStatus(r.status),
        status_code,
        comment: r.comment ?? "",
        submittedAt: r.timestamp,
        reviewedAt: r.reviewed_at ?? null,
        approvedAt: r.approved_at ?? null,
        reviewedBy: r.reviewed_by ?? null,
        approvedBy: r.approved_by ?? null,
        year: r.year ?? null,
      };
    })
  );

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages,
  });
}
