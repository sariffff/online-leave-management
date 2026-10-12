import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PUT(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_active: false })
      .eq("user_id", user_id);

    if (error) throw error;

    return NextResponse.json({ message: "ผู้ใช้ถูกปิดใช้งานเรียบร้อยแล้ว" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
