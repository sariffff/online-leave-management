import { route, json, HttpError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSettings, saveSection } from "@/lib/settings";
import { actorOf } from "@/lib/settings-actor";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

// โลโก้อยู่ใน bucket สาธารณะ "branding" (แสดงได้ทั้งหน้าเข้าสู่ระบบและใบลา PDF)
// ไม่รับ SVG เพราะอาจมีสคริปต์ฝังอยู่
const BUCKET = "branding";
const MAX_BYTES = 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(TYPES),
  });
  if (error && !/already exists/i.test(error.message)) throw new HttpError(500, "BUCKET_CREATE_FAILED", error.message);
}

const keyOf = (url: string | null) => (url ? decodeURIComponent(url.split(`/${BUCKET}/`)[1] ?? "").split("?")[0] : "");

/** อัปโหลดโลโก้ใหม่ (multipart: file) */
export const POST = route([ROLE.admin], async ({ g, req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(422, "VALIDATION", "กรุณาเลือกไฟล์โลโก้");
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(422, "VALIDATION", "รองรับเฉพาะไฟล์ PNG, JPG, WEBP");
  if (file.size > MAX_BYTES) throw new HttpError(422, "VALIDATION", "ไฟล์โลโก้ต้องไม่เกิน 1MB");

  await ensureBucket();
  const key = `logo-${Date.now()}.${ext}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(key, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (up.error) throw new HttpError(500, "UPLOAD_FAILED", up.error.message);

  const prev = (await getSettings()).general.logoUrl;
  const logoUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  try {
    await saveSection("general", { logoUrl }, actorOf(g), "เปลี่ยนโลโก้");
  } catch (e) {
    await supabaseAdmin.storage.from(BUCKET).remove([key]);
    throw e;
  }
  // ไฟล์เก่ายังเก็บไว้ เพื่อให้ "ย้อนกลับ" ในประวัติใช้ได้
  return json({ ok: true, logoUrl, previous: prev }, { status: 201 });
});

/** เอาโลโก้ออก (ไฟล์ยังเก็บไว้ให้ย้อนกลับได้) */
export const DELETE = route([ROLE.admin], async ({ g }) => {
  const prev = (await getSettings()).general.logoUrl;
  if (!prev) return json({ ok: true });
  await saveSection("general", { logoUrl: null }, actorOf(g), "เอาโลโก้ออก");
  return json({ ok: true, removed: keyOf(prev) });
});
