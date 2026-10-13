import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** ค่าที่ทุกคนอ่านได้ (ชื่อระบบ/โรงเรียน/โลโก้/สี, คาบเรียน, ข้อจำกัดไฟล์แนบ) — ใช้ได้แม้ยังไม่ล็อกอิน */
export async function GET() {
  return NextResponse.json(await getPublicSettings(), { headers: { "Cache-Control": "no-store" } });
}
