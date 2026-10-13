// จัดการคอลัมน์ leaverequest.file (varchar เก็บ JSON array) และไฟล์ใน Storage — ใช้ร่วมกันทุก route
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";

export const BUCKET = "leave-attachments";
export const SIGN_TTL = 60 * 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

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

export function validateUploads(files: File[]): void {
  if (files.length > MAX_FILES) throw new HttpError(422, "TOO_MANY_FILES");
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) throw new HttpError(422, "FILE_TOO_LARGE", f.name);
    if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) throw new HttpError(422, "FILE_TYPE_NOT_ALLOWED", f.name);
  }
}

function extOf(file: File): string {
  const n = file.name || "";
  const dot = n.lastIndexOf(".");
  const raw = dot >= 0 ? n.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  if (raw) return `.${raw}`;
  return file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
}

/** อัปโหลดหลายไฟล์ลงโฟลเดอร์ของเจ้าของใบลา คืนรายการ key (ถ้าล้มเหลวจะลบไฟล์ที่ขึ้นไปแล้ว) */
export async function uploadFiles(ownerId: string, files: File[]): Promise<string[]> {
  validateUploads(files);
  const stamp = Date.now();
  const keys: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = `public/${ownerId}/${stamp}-${i}${extOf(f)}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, f, {
      upsert: false,
      contentType: f.type || "application/octet-stream",
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
