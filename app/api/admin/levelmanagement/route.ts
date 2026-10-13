import { listCreateRoutes } from "@/lib/admin/crud";
import { levelCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = listCreateRoutes(levelCfg);
export const GET = h.GET;
export const POST = h.POST;
