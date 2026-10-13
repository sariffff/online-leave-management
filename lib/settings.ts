// การตั้งค่าระบบ (ฝั่งเซิร์ฟเวอร์) — เก็บเป็นไฟล์ JSON ใน bucket ส่วนตัว "app-config" ของ Supabase Storage
// เหตุผล: ใช้ได้ทันทีโดยไม่ต้องรันคำสั่งสร้างตารางเพิ่ม · อ่านผ่าน service role เท่านั้น (ผู้ใช้ทั่วไปเข้าถึงไฟล์ตรง ๆ ไม่ได้)
//
// ความถูกต้องเมื่อบันทึกถี่ ๆ:
//  - Storage มี CDN แคชไว้ อ่านทันทีหลังเขียนอาจได้ไฟล์ฉบับก่อนหน้า (นานสุด ~60 วินาที)
//    → ทุกไฟล์มีเลขรุ่น (_rev) และเซิร์ฟเวอร์จำฉบับล่าสุดที่ตัวเองเขียน — อ่านได้ฉบับที่เก่ากว่าจะไม่นำมาใช้
//  - การแก้ไขทั้งหมดผ่านคิวเดียว (ทีละรายการ) จึงไม่เขียนทับกันเมื่อมีคำขอพร้อมกัน
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { afterAttachments } from "@/lib/settings-effects";
import {
  DEFAULT_SETTINGS,
  SettingsError,
  mergeSettings,
  toPublic,
  validateAttachments,
  validateGeneral,
  validatePeriods,
  type AppSettings,
  type LeaveTypeRule,
  type PublicSettings,
  type SettingsSection,
} from "@/lib/settings-schema";

const BUCKET = "app-config";
const FILE = "settings.json";
const HISTORY_FILE = "settings-history.json";
const HISTORY_MAX = 300;
const TTL_MS = 30_000;

type Versioned<T> = { rev: number; value: T };

let cache: { at: number; value: AppSettings } | null = null;
/** ฉบับล่าสุดที่เซิร์ฟเวอร์นี้รู้ (เขียนเอง หรืออ่านได้ฉบับใหม่กว่า) */
let latest: Versioned<AppSettings> | null = null;
let latestHistory: Versioned<HistoryEntry[]> | null = null;
let bucketReady: Promise<void> | null = null;

/** คิวทีละรายการ — ป้องกันอ่าน-แก้-เขียนซ้อนกัน */
function queue() {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
}
const settingsQueue = queue();
const historyQueue = queue();

/** สร้าง bucket ส่วนตัวครั้งแรกที่ใช้ (ถ้ายังไม่มี) */
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  return bucketReady;
}

async function readRaw(name: string): Promise<unknown> {
  await ensureBucket();
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(name);
  if (error || !data) return null; // ยังไม่มีไฟล์ = ใช้ค่าเริ่มต้น
  try {
    return JSON.parse(await data.text());
  } catch {
    console.error(`[settings] ${name} อ่านไม่ได้ ใช้ค่าเริ่มต้นแทน`);
    return null;
  }
}

async function writeRaw(name: string, value: unknown): Promise<void> {
  await ensureBucket();
  const body = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(name, body, { upsert: true, contentType: "application/json", cacheControl: "0" });
  if (error) throw new HttpError(500, "SETTINGS_SAVE_FAILED", error.message);
}

const revOf = (raw: unknown): number => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const n = Number((raw as { _rev?: unknown })._rev);
  return Number.isFinite(n) ? n : 0;
};
const nextRev = (prev?: number) => Math.max(Date.now(), (prev ?? 0) + 1);

/* ---------------- อ่าน ---------------- */
/** การตั้งค่าทั้งหมด (ค่าที่ไม่ได้ตั้งใช้ค่าเริ่มต้น) — ถ้าอ่าน storage ไม่ได้ ระบบยังทำงานด้วยค่าล่าสุด/ค่าเริ่มต้น */
export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const raw = await readRaw(FILE);
    const rev = revOf(raw);
    if (!latest || rev >= latest.rev) latest = { rev, value: mergeSettings(raw) };
    cache = { at: Date.now(), value: latest.value };
    return latest.value;
  } catch (e) {
    console.error("[settings] โหลดไม่สำเร็จ ใช้ค่าล่าสุด/ค่าเริ่มต้น", e instanceof Error ? e.message : e);
    return latest?.value ?? DEFAULT_SETTINGS;
  }
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return toPublic(await getSettings());
}

/* ---------------- ประวัติ ---------------- */
export type HistoryEntry = {
  id: string;
  at: string;
  by: { id: string; name: string };
  section: SettingsSection;
  /** ประเภทการลา: leave_type_id หรือ "order" (เรียงลำดับ) */
  key?: string;
  label: string;
  before: unknown;
  after: unknown;
  /** รายการนี้เกิดจากการย้อนกลับรายการไหน — รายการแบบนี้ย้อนกลับซ้ำไม่ได้ (กันกดวนไปมา) */
  revertOf?: string;
};

