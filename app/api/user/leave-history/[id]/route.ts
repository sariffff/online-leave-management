// app/api/user/leave-history/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

const BUCKET = "leave-attachments";
const SIGN_TTL = 60 * 5; // 5 นาที

// ✅ สถานะที่ "แก้ไข/ลบ" ได้
const EDITABLE_STATUSES = new Set(["pending", "failed"]);

function thStatus(s?: string | null) {
  if (!s || s === "pending") return "รอพิจารณา";
  if (s === "approved") return "อนุมัติ";
  if (s === "rejected") return "ไม่อนุมัติ";
  if (s === "cancelled") return "ยกเลิก";
  if (s === "failed") return "ไม่อนุมัติ";
  return s;
}

function toArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {}
    return [s];
  }
  return [];
}

function toKey(entry: string, userId: string) {
  const s = (entry || "").trim();
  if (!s) return "";
  if (s.includes("/")) return s;
  return `public/${userId}/${s}`;
}

function displayNameFromKey(keyOrName: string) {
  const tail = (keyOrName || "").split("/").pop() || keyOrName;
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const { id } = await ctx.params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = await g.supa
    .from("leaverequest")
    .select(`
      leave_request_id, user_id,
      date_start, date_end,
      date_start_type, date_end_type,
      total_day, reason, file,
      timestamp, status, comment,
      reviewed_by, approved_by, approved_at,
      leavetype(leave_type_name)
    `)
    .eq("leave_request_id", leaveId)
    .eq("user_id", g.user.id)
    .single();

  if (row.error || !row.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const fileEntries = toArray((row.data as any).file);
  const files: { name: string; path: string; url: string }[] = [];
  for (const entry of fileEntries) {
    const key = toKey(entry, g.user.id);
    if (!key) continue;
    const signed = await g.supa.storage.from(BUCKET).createSignedUrl(key, SIGN_TTL);
    files.push({
      name: displayNameFromKey(key),
      path: key,
      url: signed.error ? "" : (signed.data?.signedUrl || ""),
    });
  }

  const lt = Array.isArray((row.data as any).leavetype)
    ? (row.data as any).leavetype[0]
    : (row.data as any).leavetype;

  // ✅ ส่งทั้ง label ไทย และ status_code (ดิบ) กลับไปให้ UI
  return NextResponse.json({
    id: String((row.data as any).leave_request_id),
    leaveType: lt?.leave_type_name ?? "ไม่ระบุ",
    startDate: (row.data as any).date_start,
    endDate: (row.data as any).date_end,
    date_start_type: (row.data as any).date_start_type ?? "เต็มวัน",
    date_end_type: (row.data as any).date_end_type ?? "เต็มวัน",
    totalDays: Number((row.data as any).total_day ?? 0),
    status: thStatus((row.data as any).status),
    status_code: (row.data as any).status ?? "pending",
    submittedAt: (row.data as any).timestamp,
    reason: (row.data as any).reason ?? null,
    comment: (row.data as any).comment ?? null,
    reviewedBy: (row.data as any).reviewed_by ?? null,
    approvedBy: (row.data as any).approved_by ?? null,
    approvedAt: (row.data as any).approved_at ?? null,
    files,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const { id } = await ctx.params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // ✅ ต้องเป็นของตัวเอง และสถานะต้องอยู่ในชุด EDITABLE_STATUSES
  const current = await g.supa
    .from("leaverequest")
    .select("status, file, user_id")
    .eq("leave_request_id", leaveId)
    .eq("user_id", g.user.id)
    .single();

  if (current.error || !current.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (current.data.status && !EDITABLE_STATUSES.has(String(current.data.status))) {
    return NextResponse.json({ error: "แก้ไขไม่ได้ในสถานะนี้" }, { status: 400 });
  }

  const ct = req.headers.get("content-type") || "";
  const updatePayload: Record<string, unknown> = {};

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();

      // ฟิลด์ข้อความ
      const reason = form.get("reason")?.toString()?.trim();
      const date_start = form.get("date_start")?.toString();
      const date_end = form.get("date_end")?.toString();
      const date_start_type = form.get("date_start_type")?.toString();
      const date_end_type = form.get("date_end_type")?.toString();
      const total_day_raw = form.get("total_day")?.toString();

      if (reason !== undefined) updatePayload.reason = reason;
      if (date_start) updatePayload.date_start = date_start;
      if (date_end) updatePayload.date_end = date_end;
      if (date_start_type) updatePayload.date_start_type = date_start_type;
      if (date_end_type) updatePayload.date_end_type = date_end_type;
      if (total_day_raw && !Number.isNaN(Number(total_day_raw))) updatePayload.total_day = Number(total_day_raw);

      // ไฟล์ใหม่ (ถ้ามี)
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        // ลบไฟล์เก่าทิ้ง (best-effort)
        const oldEntries = toArray(current.data.file);
        const keysToRemove = Array.from(new Set(oldEntries.map((v) => toKey(v, g.user.id)).filter(Boolean)));
        if (keysToRemove.length > 0) {
          const rm = await g.supa.storage.from(BUCKET).remove(keysToRemove);
          if (rm.error) console.warn("[leave-history] remove old failed:", rm.error.message, keysToRemove);
        }

        // อัปโหลดไฟล์ใหม่ (ไม่ upsert)
        const ext = (() => {
          const n = file.name || "";
          const dot = n.lastIndexOf(".");
          const raw = dot >= 0 ? n.slice(dot + 1) : "";
          return raw ? `.${raw.toLowerCase()}` : ".bin";
        })();
        const safeName = `${Date.now()}-0${ext}`;
        const newKey = `public/${g.user.id}/${safeName}`;

        const up = await g.supa.storage
          .from(BUCKET)
          .upload(newKey, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });
        if (up.error) {
          return NextResponse.json(
            { error: "upload_failed", detail: up.error.message, key: newKey },
            { status: 500 }
          );
        }

        updatePayload.file = [newKey];
      }
    } else {
      // JSON
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      if ("file" in body) delete (body as any).file; // ไม่รับเปลี่ยนไฟล์ผ่าน JSON
      Object.assign(updatePayload, body);
    }

    //failed ให้กลับเป็น pending และล้างค่า
    if (String(current.data.status) === "failed") {
      updatePayload.status = "pending";
      updatePayload.comment = null;
      updatePayload.reviewed_by = null;
      updatePayload.approved_by = null;
      updatePayload.approved_at = null;
    }

    // อัปเดตแถว
    const upd = await g.supa
      .from("leaverequest")
      .update(updatePayload)
      .eq("leave_request_id", leaveId)
      .eq("user_id", g.user.id);

    if (upd.error) {
      return NextResponse.json({ error: "db_update_failed", detail: upd.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected_error", detail: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const { id } = await ctx.params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const current = await g.supa
    .from("leaverequest")
    .select("status, file, user_id")
    .eq("leave_request_id", leaveId)
    .eq("user_id", g.user.id)
    .single();

  if (current.error || !current.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (current.data.status && !EDITABLE_STATUSES.has(String(current.data.status))) {
    return NextResponse.json({ error: "ลบไม่ได้ในสถานะนี้" }, { status: 400 });
  }

  // ลบไฟล์ใน Storage (best-effort)
  const oldEntries = toArray(current.data.file);
  const keysToRemove = Array.from(new Set(oldEntries.map((v) => toKey(v, g.user.id)).filter(Boolean)));
  if (keysToRemove.length > 0) {
    const rm = await g.supa.storage.from(BUCKET).remove(keysToRemove);
    if (rm.error) {
      console.warn("[leave-history] delete remove files failed:", rm.error.message, keysToRemove);
    }
  }

  // ลบแถวใน DB
  const del = await g.supa
    .from("leaverequest")
    .delete()
    .eq("leave_request_id", leaveId)
    .eq("user_id", g.user.id);

  if (del.error) {
    return NextResponse.json({ error: "db_delete_failed", detail: del.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
