// ประเภทการลา = ข้อมูลหลักในตาราง leavetype (ชื่อ, วันต่อปี, วันสะสม, หมายเหตุ) + กฎ/หน้าตาจากการตั้งค่าระบบ
// ผู้ดูแลเพิ่ม/แก้/ปิดใช้งาน/ลบ/เรียงลำดับได้ — ทุกครั้งบันทึกประวัติและย้อนกลับได้
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError, conflict } from "@/lib/http";
import { invalidateLeaveTypes, listLeaveTypes } from "@/lib/leave/quota";
import { appendHistory, assertRevertable, getSettings, removeLeaveRule, writeLeaveRules, type Actor, type HistoryEntry } from "@/lib/settings";
import { SettingsError, defaultLeaveRule, validateLeaveRule, type LeaveTypeRule } from "@/lib/settings-schema";
import type { LeaveTypeRow } from "@/types/db";

export type LeaveTypeFull = LeaveTypeRow & { rule: LeaveTypeRule };
/** รูปแบบที่เก็บในประวัติ (แบน ๆ เพื่อแสดงค่าเดิม→ค่าใหม่ได้ทีละฟิลด์) */
type Snapshot = Pick<LeaveTypeRow, "leave_type_name" | "max_leave_day" | "carry_over_max" | "note"> & LeaveTypeRule;

const snap = (t: LeaveTypeFull): Snapshot => ({
  leave_type_name: t.leave_type_name,
  max_leave_day: t.max_leave_day,
  carry_over_max: t.carry_over_max,
  note: t.note,
  ...t.rule,
});

/** ประเภทการลาทั้งหมดพร้อมกฎ เรียงตามลำดับที่ตั้งไว้ */
export async function listLeaveTypesFull(opts: { includeInactive?: boolean } = {}): Promise<LeaveTypeFull[]> {
  const [rows, settings] = await Promise.all([listLeaveTypes(), getSettings()]);
  return rows
    .map((r) => ({ ...r, rule: settings.leaveTypes[String(r.leave_type_id)] ?? defaultLeaveRule(r.leave_type_id) }))
    .filter((t) => opts.includeInactive || t.rule.isActive)
    .sort((a, b) => a.rule.sortOrder - b.rule.sortOrder || a.leave_type_id - b.leave_type_id);
}

export async function getLeaveTypeFull(id: number): Promise<LeaveTypeFull> {
  const t = (await listLeaveTypesFull({ includeInactive: true })).find((x) => x.leave_type_id === id);
  if (!t) throw new HttpError(404, "LEAVETYPE_NOT_FOUND");
  return t;
}

/** จำนวนใบลาที่อ้างถึงแต่ละประเภท (ลบได้เฉพาะประเภทที่ยังไม่มีใบลา) */
export async function usageCounts(): Promise<Map<number, number>> {
  const { data, error } = await supabaseAdmin.from("leaverequest").select("leave_type_id");
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  const m = new Map<number, number>();
  for (const r of data ?? []) m.set(r.leave_type_id as number, (m.get(r.leave_type_id as number) ?? 0) + 1);
  return m;
}

/* ---------------- ตรวจข้อมูลหลัก ---------------- */

function cleanCore(v: Record<string, unknown>, prev?: LeaveTypeRow): Omit<LeaveTypeRow, "leave_type_id"> {
  const name = typeof v.leave_type_name === "string" ? v.leave_type_name.trim() : prev?.leave_type_name ?? "";
  if (!name) throw new HttpError(422, "VALIDATION", "กรุณากรอกชื่อประเภทการลา");
  if (name.length > 100) throw new HttpError(422, "VALIDATION", "ชื่อประเภทการลายาวเกิน 100 ตัวอักษร");
  const num = (key: "max_leave_day" | "carry_over_max", label: string) => {
    if (!(key in v)) return prev ? prev[key] : null;
    const x = v[key];
    if (x === null || x === undefined || x === "") return null;
    const n = Number(x);
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw new HttpError(422, "VALIDATION", `${label}ต้องเป็นจำนวนเต็ม 0–3650`);
    return n;
  };
  const note = "note" in v ? (typeof v.note === "string" && v.note.trim() ? v.note.trim().slice(0, 300) : null) : prev?.note ?? null;
  return { leave_type_name: name, max_leave_day: num("max_leave_day", "จำนวนวันลาต่อปี"), carry_over_max: num("carry_over_max", "จำนวนวันสะสม"), note };
}

