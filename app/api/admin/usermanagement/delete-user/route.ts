import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

    // 1️⃣ ลบตารางลูก
    const { error: roleError } = await supabaseAdmin
      .from("userrole")
      .delete()
      .eq("user_id", user_id);
    if (roleError) throw roleError;

    // 2️⃣ ลบ users table
    const { error: userError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("user_id", user_id);
    if (userError) throw userError;

    // 3️⃣ ลบ auth.users (ถ้าต้องการ hard delete)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authError) throw authError;

    return NextResponse.json({ message: "ผู้ใช้ถูกลบเรียบร้อยแล้ว" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
