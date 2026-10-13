import { route, json, readJson, HttpError } from "@/lib/http";
import { saveSection } from "@/lib/settings";
import { actorOf } from "@/lib/settings-actor";
import { ROLE } from "@/lib/roles";
import { afterAttachments, afterPeriods } from "@/lib/settings-effects";

export const runtime = "nodejs";

const SECTIONS = ["general", "periods", "attachments"] as const;
type Section = (typeof SECTIONS)[number];

/** บันทึกการตั้งค่าทีละหมวด (ประเภทการลาใช้ /api/admin/leave-types) */
export const PUT = route<{ section: string }>([ROLE.admin], async ({ g, req, params }) => {
  if (!(SECTIONS as readonly string[]).includes(params.section)) throw new HttpError(404, "UNKNOWN_SECTION");
  const body = await readJson<Record<string, unknown>>(req);
  const next = await saveSection(params.section as Section, body, actorOf(g));
  const extra =
    params.section === "periods"
      ? await afterPeriods(next.periods, body.syncSchedule === true)
      : params.section === "attachments"
        ? await afterAttachments(next.attachments)
        : {};
  return json({ ok: true, value: next[params.section as Section], ...extra });
});
