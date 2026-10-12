// app/api/admin/create-user/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, tel, prename, name, surname, role, subject_group_id } = body;

    // ตรวจสอบ input
    if (!email || !password || !name || !surname || !Array.isArray(role)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. สร้างผู้ใช้ใน auth
    const { data: user, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        phone: tel,
        email_confirm: true,
      });

    if (!user || userError) {
      return NextResponse.json(
        { error: userError?.message || "Failed to create user" },
        { status: 400 }
      );
    }

    // 2. แทรกข้อมูลผู้ใช้ในตาราง users
    const { error: insertError } = await supabaseAdmin.from("users")
    .insert([
      {
        user_id: user.user.id,
        prename,
        name,
        surname,
      },
    ]);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to insert user data" },
        { status: 400 }
      );
    }

    // 3. แทรก roles (user_roles)
    const rolesToInsert = role.map((roleId: number) => ({
      user_id: user.user.id,
      role_type_id: roleId,
    }));

    console.log("Mapped rolesToInsert:", rolesToInsert);

    const { error: insertRolesError } = await supabaseAdmin
      .from("userrole")
      .insert(rolesToInsert);

    if (insertRolesError) {
      return NextResponse.json(
        {
          error: "Failed to assign roles",
          detail: insertRolesError.message,
        },
        { status: 500 }
      );
    }
      const { error: teacherErr } = await supabaseAdmin
    .from("teacher")
    .insert({
      user_id: user.user.id,            
      subject_group_id,   
    });

    if (teacherErr) throw teacherErr;
    return NextResponse.json({
      success: true,
      message: "User created successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
