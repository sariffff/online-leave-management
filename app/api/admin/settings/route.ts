import { route, json } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** การตั้งค่าทั้งหมด + ค่าเริ่มต้น (ใช้ปุ่ม "คืนค่าเริ่มต้น") */
export const GET = route([ROLE.admin], async () => json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS }));
