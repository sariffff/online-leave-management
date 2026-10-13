import { route, json } from "@/lib/http";
import { listUsers } from "@/lib/admin/users";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

export const GET = route([ROLE.admin], async () => json({ users: await listUsers() }));
