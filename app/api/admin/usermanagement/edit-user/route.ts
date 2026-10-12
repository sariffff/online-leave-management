import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, prename, name, surname, tel, is_active, roles } = body;

    if (!user_id || !name || !surname || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // 1️⃣ อัปเดต users table
    const { error: uErr } = await supabaseAdmin
      .from("users")
      .update({ prename, name, surname,is_active })
      .eq("user_id", user_id);
    if (uErr) throw uErr;

    // 2️⃣ ดึงบทบาทเดิม
    const { data: oldRoles, error: rErr } = await supabaseAdmin
      .from("userrole")
      .select("role_type_id")
      .eq("user_id", user_id);
    if (rErr) throw rErr;

    const oldRoleIds = (oldRoles ?? []).map((r) => r.role_type_id);

    const toAdd = roles.filter((r: number) => !oldRoleIds.includes(r));
    const toRemove = oldRoleIds.filter((r) => !roles.includes(r));

    // 3️⃣ เพิ่มบทบาทใหม่
    if (toAdd.length > 0) {
      const rows = toAdd.map((role_type_id: number) => ({ user_id, role_type_id }));
      const { error: addErr } = await supabaseAdmin.from("userrole").insert(rows);
      if (addErr) throw addErr;
    }

    // 4️⃣ ลบบทบาทที่ไม่ใช้
    if (toRemove.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("userrole")
        .delete()
        .eq("user_id", user_id)
        .in("role_type_id", toRemove);
      if (delErr) throw delErr;
    }

    return NextResponse.json({ message: "บันทึกสำเร็จ" });
  } catch (error: any) {
    console.error("Edit user error:", error);
    return NextResponse.json(
      { error: error?.message || "เกิดข้อผิดพลาดในการแก้ไขผู้ใช้" },
      { status: 500 }
    );
  }
}
