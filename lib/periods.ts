// ชื่อวันที่มีการสอน — คาบเรียน (จำนวน/เวลา) ตั้งค่าได้ในหน้า "ตั้งค่าระบบ → คาบเรียน" (lib/settings-schema.ts)
export type { Period } from "@/lib/settings-schema";

export const DAY_NAMES = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"] as const;
