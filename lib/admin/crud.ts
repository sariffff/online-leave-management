// โรงงานสร้าง route CRUD ของตารางข้อมูลหลัก (level, subjectgroup, classroom, subject, holiday)
// เดิมแต่ละตารางเขียน GET/POST/PATCH/DELETE ซ้ำกันเอง และไม่ตรวจสิทธิ์
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError, route, json, readJson } from "@/lib/http";
import { ROLE } from "@/lib/roles";
import { toPosInt } from "@/lib/validate";

type Sanitizer = (value: unknown) => unknown;
type AnyRow = Record<string, unknown>;

export type CrudConfig = {
  table: string;
  idColumn: string;
  /** ข้อความ select (ใส่ embed ได้) */
  select: string;
  orderBy: string;
  /** ฟิลด์ที่เขียนได้ → ฟังก์ชันตรวจ/แปลงค่า (throw HttpError ถ้าไม่ถูกต้อง) */
  fields: Record<string, Sanitizer>;
  /** ฟิลด์ที่ต้องมีตอนสร้าง */
  required: string[];
  /** แปลงแถวจาก DB ก่อนส่งออก */
  map?: (row: AnyRow) => AnyRow;
  label: string;
  /**
   * ตารางที่อ้างถึงแถวนี้ — ตรวจก่อนลบ เพราะฐานข้อมูลจริงบางความสัมพันธ์ตั้งเป็น ON DELETE CASCADE
   * (ลบระดับชั้นแล้วห้องเรียน/วิชา/คาบสอนหายตาม) จึงไม่พึ่ง FK อย่างเดียว
   */
  refs?: { table: string; column: string; label: string }[];
  /** ฟิลด์ที่ห้ามซ้ำ (เทียบแบบไม่สนตัวพิมพ์ เฉพาะตอนสร้าง/แก้) */
  unique?: string;
};

export const reqString =
  (label: string, max = 200): Sanitizer =>
  (v) => {
    const s = typeof v === "string" ? v.trim().slice(0, max) : "";
    if (!s) throw new HttpError(422, "VALIDATION", `กรุณากรอก${label}`);
    return s;
  };

export const optInt: Sanitizer = (v) => {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const n = toPosInt(v);
  if (n === null) throw new HttpError(422, "VALIDATION", "ค่าตัวเลขไม่ถูกต้อง");
  return n;
};

function pgError(e: { code?: string; message: string }, label: string): HttpError {
  if (e.code === "23503") return new HttpError(409, "IN_USE", `ลบ${label}นี้ไม่ได้ เพราะยังถูกใช้งานอยู่`);
  if (e.code === "23505") return new HttpError(409, "DUPLICATE", `${label}นี้มีอยู่แล้ว`);
  return new HttpError(500, "DB_ERROR", e.message);
}

function pick(cfg: CrudConfig, body: AnyRow, partial: boolean): AnyRow {
  const out: AnyRow = {};
  for (const [key, sanitize] of Object.entries(cfg.fields)) {
    if (!(key in body)) {
      if (!partial && cfg.required.includes(key)) sanitize(undefined); // ให้ sanitizer โยน error ที่อ่านเข้าใจ
      continue;
    }
    out[key] = sanitize(body[key]);
  }
  if (Object.keys(out).length === 0) throw new HttpError(400, "NO_FIELDS");
  return out;
}

const out = (cfg: CrudConfig, row: AnyRow) => (cfg.map ? cfg.map(row) : row);

async function assertUnique(cfg: CrudConfig, values: AnyRow, selfId?: number) {
  if (!cfg.unique || typeof values[cfg.unique] !== "string") return;
  // ilike แบบตรงตัว: escape ตัวแทนของ LIKE
  const v = (values[cfg.unique] as string).replace(/[%_\\]/g, (c) => `\\${c}`);
  let q = supabaseAdmin.from(cfg.table).select(cfg.idColumn).ilike(cfg.unique, v).limit(1);
  if (selfId) q = q.neq(cfg.idColumn, selfId);
  const { data, error } = await q;
  if (error) throw pgError(error, cfg.label);
  if (data && data.length > 0) throw new HttpError(409, "DUPLICATE", `${cfg.label}นี้มีอยู่แล้ว`);
}

