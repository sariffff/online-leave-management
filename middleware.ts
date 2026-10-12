// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function middleware(req: NextRequest) {
  // สร้าง res ไว้ก่อน เพื่อให้ supabase สามารถ set-cookie ลง response นี้ได้
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res); // ✅ ต้องส่ง req,res

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const activeRole = req.cookies.get("active_role")?.value;

  // 1) ยังไม่ล็อกอิน → ไป /login (ยกเว้นตัวมันเอง)
  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 2) ล็อกอินแล้วแต่ยังไม่เลือก role → ไป /select-role (ยกเว้นตัวมันเอง)
  if (user && !activeRole && pathname !== "/select-role") {
    return NextResponse.redirect(new URL("/select-role", req.url));
  }

  // 3) (ทางเลือก/เพื่อ UX เท่านั้น) กันเข้า /admin ด้วย cookie เบื้องต้น
  //    อย่าพึ่ง cookie สำหรับ authorize จริง — ให้ layout.tsx ใช้ requireRole แทน
  if (pathname.startsWith("/admin") && activeRole !== "1") {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // คืน res เดิมที่ supabase ผูกไว้แล้ว (เผื่อมีการเขียนคุกกี้)
  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/supervisor/:path*",
    "/director/:path*",
    "/academic/:path*",
    "/user/:path*",
  ],
};
