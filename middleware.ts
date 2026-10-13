// middleware.ts
// หน้าที่: (1) ต่ออายุ session ของ Supabase ทุก request (2) redirect ผู้ที่ยังไม่ login / ยังไม่เลือกบทบาท
// การอนุญาตจริงตามบทบาทไม่ทำที่นี่ — layout (requireRole) และ API route (route([...])) ตรวจจาก DB ทุกครั้ง
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

const PUBLIC_PAGES = new Set(["/login"]);
const NO_ROLE_NEEDED = ["/select-role", "/login", "/403"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  // getSession(): ตรวจวันหมดอายุจาก cookie และต่ออายุเมื่อจำเป็น โดยไม่ต้องยิงไป Auth server ทุกครั้ง
  // (ใช้เพื่อเช็ค "มี session ไหม" เท่านั้น ไม่ใช้ตัดสินสิทธิ์)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (PUBLIC_PAGES.has(pathname) || pathname === "/api/auth/logout" || pathname === "/api/settings/public") return res;
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/select-role", req.url));
  }

  const activeRole = req.cookies.get("active_role")?.value;
  if (!isApi && !activeRole && !NO_ROLE_NEEDED.includes(pathname)) {
    return NextResponse.redirect(new URL("/select-role", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff2?)$).*)"],
};
