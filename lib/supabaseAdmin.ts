import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client (ข้าม RLS) — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น และต้องผ่าน guard ตรวจบทบาทก่อนทุกครั้ง
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export { supabaseAdmin };
