import { route, json, readJson } from "@/lib/http";
import { createUser } from "@/lib/admin/users";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const POST = route([ROLE.admin], async ({ req }) => {
  const result = await createUser(await readJson(req));
  return json({ success: true, ...result }, { status: 201 });
});