async function assertNotReferenced(cfg: CrudConfig, id: number) {
  if (!cfg.refs?.length) return;
  const counts = await Promise.all(
    cfg.refs.map((r) => supabaseAdmin.from(r.table).select(r.column, { count: "exact", head: true }).eq(r.column, id))
  );
  const used = cfg.refs
    .map((r, i) => ({ label: r.label, n: counts[i].count ?? 0, error: counts[i].error }))
    .filter((x) => x.error || x.n > 0);
  const err = used.find((x) => x.error)?.error;
  if (err) throw pgError(err, cfg.label);
  if (used.length) {
    throw new HttpError(409, "IN_USE", `ลบ${cfg.label}นี้ไม่ได้ เพราะยังถูกใช้งานอยู่ (${used.map((x) => `${x.label} ${x.n} รายการ`).join(", ")})`);
  }
}

/** GET (รายการ) + POST (สร้าง) — เฉพาะ admin เขียน, ผู้ที่ login แล้วอ่านได้ */
export function listCreateRoutes(cfg: CrudConfig) {
  const GET = route("any", async () => {
    const { data, error } = await supabaseAdmin.from(cfg.table).select(cfg.select).order(cfg.orderBy, { ascending: true });
    if (error) throw pgError(error, cfg.label);
    return json({ items: ((data ?? []) as unknown as AnyRow[]).map((r) => out(cfg, r)) });
  });

  const POST = route([ROLE.admin], async ({ req }) => {
    const body = await readJson<AnyRow>(req);
    const values = pick(cfg, body, false);
    await assertUnique(cfg, values);
    const { data, error } = await supabaseAdmin.from(cfg.table).insert(values).select(cfg.select).single();
    if (error) throw pgError(error, cfg.label);
    return json({ item: out(cfg, data as unknown as AnyRow) }, { status: 201 });
  });

  return { GET, POST };
}

/** PATCH + DELETE รายตัว (admin เท่านั้น) */
export function itemRoutes(cfg: CrudConfig) {
  const idOf = (params: { id: string }) => {
    const id = toPosInt(params.id);
    if (!id) throw new HttpError(400, "INVALID_ID");
    return id;
  };

  const PATCH = route<{ id: string }>([ROLE.admin], async ({ req, params }) => {
    const id = idOf(params);
    const values = pick(cfg, await readJson<AnyRow>(req), true);
    if (cfg.unique && cfg.unique in values) {
      const exists = await supabaseAdmin.from(cfg.table).select(cfg.idColumn).eq(cfg.idColumn, id).maybeSingle();
      if (exists.error) throw pgError(exists.error, cfg.label);
      if (!exists.data) throw new HttpError(404, "NOT_FOUND");
      await assertUnique(cfg, values, id);
    }
    const { data, error } = await supabaseAdmin
      .from(cfg.table)
      .update(values)
      .eq(cfg.idColumn, id)
      .select(cfg.select)
      .maybeSingle();
    if (error) throw pgError(error, cfg.label);
    if (!data) throw new HttpError(404, "NOT_FOUND");
    return json({ item: out(cfg, data as unknown as AnyRow) });
  });

  const DELETE = route<{ id: string }>([ROLE.admin], async ({ params }) => {
    const id = idOf(params);
    await assertNotReferenced(cfg, id);
    const { error, count } = await supabaseAdmin.from(cfg.table).delete({ count: "exact" }).eq(cfg.idColumn, id);
    if (error) throw pgError(error, cfg.label);
    if (!count) throw new HttpError(404, "NOT_FOUND");
    return json({ ok: true });
  });

  return { PATCH, DELETE };
}
