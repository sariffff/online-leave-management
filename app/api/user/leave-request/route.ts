// app/api/user/leave-request/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
import { getFiscalYearFromISO, assertSameFiscalYearOrThrow } from "@/utils/year";

export const runtime = "nodejs";

const BUCKET = "leave-attachments";


async function ensureQuotaAndGetAvailable(args: {
  supabase: ReturnType<typeof createSupabaseServerRoute>;
  user_id: string;
  leave_type_id: number;
  year: number; // fiscal year
}) {
  const { supabase, user_id, leave_type_id, year } = args;

  // หา quota แถวเดิม (ดึง reserved มาด้วย)
  const { data: q, error: qErr } = await supabase
    .from("userleavequota")
    .select("user_leave_quota_id, total_used, total_remaining, reserved")
    .eq("user_id", user_id)
    .eq("leave_type_id", leave_type_id)
    .eq("year", year)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);

  if (q) {
    const total_used = Number(q.total_used ?? 0);
    const total_remaining = Number(q.total_remaining ?? 0);
    const reserved = Number(q.reserved ?? 0);
    const available = total_remaining - reserved;
    return {
      quotaId: q.user_leave_quota_id as number,
      available,
      total_used,
      total_remaining,
      reserved,
    };
  }

  // ไม่มี quota -> init จาก leavetype.max_leave_day
  const { data: lt, error: ltErr } = await supabase
    .from("leavetype")
    .select("max_leave_day")
    .eq("leave_type_id", leave_type_id)
    .single();

  if (ltErr || !lt) throw new Error("LEAVETYPE_NOT_FOUND");

  const defaultQuota = Number(lt.max_leave_day ?? 0);

  const { data: inserted, error: insErr } = await supabase
    .from("userleavequota")
    .insert({
      user_id,
      leave_type_id,
      year,
      total_used: 0,
      total_remaining: defaultQuota,
      reserved: 0, // สำคัญ: เริ่ม 0
    })
    .select("user_leave_quota_id, total_used, total_remaining, reserved")
    .single();

  if (insErr || !inserted) {
    throw new Error(insErr?.message || "INIT_QUOTA_FAILED");
  }

  const total_used = Number(inserted.total_used ?? 0);
  const total_remaining = Number(inserted.total_remaining ?? 0);
  const reserved = Number(inserted.reserved ?? 0);
  const available = total_remaining - reserved;

  return {
    quotaId: inserted.user_leave_quota_id as number,
    available,
    total_used,
    total_remaining,
    reserved,
  };
}