const RULE_KEYS: (keyof LeaveTypeRule)[] = [
  "description",
  "color",
  "isActive",
  "sortOrder",
  "maxDaysPerRequest",
  "docRequiredAfterDays",
  "minNoticeDays",
  "maxBackdateDays",
  "allowHalfDay",
  "countMode",
];
function cleanRule(v: Record<string, unknown>, prev: LeaveTypeRule): LeaveTypeRule {
  const input: Partial<LeaveTypeRule> = {};
  for (const k of RULE_KEYS) if (k in v) (input as Record<string, unknown>)[k] = v[k];
  try {
    return validateLeaveRule(input, prev);
  } catch (e) {
    if (e instanceof SettingsError) throw new HttpError(422, "VALIDATION", e.message);
    throw e;
  }
}

/**
 * เพิ่มแถว leavetype — ถ้า sequence ของรหัสตามไม่ทันข้อมูลเดิม (ประเภท 1–11 ถูกใส่รหัสเอง) จะชน primary key
 * จึงลองใหม่โดยกำหนดรหัส = รหัสสูงสุด + 1 (แก้ถาวรด้วย supabase/migrations/…006_leavetype_sequence.sql)
 */
async function insertLeaveTypeRow(core: Omit<LeaveTypeRow, "leave_type_id">, existingIds: number[]): Promise<number> {
  const first = await supabaseAdmin.from("leavetype").insert(core).select("leave_type_id").single();
  if (!first.error && first.data) return first.data.leave_type_id as number;
  if (first.error?.code !== "23505") throw new HttpError(500, "DB_INSERT_FAILED", first.error?.message);

  let next = Math.max(0, ...existingIds) + 1;
  for (let attempt = 0; attempt < 5; attempt++, next++) {
    const r = await supabaseAdmin.from("leavetype").insert({ leave_type_id: next, ...core }).select("leave_type_id").single();
    if (!r.error && r.data) return r.data.leave_type_id as number;
    if (r.error?.code !== "23505") throw new HttpError(500, "DB_INSERT_FAILED", r.error?.message);
  }
  throw new HttpError(500, "DB_INSERT_FAILED", "หารหัสประเภทการลาที่ว่างไม่ได้");
}

async function assertUniqueName(name: string, selfId?: number) {
  const dup = (await listLeaveTypes()).find((t) => t.leave_type_name.trim() === name && t.leave_type_id !== selfId);
  if (dup) throw conflict("DUPLICATE", "มีประเภทการลาชื่อนี้อยู่แล้ว");
}

/* ---------------- เพิ่ม / แก้ / ลบ / เรียงลำดับ ---------------- */
export async function createLeaveType(body: Record<string, unknown>, actor: Actor): Promise<LeaveTypeFull> {
  const core = cleanCore(body);
  await assertUniqueName(core.leave_type_name);
  const all = await listLeaveTypesFull({ includeInactive: true });
  const nextOrder = Math.max(0, ...all.map((t) => t.rule.sortOrder)) + 1;
  // ตรวจกฎก่อนเขียนฐานข้อมูล (ค่าผิดต้องไม่ทิ้งแถวค้าง)
  const rule = cleanRule(body, { ...defaultLeaveRule(0), sortOrder: nextOrder, color: "gray", description: "" });

  const id = await insertLeaveTypeRow(core, all.map((t) => t.leave_type_id));
  invalidateLeaveTypes();
  await writeLeaveRules({ [String(id)]: rule });
  const created = { leave_type_id: id, ...core, rule };
  await appendHistory({ by: actor, section: "leaveTypes", key: String(id), label: `เพิ่มประเภทการลา "${core.leave_type_name}"`, before: null, after: snap(created) });
  return created;
}

/** ป้ายกำกับ/รายการต้นทางเมื่อเรียกจากการย้อนกลับ */
type Via = { label?: string; revertOf?: string };

