import { route, json, readJson } from "@/lib/http";
import { setActive } from "@/lib/admin/users";
import { cleanStr } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const PUT = route([ROLE.admin], async ({ g, req }) => {
  const body = await readJson<{ user_id?: unknown }>(req);
  await setActive(cleanStr(body.user_id, 64), false, g.user.id);
  return json({ ok: true });
});