export async function POST(req: NextRequest) {
  const base = NextResponse.json({});
  const supabase = createSupabaseServerRoute(req, base);

  // auth
  const { data: u, error: uErr } = await supabase.auth.getUser();
  const user = u?.user;
  if (uErr || !user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "CONTENT_TYPE" }, { status: 400 });
  }

  try {
    const form = await req.formData();

    // รับค่าฟอร์ม
    const leave_type_id   = Number(form.get("leave_type_id"));
    const date_start      = String(form.get("date_start") || "");
    const date_end        = String(form.get("date_end") || "");
    const date_start_type = form.get("date_start_type")?.toString();
    const date_end_type   = form.get("date_end_type")?.toString();
    const total_day       = Number(form.get("total_day"));
    const reason          = String(form.get("reason") || "").trim();
    const file            = form.get("file"); // แนบไฟล์เดียว

    if (!leave_type_id || !date_start || !date_end || !total_day || !reason) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 422 });
    }

    // ปีงบ: ห้ามข้าม + คิดปีงบจากวันเริ่มลา
    assertSameFiscalYearOrThrow(date_start, date_end);
    const year = getFiscalYearFromISO(date_start);

    // quota: ใช้ available = total_remaining - reserved
    let quotaSnapshot: { quotaId: number; available: number; reserved: number } | null = null;
    try {
      const { available, reserved, quotaId } = await ensureQuotaAndGetAvailable({
        supabase,
        user_id: user.id,
        leave_type_id,
        year,
      });

      if (total_day > available) {
        return NextResponse.json(
          { error: "INSUFFICIENT_QUOTA", available },
          { status: 400 }
        );
      }

      // เก็บ snapshot reserved ปัจจุบัน เพื่อนำไป + หลังสร้างใบลาเสร็จ
      quotaSnapshot = { quotaId, available, reserved };
    } catch (qe: any) {
      return NextResponse.json(
        { error: "QUOTA_ERROR", detail: qe?.message || String(qe) },
        { status: 400 }
      );
    }

    // insert ใบลา (pending) พร้อม year (ปีงบ)
    const ins = await supabase
      .from("leaverequest")
      .insert({
        user_id: user.id,
        leave_type_id,
        date_start,
        date_end,
        date_start_type,
        date_end_type,
        total_day,
        reason,
        status: "pending",
        year, // ปักปีงบลงตรง ๆ ตาม schema คุณ
      })
      .select("leave_request_id")
      .single();

    if (ins.error || !ins.data) {
      return NextResponse.json(
        { error: "DB_INSERT_FAILED", detail: ins.error?.message },
        { status: 500 }
      );
    }

    const leaveId = ins.data.leave_request_id as number;

    // อัปโหลดไฟล์ (ถ้ามี)
    let uploadedKey: string | null = null;
    if (file instanceof File && file.size > 0) {
      const ext = (() => {
        const n = file.name || "";
        const dot = n.lastIndexOf(".");
        const raw = dot >= 0 ? n.slice(dot + 1) : "";
        return raw ? `.${raw.toLowerCase()}` : ".bin";
      })();

      const safeName = `${Date.now()}-0${ext}`;
      const key = `public/${user.id}/${safeName}`;

      const up = await supabase.storage
        .from(BUCKET)
        .upload(key, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (up.error) {
        // rollback แถวใบลา
        await supabase
          .from("leaverequest")
          .delete()
          .eq("leave_request_id", leaveId)
          .eq("user_id", user.id);

        return NextResponse.json(
          { error: "UPLOAD_FAILED", detail: up.error.message, key },
          { status: 500 }
        );
      }

      // บันทึกคีย์ไฟล์ลงใบลา
      const upd = await supabase
        .from("leaverequest")
        .update({ file: [key] }) // ถ้าเป็น text[]; ถ้าเป็น text เดี่ยวเก็บ string
        .eq("leave_request_id", leaveId)
        .eq("user_id", user.id);

      if (upd.error) {
        // ลบไฟล์กัน orphan + rollback แถวใบลา
        await supabase.storage.from(BUCKET).remove([key]);
        await supabase
          .from("leaverequest")
          .delete()
          .eq("leave_request_id", leaveId)
          .eq("user_id", user.id);

        return NextResponse.json(
          { error: "DB_UPDATE_FAILED", detail: upd.error.message },
          { status: 500 }
        );
      }

      uploadedKey = key;
    }

    // -----------------------------
    // (ใหม่) กันสิทธิ์ reserved หลังสร้างใบลาเสร็จ
    // -----------------------------
    // ใช้ snapshot reserved เดิม + total_day  -> อัปเดตเป็นค่าที่กันไว้ใหม่
    // หมายเหตุ: นี่ไม่ใช่ทรานแซกชันจริง (Supabase PostgREST),
    // ถ้าต้องการ atomic แนะนำทำ RPC ฝั่ง DB
    if (quotaSnapshot) {
      const newReserved = quotaSnapshot.reserved + total_day;
      const { error: reserveErr } = await supabase
        .from("userleavequota")
        .update({ reserved: newReserved })
        .eq("user_leave_quota_id", quotaSnapshot.quotaId);

      if (reserveErr) {
        // ถ้ากันสิทธิ์ไม่สำเร็จ -> rollback: ลบใบลา + ลบไฟล์ (ถ้ามี)
        if (uploadedKey) {
          await supabase.storage.from(BUCKET).remove([uploadedKey]);
        }
        await supabase
          .from("leaverequest")
          .delete()
          .eq("leave_request_id", leaveId)
          .eq("user_id", user.id);

        return NextResponse.json(
          { error: "RESERVE_UPDATE_FAILED", detail: reserveErr.message },
          { status: 500 }
        );
      }
    }

    // success
    return NextResponse.json({ ok: true, id: leaveId, year }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", detail: String(e?.message || e) },
      { status: (e as any)?.status || 500 }
    );
  }
}