export async function updateLeaveType(id: number, body: Record<string, unknown>, actor: Actor, via: Via = {}): Promise<LeaveTypeFull> {
  const cur = await getLeaveTypeFull(id);
  const core = cleanCore(body, cur);
  if (core.leave_type_name !== cur.leave_type_name) await assertUniqueName(core.leave_type_name, id);
  const rule = cleanRule(body, cur.rule);
  const next: LeaveTypeFull = { leave_type_id: id, ...core, rule };
  if (JSON.stringify(snap(next)) === JSON.stringify(snap(cur))) return cur;

  const coreChanged = (["leave_type_name", "max_leave_day", "carry_over_max", "note"] as const).some((k) => core[k] !== cur[k]);
  if (coreChanged) {
    const { error } = await supabaseAdmin.from("leavetype").update(core).eq("leave_type_id", id);
    if (error) throw new HttpError(500, "DB_UPDATE_FAILED", error.message);
    invalidateLeaveTypes();
  }
  await writeLeaveRules({ [String(id)]: rule });
  const what = !rule.isActive && cur.rule.isActive ? "ปิดใช้งาน" : rule.isActive && !cur.rule.isActive ? "เปิดใช้งาน" : "แก้ไข";
  await appendHistory({ by: actor, section: "leaveTypes", key: String(id), label: via.label ?? `${what}ประเภทการลา "${core.leave_type_name}"`, before: snap(cur), after: snap(next), revertOf: via.revertOf });
  return next;
}

export async function deleteLeaveType(id: number, actor: Actor, via: Via = {}): Promise<void> {
  const cur = await getLeaveTypeFull(id);
  const used = (await usageCounts()).get(id) ?? 0;
  if (used > 0) throw conflict("IN_USE", `ประเภทนี้มีใบลาอยู่ ${used} ใบ ลบไม่ได้ — ใช้ "ปิดใช้งาน" แทน`);
  const quotas = await supabaseAdmin.from("userleavequota").delete().eq("leave_type_id", id);
  if (quotas.error) throw new HttpError(500, "DB_DELETE_FAILED", quotas.error.message);
  const { error } = await supabaseAdmin.from("leavetype").delete().eq("leave_type_id", id);
  if (error) throw new HttpError(error.code === "23503" ? 409 : 500, error.code === "23503" ? "IN_USE" : "DB_DELETE_FAILED", "ประเภทนี้ยังถูกอ้างถึงอยู่ ลบไม่ได้");
  invalidateLeaveTypes();
  await removeLeaveRule(id);
  await appendHistory({ by: actor, section: "leaveTypes", key: String(id), label: via.label ?? `ลบประเภทการลา "${cur.leave_type_name}"`, before: snap(cur), after: null, revertOf: via.revertOf });
}

/** เรียงลำดับตามรายการ id ที่ส่งมา */
export async function reorderLeaveTypes(ids: number[], actor: Actor, via: Via = {}): Promise<void> {
  const all = await listLeaveTypesFull({ includeInactive: true });
  const known = new Set(all.map((t) => t.leave_type_id));
  if (ids.length !== known.size || !ids.every((id) => known.has(id))) throw new HttpError(422, "VALIDATION", "รายการประเภทการลาไม่ครบหรือไม่ถูกต้อง");
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  const rules: Record<string, LeaveTypeRule> = {};
  ids.forEach((id, i) => {
    const t = all.find((x) => x.leave_type_id === id)!;
    before[String(id)] = t.rule.sortOrder;
    after[String(id)] = i + 1;
    rules[String(id)] = { ...t.rule, sortOrder: i + 1 };
  });
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  await writeLeaveRules(rules);
  await appendHistory({ by: actor, section: "leaveTypes", key: "order", label: via.label ?? "เรียงลำดับประเภทการลา", before, after, revertOf: via.revertOf });
}

