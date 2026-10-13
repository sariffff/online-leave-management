import { route, json, readJson, HttpError } from "@/lib/http";
import { getSettings, saveSection } from "@/lib/settings";
import { resetLeaveTypeRules } from "@/lib/leave/types";
import { afterAttachments } from "@/lib/settings-effects";
import { actorOf } from "@/lib/settings-actor";
import { DEFAULT_SETTINGS, type SettingsSection } from "@/lib/settings-schema";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

const SECTIONS: SettingsSection[] = ["general", "leaveTypes", "periods", "attachments"];
const LABEL: Record<SettingsSection, string> = { general: "หมวดทั่วไป", leaveTypes: "กฎประเภทการลา", periods: "คาบเรียน", attachments: "ไฟล์แนบ" };

/**
 * คืนค่าเริ่มต้น (factory reset) ตามหมวดที่เลือก: body { sections: ["general", "leaveTypes", "periods", "attachments"] }
 *  - แต่ละหมวดบันทึกเป็นประวัติ 1 รายการ → ย้อนกลับได้จากหน้าประวัติ
 *  - ประเภทการลา: คืนเฉพาะกฎ/คำอธิบาย/สี/ลำดับ/การเปิดใช้งาน — ไม่ลบประเภทที่เพิ่มเองและไม่แตะวันลาต่อปีในฐานข้อมูล
 *  - คาบเรียน: ไม่แก้เวลาในตารางสอนเดิม
 */
export const POST = route([ROLE.admin], async ({ g, req }) => {
  const body = await readJson<{ sections?: unknown }>(req);
  const sections = Array.isArray(body.sections) ? [...new Set(body.sections)] : [];
  if (sections.length === 0 || !sections.every((s) => (SECTIONS as unknown[]).includes(s))) {
    throw new HttpError(422, "VALIDATION", "กรุณาเลือกหมวดที่ต้องการคืนค่าเริ่มต้น");
  }
  const actor = actorOf(g);
  const changed: SettingsSection[] = [];
  // ทำตามลำดับคงที่ ไม่ขึ้นกับลำดับที่ส่งมา
  for (const s of SECTIONS.filter((x) => sections.includes(x))) {
    if (s === "leaveTypes") {
      if (await resetLeaveTypeRules(actor)) changed.push(s);
      continue;
    }
    const before = JSON.stringify((await getSettings())[s]);
    const next = await saveSection(s, DEFAULT_SETTINGS[s], actor, `คืนค่าเริ่มต้น: ${LABEL[s]}`);
    if (JSON.stringify(next[s]) !== before) changed.push(s);
    if (s === "attachments") await afterAttachments(next.attachments);
  }
  return json({ ok: true, sections: changed });
});
