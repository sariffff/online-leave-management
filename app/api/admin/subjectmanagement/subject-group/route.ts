import { listCreateRoutes } from "@/lib/admin/crud";
import { subjectGroupCfg } from "@/lib/admin/resources";

export const runtime = "nodejs";

const h = listCreateRoutes(subjectGroupCfg);
export const GET = h.GET;
export const POST = h.POST;
