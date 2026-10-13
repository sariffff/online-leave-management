import { route, json, readJson } from "@/lib/http";
import { updateUser } from "@/lib/admin/users";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const PUT = route([ROLE.admin], async ({ g, req }) => {
  await updateUser(g.user.id, await readJson(req));
  return json({ ok: true });
});
