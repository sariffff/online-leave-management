import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** ใช้ใน Server Components / guard / page.tsx (server) */
export async function createSupabaseServerRSC() {
  const jar = await cookies(); // Next 15: ต้อง await
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => jar.getAll().map(c => ({ name: c.name, value: c.value })),
      setAll: () => { /* RSC เขียนคุกกี้ไม่ได้ */ },
    },
  });
}

/** ใช้ใน API route / middleware (อ่าน-เขียนคุกกี้ได้) */
export function createSupabaseServerRoute(req: NextRequest, res: NextResponse) {
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
      setAll: (all) => all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
}
