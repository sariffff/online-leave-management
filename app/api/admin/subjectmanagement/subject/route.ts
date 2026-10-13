import { listCreateRoutes } from "@/lib/admin/crud";
import { subjectCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = listCreateRoutes(subjectCfg);
export const GET = h.GET;
export const POST = h.POST;
