// app/api/auth/set-role/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // ใช้ res ตัวนี้เป็นภาชนะให้ Supabase เขียน Set-Cookie
  const base = NextResponse.json({});
  const supabase = createSupabaseServerRoute(req, base); // ✅ ต้องส่ง req,res

  // ✅ โครงสร้างที่ถูกต้อง
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ parse body ปลอดภัย
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const roleId = Number(body?.roleId);
  if (!roleId) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  // ✅ ตรวจว่า user มี role นี้จริง
  const { data: roles, error: rolesError } = await supabase
    .from("userrole")
    .select("role_type_id")
    .eq("user_id", user.id);

  if (rolesError) {
    return NextResponse.json({ error: "Role check failed" }, { status: 500 });
  }
  const hasRole = roles?.some((r) => Number(r.role_type_id) === roleId);
  if (!hasRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ สร้าง response จริงโดย “พก” headers จาก base (ที่ Supabase อาจเขียนคุกกี้ไว้)
  const res = NextResponse.json({ success: true }, { headers: base.headers });

  // ✅ ตั้ง active_role ลง response นี้ (ฝั่ง client ไม่ต้องอ่านได้ เพราะใช้ guard/middleware อ่านฝั่ง server)
  res.cookies.set("active_role", String(roleId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // แนะนำ Lax เพื่อให้ส่งคุกกี้บนการนำทางในไซต์เดียวกัน
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return res;
}
