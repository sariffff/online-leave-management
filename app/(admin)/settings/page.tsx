import SettingsClient from "./SettingsClient";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";

export const metadata = { title: "ตั้งค่าระบบ" };

// ค่าปัจจุบันส่งมากับ HTML — เปิดหน้าแล้วแก้ได้ทันทีไม่ต้องรอโหลด
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [settings, { tab }] = await Promise.all([getSettings(), searchParams]);
  return <SettingsClient initial={settings} defaults={DEFAULT_SETTINGS} initialTab={tab} />;
}
