import { route, json } from "@/lib/http";
import { listLeaveTypesFull } from "@/lib/leave/types";

export const runtime = "nodejs";

/**
 * ประเภทการลาพร้อมกฎ/คำอธิบาย/สี เรียงตามที่ผู้ดูแลตั้งไว้ (ใช้ในฟอร์มยื่นลาและตัวกรองทุกหน้า)
 *  ?all=1 รวมประเภทที่ปิดใช้งาน (ตัวกรองประวัติยังต้องเลือกประเภทเก่าได้)
 */
export const GET = route("any", async ({ url }) => {
  const items = await listLeaveTypesFull({ includeInactive: url.searchParams.get("all") === "1" });
  return json({ items }, { headers: { "Cache-Control": "no-store" } });
});
