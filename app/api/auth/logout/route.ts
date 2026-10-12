import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const store = await cookies();                 // Next 15 ใช้แบบ async
  const res = NextResponse.json({ ok: true });

  // สร้าง Supabase server client ผูกกับ response เพื่อให้มันเคลียร์คุกกี้ session ให้
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (all) => {
          for (const { name, value, options } of all) {
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // 1) ออกจากระบบ Supabase (จะเคลียร์คุกกี้ auth ของ Supabase ให้)
  await supabase.auth.signOut({ scope: "global" });

  // 2) ลบคุกกี้ active_role
  //   - ลบบน path="/" โดยไม่ระบุโดเมน
  res.cookies.set("active_role", "", { path: "/", maxAge: 0 });

  //   - กันพลาดกรณีตั้งด้วยโดเมนย่อย (ลบซ้ำด้วย .host)
  const host = req.headers.get("host")?.split(":")[0];
  if (host) {
    res.cookies.set("active_role", "", { path: "/", maxAge: 0, domain: `.${host}` });
  }

  return res;
}
