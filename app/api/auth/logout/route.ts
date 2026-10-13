import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const res = NextResponse.json({ ok: true });

  // ผูก Supabase client กับ response เพื่อให้เคลียร์คุกกี้ session ให้ครบ
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (all) => {
        for (const { name, value, options } of all) res.cookies.set(name, value, options);
      },
    },
  });

  await supabase.auth.signOut({ scope: "global" });
  res.cookies.set("active_role", "", { path: "/", maxAge: 0 });
  return res;
}
