import { listCreateRoutes } from "@/lib/admin/crud";
import { classroomCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = listCreateRoutes(classroomCfg);
export const GET = h.GET;
export const POST = h.POST;
