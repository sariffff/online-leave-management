// app/api/admin/usermanagement/get-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // ดึง users จาก table
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("user_id, prename, name, surname, is_active")
      .order("name");

    if (usersError) throw usersError;

    // ดึง roles
    const { data: userRolesData, error: rolesError } = await supabaseAdmin
      .from("userrole")
      .select(
        `user_role_id, user_id, role_type_id, roletype:role_type_id(role_name)`
      );

    if (rolesError) throw rolesError;

    // ดึง auth.users จาก Supabase Authentication
    const { data: authUsers, error: authError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (authError) throw authError;

    const authMap = new Map(
      (authUsers?.users || []).map((u) => [u.id, u]) // map user_id -> auth object
    );

    const formattedUsers = (usersData || []).map((user) => {
      const roles = (userRolesData || [])
        .filter((ur: any) => ur.user_id === user.user_id)
        .map((ur: any) => ({
          role_type_id: ur.role_type_id,
          role_name: ur.roletype?.role_name || "ไม่ระบุ",
        }));

      const authUser = authMap.get(user.user_id);

      return {
        ...user,
        roles, // <-- ส่ง Role[] ไม่ใช่ string[]
        email: authUser?.email || null,
        tel: authUser?.phone || null,
        auth_created_at: authUser?.created_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    });

    return NextResponse.json({ users: formattedUsers });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้" },
      { status: 500 }
    );
  }
}
