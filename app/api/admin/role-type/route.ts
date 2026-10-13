import { route, json, HttpError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const GET = route([ROLE.admin], async () => {
  const { data, error } = await supabaseAdmin.from("roletype").select("role_type_id, role_name").order("role_type_id");
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  return json({ roles: data ?? [] }, { headers: { "Cache-Control": "private, max-age=300" } });
});