/** ย้อนกลับรายการนี้ได้หรือไม่: รายการที่เป็นการย้อนกลับ หรือถูกย้อนกลับไปแล้ว → ไม่ได้ */
export function revertBlockReason(entry: HistoryEntry, all: HistoryEntry[]): string | null {
  // label "ย้อนกลับ: …" = รายการย้อนกลับที่บันทึกก่อนมีฟิลด์ revertOf
  if (entry.revertOf || entry.label.startsWith("ย้อนกลับ:")) return "รายการนี้เป็นการย้อนกลับ จึงย้อนกลับซ้ำไม่ได้";
  if (all.some((h) => h.revertOf === entry.id)) return "รายการนี้ถูกย้อนกลับไปแล้ว";
  return null;
}

/** ตรวจก่อนย้อนกลับ (ใช้ทั้งหมวดทั่วไปและประเภทการลา) */
export async function assertRevertable(entry: HistoryEntry): Promise<void> {
  const reason = revertBlockReason(entry, await getHistory());
  if (reason) throw new HttpError(409, "CANNOT_REVERT", reason);
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await readRaw(HISTORY_FILE);
  const rev = revOf(raw);
  const items = Array.isArray(raw) ? (raw as HistoryEntry[]) : ((raw as { items?: HistoryEntry[] } | null)?.items ?? []);
  if (!latestHistory || rev >= latestHistory.rev) latestHistory = { rev, value: items };
  return latestHistory.value;
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
  return (await getHistory()).find((h) => h.id === id);
}

export function appendHistory(entry: Omit<HistoryEntry, "id" | "at">): Promise<void> {
  return historyQueue(async () => {
    const list = [{ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() }, ...(await getHistory())].slice(0, HISTORY_MAX);
    const rev = nextRev(latestHistory?.rev);
    await writeRaw(HISTORY_FILE, { _rev: rev, items: list });
    latestHistory = { rev, value: list };
  });
}

/* ---------------- บันทึก ---------------- */
export type Actor = { id: string; name: string };

/** อ่าน-แก้-เขียนการตั้งค่าในคิวเดียว; fn คืน null = ไม่มีอะไรเปลี่ยน (ไม่เขียน) */
function mutateSettings(fn: (current: AppSettings) => AppSettings | null): Promise<{ before: AppSettings; after: AppSettings; changed: boolean }> {
  return settingsQueue(async () => {
    cache = null; // อ่านใหม่ (ฉบับที่เก่ากว่าที่เคยเขียนจะถูกข้าม)
    const before = await getSettings();
    const after = fn(before);
    if (!after) return { before, after: before, changed: false };
    const rev = nextRev(latest?.rev);
    await writeRaw(FILE, { ...after, _rev: rev });
    latest = { rev, value: after };
    cache = { at: Date.now(), value: after };
    return { before, after, changed: true };
  });
}

const SECTION_LABEL: Record<SettingsSection, string> = {
  general: "ทั่วไป",
  leaveTypes: "ประเภทการลา",
  periods: "คาบเรียน",
  attachments: "ไฟล์แนบ",
};

/** บันทึกหมวดทั่วไป / คาบเรียน / ไฟล์แนบ */
export async function saveSection(
  section: Exclude<SettingsSection, "leaveTypes">,
  input: unknown,
  actor: Actor,
  label?: string,
  revertOf?: string
): Promise<AppSettings> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const r = await mutateSettings((current) => {
    let value: AppSettings[typeof section];
    try {
      value =
        section === "general"
          ? validateGeneral(raw, current.general)
          : section === "periods"
            ? validatePeriods(raw, current.periods)
            : validateAttachments(raw, current.attachments);
    } catch (e) {
      if (e instanceof SettingsError) throw new HttpError(422, "VALIDATION", e.message);
      throw e;
    }
    if (JSON.stringify(value) === JSON.stringify(current[section])) return null;
    return { ...current, [section]: value } as AppSettings;
  });
  if (r.changed) {
    await appendHistory({ by: actor, section, label: label ?? `แก้ไขหมวด${SECTION_LABEL[section]}`, before: r.before[section], after: r.after[section], revertOf });
  }
  return r.after;
}

/** บันทึกกฎของหลายประเภทพร้อมกัน (ไม่เขียนประวัติ — ผู้เรียกเขียนเอง) */
export async function writeLeaveRules(rules: Record<string, LeaveTypeRule>): Promise<void> {
  await mutateSettings((current) => ({ ...current, leaveTypes: { ...current.leaveTypes, ...rules } }));
}

/** ลบกฎของประเภทที่ถูกลบ */
export async function removeLeaveRule(id: number): Promise<void> {
  await mutateSettings((current) => {
    const leaveTypes = { ...current.leaveTypes };
    delete leaveTypes[String(id)];
    return { ...current, leaveTypes };
  });
}

/** ย้อนกลับค่าก่อนหน้าของรายการประวัติ (หมวดทั่วไป/คาบเรียน/ไฟล์แนบ — ประเภทการลาใช้ lib/leave/types.ts) */
export async function revertHistory(entryId: string, actor: Actor): Promise<void> {
  const entry = await getHistoryEntry(entryId);
  if (!entry) throw new HttpError(404, "HISTORY_NOT_FOUND");
  if (entry.section === "leaveTypes") throw new HttpError(400, "CANNOT_REVERT");
  await assertRevertable(entry);
  const next = await saveSection(entry.section, entry.before, actor, `ย้อนกลับ: ${entry.label}`, entry.id);
  // ขีดจำกัดของที่เก็บไฟล์ใบลาต้องตรงกับค่าที่ย้อนกลับมา
  if (entry.section === "attachments") await afterAttachments(next.attachments);
}
