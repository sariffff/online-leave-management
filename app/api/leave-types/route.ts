import { route, json } from "@/lib/http";
import { listLeaveTypes } from "@/lib/leave/quota";

export const runtime = "nodejs";

/** ประเภทการลาทั้งหมด (ใช้ในฟอร์ม/ตัวกรองทุกหน้า) */
export const GET = route("any", async () => {
  const items = await listLeaveTypes();
  return json({ items }, { headers: { "Cache-Control": "private, max-age=60" } });
});