/** ย้อนกลับรายการประวัติของประเภทการลา */
export async function revertLeaveTypeEntry(entry: HistoryEntry, actor: Actor): Promise<void> {
  await assertRevertable(entry);
  const via: Via = { label: `ย้อนกลับ: ${entry.label}`, revertOf: entry.id };
  if (entry.key === "reset") {
    // ย้อนการคืนค่าเริ่มต้น: ใช้กฎชุดเดิมของประเภทที่ยังมีอยู่
    const before = (entry.before ?? {}) as Record<string, LeaveTypeRule>;
    const all = await listLeaveTypesFull({ includeInactive: true });
    const rules: Record<string, LeaveTypeRule> = {};
    for (const t of all) if (before[String(t.leave_type_id)]) rules[String(t.leave_type_id)] = cleanRule(before[String(t.leave_type_id)] as unknown as Record<string, unknown>, t.rule);
    await writeLeaveRules(rules);
    await appendHistory({ by: actor, section: "leaveTypes", key: "reset", label: via.label!, before: entry.after, after: rules, revertOf: entry.id });
    return;
  }
  if (entry.key === "order") {
    const all = await listLeaveTypesFull({ includeInactive: true });
    const order = entry.before as Record<string, number>;
    const ids = all.map((t) => t.leave_type_id).sort((a, b) => (order[String(a)] ?? 999) - (order[String(b)] ?? 999));
    return reorderLeaveTypes(ids, actor, via);
  }
  const id = Number(entry.key);
  if (!Number.isInteger(id)) throw new HttpError(400, "CANNOT_REVERT");
  const before = entry.before as Snapshot | null;

  if (!before) {
    // ย้อนการ "เพิ่ม": ลบถ้ายังไม่มีใบลา ไม่งั้นปิดใช้งาน
    const used = (await usageCounts()).get(id) ?? 0;
    if (used > 0) await updateLeaveType(id, { isActive: false }, actor, via);
    else await deleteLeaveType(id, actor, via);
    return;
  }

  const exists = (await listLeaveTypes()).some((t) => t.leave_type_id === id);
  if (!exists) {
    // ย้อนการ "ลบ": สร้างกลับด้วยรหัสเดิม
    const core = { leave_type_id: id, leave_type_name: before.leave_type_name, max_leave_day: before.max_leave_day, carry_over_max: before.carry_over_max, note: before.note };
    const { error } = await supabaseAdmin.from("leavetype").insert(core);
    if (error) throw new HttpError(500, "DB_INSERT_FAILED", error.message);
    invalidateLeaveTypes();
    const rule = cleanRule(before as unknown as Record<string, unknown>, defaultLeaveRule(id));
    await writeLeaveRules({ [String(id)]: rule });
    await appendHistory({ by: actor, section: "leaveTypes", key: String(id), label: via.label!, before: null, after: before, revertOf: entry.id });
    return;
  }
  await updateLeaveType(id, before as unknown as Record<string, unknown>, actor, via);
}

/** คืนกฎ/คำอธิบาย/สี/ลำดับ/การเปิดใช้งานของทุกประเภทเป็นค่าเริ่มต้น (ข้อมูลหลักในตาราง leavetype ไม่เปลี่ยน) */
export async function resetLeaveTypeRules(actor: Actor): Promise<boolean> {
  const all = await listLeaveTypesFull({ includeInactive: true });
  const before: Record<string, LeaveTypeRule> = {};
  const after: Record<string, LeaveTypeRule> = {};
  for (const t of all) {
    before[String(t.leave_type_id)] = t.rule;
    after[String(t.leave_type_id)] = defaultLeaveRule(t.leave_type_id);
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  await writeLeaveRules(after);
  await appendHistory({ by: actor, section: "leaveTypes", key: "reset", label: "คืนค่าเริ่มต้น: กฎประเภทการลา", before, after });
  return true;
}


/** โควตาสำหรับแสดงผล: ซ่อนประเภทที่ปิดใช้งาน (ยกเว้นมีการใช้/รออนุมัติ) และเรียงตามที่ผู้ดูแลตั้งไว้ */
export async function quotaForDisplay<T extends { leave_type_id: number; used: number; reserved: number }>(items: T[]): Promise<T[]> {
  const types = await listLeaveTypesFull({ includeInactive: true });
  const order = new Map(types.map((t, i) => [t.leave_type_id, { i, active: t.rule.isActive }]));
  return items
    .filter((q) => order.get(q.leave_type_id)?.active !== false || q.used > 0 || q.reserved > 0)
    .sort((a, b) => (order.get(a.leave_type_id)?.i ?? 999) - (order.get(b.leave_type_id)?.i ?? 999));
}
