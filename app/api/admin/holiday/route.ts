import { listCreateRoutes } from "@/lib/admin/crud";
import { holidayCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = listCreateRoutes(holidayCfg);
export const GET = h.GET;
export const POST = h.POST;
