import { itemRoutes } from "@/lib/admin/crud";
import { levelCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = itemRoutes(levelCfg);
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
