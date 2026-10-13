import { route, json, HttpError, readJson } from "@/lib/http";
import { toPosInt } from "@/lib/validate";
import { ROLE_HOME, type RoleName } from "@/lib/roles";

export const runtime = "nodejs";

/** เลือกบทบาทที่ใช้งาน (cookie ใช้กับ UI เท่านั้น — การอนุญาตจริงตรวจจาก DB ทุกครั้ง) */
export const POST = route("any", async ({ g, req }) => {
  const body = await readJson<{ roleId?: unknown }>(req);
  const roleId = toPosInt(body.roleId);
  if (!roleId) throw new HttpError(400, "ROLE_REQUIRED");

  const role = g.roles.find((r) => r.id === roleId);
  if (!role) throw new HttpError(403, "Forbidden");

  const res = json({ success: true, home: ROLE_HOME[role.name as RoleName] ?? "/" });
  res.cookies.set("active_role", String(roleId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
});
