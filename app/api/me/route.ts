import { route, json, HttpError, readJson } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserMap, invalidateAuthUsers } from "@/lib/services/authUsers";
import { fromDbPhone, toE164 } from "@/utils/phone";
import { cleanStr } from "@/lib/validate";

export const runtime = "nodejs";

/** โปรไฟล์ของฉัน + บทบาททั้งหมด */
export const GET = route("any", async ({ g }) => {
  const [{ data, error }, authMap] = await Promise.all([
    supabaseAdmin.from("users").select("prename, name, surname").eq("user_id", g.user.id).maybeSingle(),
    getAuthUserMap(),
  ]);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  return json({
    user_id: g.user.id,
    email: g.user.email,
    prename: data?.prename ?? "",
    name: data?.name ?? "",
    surname: data?.surname ?? "",
    tel: fromDbPhone(authMap.get(g.user.id)?.phone ?? ""),
    roles: g.roles,
    activeRoleId: g.activeRole?.id ?? null,
  });
});

/** แก้ข้อมูลส่วนตัวของตัวเอง (ชื่อ/คำนำหน้า/เบอร์โทร) */
export const PATCH = route("any", async ({ g, req }) => {
  const b = await readJson<Record<string, unknown>>(req);
  const name = cleanStr(b.name, 100);
  const surname = cleanStr(b.surname, 100);
  if (!name || !surname) throw new HttpError(422, "VALIDATION", "กรุณากรอกชื่อและนามสกุล");

  const { error } = await supabaseAdmin
    .from("users")
    .update({ prename: cleanStr(b.prename, 30) || null, name, surname })
    .eq("user_id", g.user.id);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  if (typeof b.tel === "string") {
    const phone = toE164(b.tel);
    const a = await supabaseAdmin.auth.admin.updateUserById(g.user.id, { phone: phone || undefined });
    if (a.error) throw new HttpError(400, "AUTH_UPDATE_FAILED", a.error.message);
    invalidateAuthUsers();
  }
  return json({ ok: true });
});
