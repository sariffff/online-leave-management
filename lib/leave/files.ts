// จัดการคอลัมน์ leaverequest.file (varchar เก็บ JSON array) และไฟล์ใน Storage — ใช้ร่วมกันทุก route
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, FILE_KINDS, checkAttachment, fileKindOf, type AttachmentSettings } from "@/lib/settings-schema";

const BUCKET = "leave-attachments";
const SIGN_TTL = 60 * 5;
// ขนาด/จำนวน/ชนิดไฟล์ ตั้งค่าได้ในหน้า "ตั้งค่าระบบ → ไฟล์แนบ" (ค่าเริ่มต้น 5MB, 5 ไฟล์, PDF/JPG/PNG)

export type LeaveFile = { name: string; path: string; url: string };

/** แปลงค่าจาก DB (JSON string / array / string เดี่ยว) เป็นรายการ key */
export function parseFileField(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw !== "string") return [];
  const s = raw.trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      /* ตกไปใช้ค่าเดี่ยว */
    }
  }
  return [s.replace(/^["']+|["']+$/g, "")].filter(Boolean);
}

export function serializeFileField(keys: string[]): string | null {
  return keys.length ? JSON.stringify(keys) : null;
}

/** key ที่ไม่มี "/" ถือเป็นชื่อไฟล์ใต้โฟลเดอร์ของเจ้าของใบลา */
export function toStorageKey(entry: string, ownerId: string): string {
  const s = entry.trim().replace(/^\/+/, "");
  if (!s) return "";
  return s.includes("/") ? s : `public/${ownerId}/${s}`;
}

export function fileDisplayName(key: string): string {
  const tail = key.split("?")[0].split("/").pop() || key;
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/** ออก signed URL หลายไฟล์ในการเรียกเดียว */
export async function signFiles(raw: unknown, ownerId: string): Promise<LeaveFile[]> {
  const keys = parseFileField(raw).map((k) => toStorageKey(k, ownerId)).filter(Boolean);
  if (keys.length === 0) return [];

  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(keys, SIGN_TTL);
  const urlByPath = new Map<string, string>();
  for (const r of data ?? []) if (r.path && r.signedUrl) urlByPath.set(r.path, r.signedUrl);

  return keys.map((key) => ({ name: fileDisplayName(key), path: key, url: urlByPath.get(key) ?? "" }));
}

/** ลงนามไฟล์ของหลายใบลาพร้อมกัน (ลดการเรียก Storage จาก N ครั้งเหลือ 1 ครั้ง) */
export async function signFilesBatch(
  rows: ReadonlyArray<{ id: number | string; user_id: string | null; file: unknown }>
): Promise<Map<string, LeaveFile[]>> {
  const perRow = new Map<string, string[]>();
  const all = new Set<string>();
  for (const r of rows) {
    const keys = parseFileField(r.file)
      .map((k) => toStorageKey(k, r.user_id ?? ""))
      .filter(Boolean);
    perRow.set(String(r.id), keys);
    keys.forEach((k) => all.add(k));
  }

  const urlByPath = new Map<string, string>();
  if (all.size > 0) {
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls([...all], SIGN_TTL);
    for (const r of data ?? []) if (r.path && r.signedUrl) urlByPath.set(r.path, r.signedUrl);
  }

  const out = new Map<string, LeaveFile[]>();
  for (const [id, keys] of perRow) {
    out.set(
      id,
      keys.map((key) => ({ name: fileDisplayName(key), path: key, url: urlByPath.get(key) ?? "" }))
    );
  }
  return out;
}

export function validateUploads(files: File[], a: AttachmentSettings = DEFAULT_SETTINGS.attachments): void {
  if (files.length > a.maxFiles) throw new HttpError(422, "TOO_MANY_FILES", { message: `แนบไฟล์ได้ไม่เกิน ${a.maxFiles} ไฟล์` });
  for (const f of files) {
    const bad = checkAttachment(a, f);
    if (bad) throw new HttpError(422, bad.code, { message: bad.message });
  }
}

function extOf(file: File): string {
  const n = file.name || "";
  const dot = n.lastIndexOf(".");
  const raw = dot >= 0 ? n.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  if (raw) return `.${raw}`;
  const kind = fileKindOf(file);
  return kind ? FILE_KINDS[kind].ext[0] : ".bin";
}

/** ตรวจไฟล์ตามการตั้งค่าปัจจุบัน — เรียกก่อนบันทึกใบลา */
export async function assertUploads(files: File[]): Promise<void> {
  if (files.length) validateUploads(files, (await getSettings()).attachments);
}

/** อัปโหลดหลายไฟล์ลงโฟลเดอร์ของเจ้าของใบลา คืนรายการ key (ถ้าล้มเหลวจะลบไฟล์ที่ขึ้นไปแล้ว) */
export async function uploadFiles(ownerId: string, files: File[]): Promise<string[]> {
  validateUploads(files, (await getSettings()).attachments);
  const stamp = Date.now();
  const keys: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = `public/${ownerId}/${stamp}-${i}${extOf(f)}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, f, {
      upsert: false,
      contentType: f.type || (fileKindOf(f) ? FILE_KINDS[fileKindOf(f)!].mime : "application/octet-stream"),
    });
    if (error) {
      if (keys.length) await supabaseAdmin.storage.from(BUCKET).remove(keys);
      throw new HttpError(500, "UPLOAD_FAILED", error.message);
    }
    keys.push(key);
  }
  return keys;
}

export async function removeFiles(keys: string[]): Promise<void> {
  if (keys.length) await supabaseAdmin.storage.from(BUCKET).remove(keys);
}
