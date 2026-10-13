import { itemRoutes } from "@/lib/admin/crud";
import { subjectGroupCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = itemRoutes(subjectGroupCfg);
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
