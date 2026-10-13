import { itemRoutes } from "@/lib/admin/crud";
import { holidayCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = itemRoutes(holidayCfg);
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
