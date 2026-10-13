import { route, json, readJson } from "@/lib/http";
import { deleteUser } from "@/lib/admin/users";
import { cleanStr } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const DELETE = route([ROLE.admin], async ({ g, req }) => {
  const body = await readJson<{ user_id?: unknown }>(req);
  await deleteUser(g.user.id, cleanStr(body.user_id, 64));
  return json({ ok: true });
});
