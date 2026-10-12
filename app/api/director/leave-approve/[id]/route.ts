// app/api/director/leave-request/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const base = NextResponse.json({});
    const supabase = createSupabaseServerRoute(req, base);

    // auth ผอ. (หรือผู้มีสิทธิ์)
    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    // ต้องเป็น reviewed เท่านั้น เพื่อเลี่ยงผลกระทบ quota
    const { data: row, error: selErr } = await supabase
      .from("leaverequest")
      .select("leave_request_id, status")
      .eq("leave_request_id", id)
      .single();

    if (selErr || !row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (row.status !== "reviewed") {
      return NextResponse.json({ error: "NOT_DELETABLE_STATUS" }, { status: 409 });
    }

    // ลบทิ้ง
    const { error: delErr } = await supabase
      .from("leaverequest")
      .delete()
      .eq("leave_request_id", id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
