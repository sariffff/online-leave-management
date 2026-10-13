"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SETTINGS, toPublic, type PublicSettings } from "@/lib/settings-schema";

const Ctx = createContext<PublicSettings>(toPublic(DEFAULT_SETTINGS));

/**
 * ค่าตั้งค่าที่หน้าเว็บใช้ (ชื่อระบบ, สี, โลโก้, คาบเรียน, ไฟล์แนบ) — root layout อ่านจากเซิร์ฟเวอร์แล้วส่งลงมา
 * หลังผู้ดูแลบันทึก หน้าตั้งค่าเรียก router.refresh() ค่าใหม่จะไหลลงมาทั้งเว็บทันที
 */
export function SettingsProvider({ value, children }: { value: PublicSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePublicSettings = () => useContext(Ctx);
