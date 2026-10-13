import { route, json } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserMap } from "@/lib/services/authUsers";
import { fullName } from "@/lib/format";
import { ROLE } from "@/lib/roles";
import { HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** รายชื่อบุคลากรที่ใช้งานอยู่ (ให้ ผอ.เลือกตอนสร้างใบลาแทน) */
export const GET = route([ROLE.director], async () => {
  const [{ data, error }, authMap] = await Promise.all([
    supabaseAdmin.from("users").select("user_id, prename, name, surname").eq("is_active", true).order("name"),
    getAuthUserMap(),
  ]);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  const items = (data ?? []).map((u) => ({
    user_id: u.user_id as string,
    fullName: fullName(u),
    email: authMap.get(u.user_id as string)?.email ?? "",
  }));
  return json({ items });
});
