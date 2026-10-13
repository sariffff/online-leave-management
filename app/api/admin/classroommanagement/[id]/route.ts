import { itemRoutes } from "@/lib/admin/crud";
import { classroomCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = itemRoutes(classroomCfg);
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
