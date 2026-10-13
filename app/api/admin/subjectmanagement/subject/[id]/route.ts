import { itemRoutes } from "@/lib/admin/crud";
import { subjectCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = itemRoutes(subjectCfg);
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
