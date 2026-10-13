// E2E ทั้งระบบ — ยิง HTTP จริงไปที่เซิร์ฟเวอร์ Next (production) ด้วยบัญชีทดสอบทุกบทบาท
// ใช้:   node tests/e2e/run.mjs            (ต้องเปิด `npm start` ไว้ที่ BASE ก่อน, ค่าเริ่มต้น http://localhost:3100)
//        node tests/e2e/run.mjs --cleanup  (ลบข้อมูลทดสอบที่ค้าง)
// ข้อมูลทดสอบทั้งหมด: อีเมล e2e-*@example.com, ชื่อขึ้นต้น __test__ — ลบทิ้งทั้งหมดใน finally
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE || "http://localhost:3100";
const RUN = Date.now().toString(36);
const PW = `E2e-${RUN}-Pw!`;
const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// บัญชี admin จริง (ไม่บังคับ) — ส่งผ่าน env เท่านั้น ห้ามเขียนรหัสผ่านลงไฟล์
const REAL_ADMIN = process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
  ? { label: "realadmin", email: process.env.E2E_ADMIN_EMAIL.toLowerCase(), password: process.env.E2E_ADMIN_PASSWORD }
  : null;
const ROLE_ID = { admin: 1, user: 2, supervisor: 3, director: 4, academic: 5 };
const TEST_PREFIX = "__test__";

/* ------------------------------------------------------------------ ผลการทดสอบ */
const results = [];
const timings = [];
let current = "";
const section = (name) => {
  current = name;
  console.log(`\n=== ${name}`);
};
class Fail extends Error {}
class Warn extends Error {}
const expect = (cond, msg) => {
  if (!cond) throw new Fail(msg);
};
const warnIf = (cond, msg) => {
  if (cond) throw new Warn(msg);
};

async function t(id, name, fn) {
  try {
    const note = await fn();
    results.push({ id, group: current, name, result: "PASS", note: note ?? "" });
    console.log(`  PASS ${id} ${name}${note ? ` — ${note}` : ""}`);
  } catch (e) {
    const result = e instanceof Warn ? "WARN" : "FAIL";
    const note = e instanceof Fail || e instanceof Warn ? e.message : `ERROR: ${e?.stack || e}`;
    results.push({ id, group: current, name, result, note });
    console.log(`  ${result} ${id} ${name} — ${note}`);
  }
}

/* ------------------------------------------------------------------ HTTP */
async function call(who, method, p, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookies = [];
  if (who?.cookie) cookies.push(who.cookie);
  if (opts.activeRole) cookies.push(`active_role=${opts.activeRole}`);
  if (cookies.length) headers.cookie = cookies.join("; ");
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const t0 = performance.now();
  const res = await fetch(BASE + p, { method, headers, body: payload, redirect: "manual" });
  const ms = performance.now() - t0;
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML/ว่าง */
  }
  timings.push({ method, path: p.split("?")[0], status: res.status, ms, who: who?.label ?? "anon" });
  return { status: res.status, json, text, headers: res.headers, ms };
}
const show = (r) => `${r.status} ${r.json ? JSON.stringify(r.json).slice(0, 160) : r.text.slice(0, 80)}`;
const expectStatus = (r, code, extra = "") => expect(r.status === code, `คาด ${code} ได้ ${show(r)} ${extra}`);
const get = (w, p, o) => call(w, "GET", p, undefined, o);
const post = (w, p, b, o) => call(w, "POST", p, b, o);
const patch = (w, p, b, o) => call(w, "PATCH", p, b, o);
const put = (w, p, b, o) => call(w, "PUT", p, b, o);
const del = (w, p, b, o) => call(w, "DELETE", p, b, o);

/* ------------------------------------------------------------------ บัญชีทดสอบ */
async function createTestUser(label, roles, { teacherGroup } = {}) {
  const email = `e2e-${RUN}-${label}@example.com`.toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  const u = await admin.from("users").insert({ user_id: id, prename: "", name: `${TEST_PREFIX}${label}`, surname: RUN, is_active: true });
  if (u.error) throw new Error(`users ${label}: ${u.error.message}`);
  if (roles.length) {
    const r = await admin.from("userrole").insert(roles.map((n) => ({ user_id: id, role_type_id: ROLE_ID[n] })));
    if (r.error) throw new Error(`userrole ${label}: ${r.error.message}`);
  }
  let teacherId = null;
  if (teacherGroup !== undefined) {
    const tr = await admin.from("teacher").insert({ user_id: id, subject_group_id: teacherGroup }).select("teacher_id").single();
    if (tr.error) throw new Error(`teacher ${label}: ${tr.error.message}`);
    teacherId = tr.data.teacher_id;
  }
  return { label, id, email, roles, teacherId };
}

async function login(user) {
  const jar = new Map();
  const sb = createServerClient(SUPA_URL, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (all) => all.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: user.email, password: user.password ?? PW });
  if (error) return { ok: false, error: error.message };
  user.cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  return { ok: true };
}

/* ------------------------------------------------------------------ ล้างข้อมูล */
async function findTestUserIds() {
  const ids = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (/^e2e-.*@example\.com$/.test(u.email ?? "")) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  const byName = await admin.from("users").select("user_id").like("name", `${TEST_PREFIX}%`);
  for (const r of byName.data ?? []) if (!ids.includes(r.user_id)) ids.push(r.user_id);
  return ids;
}

async function cleanup() {
  const log = [];
  const step = async (name, fn) => {
    try {
      const r = await fn();
      if (r?.error) log.push(`${name}: ERROR ${r.error.message}`);
      else log.push(`${name}: ok${r?.count != null ? ` (${r.count})` : ""}`);
    } catch (e) {
      log.push(`${name}: ERROR ${e.message}`);
    }
  };
  const ids = await findTestUserIds();
  const teachers = ids.length ? (await admin.from("teacher").select("teacher_id").in("user_id", ids)).data ?? [] : [];
  const tIds = teachers.map((t) => t.teacher_id);
  const ts = tIds.length ? (await admin.from("teachingschedule").select("teaching_schedule_id").in("teacher_id", tIds)).data ?? [] : [];
  const tsIds = ts.map((r) => r.teaching_schedule_id);

  if (tsIds.length) await step("substituteuserteaching(ตารางทดสอบ)", () => admin.from("substituteuserteaching").delete({ count: "exact" }).in("teaching_schedule_id", tsIds));
  if (ids.length) await step("substituteuserteaching(ครูแทนทดสอบ)", () => admin.from("substituteuserteaching").delete({ count: "exact" }).in("substitute_user_id", ids));
  if (tIds.length) await step("teachingschedule", () => admin.from("teachingschedule").delete({ count: "exact" }).in("teacher_id", tIds));
  if (ids.length) {
    await step("leaverequest", () => admin.from("leaverequest").delete({ count: "exact" }).in("user_id", ids));
    for (const id of ids) {
      const { data } = await admin.storage.from("leave-attachments").list(`public/${id}`);
      if (data?.length) await step(`storage public/${id.slice(0, 8)}`, () => admin.storage.from("leave-attachments").remove(data.map((f) => `public/${id}/${f.name}`)));
    }
    await step("userleavequota", () => admin.from("userleavequota").delete({ count: "exact" }).in("user_id", ids));
    await step("teacher", () => admin.from("teacher").delete({ count: "exact" }).in("user_id", ids));
    await step("userrole", () => admin.from("userrole").delete({ count: "exact" }).in("user_id", ids));
    await step("users", () => admin.from("users").delete({ count: "exact" }).in("user_id", ids));
    for (const id of ids) await step(`auth ${id.slice(0, 8)}`, () => admin.auth.admin.deleteUser(id));
  }
  {
    const lt = (await admin.from("leavetype").select("leave_type_id").like("leave_type_name", `${TEST_PREFIX}%`)).data ?? [];
    const ltIds = lt.map((x) => x.leave_type_id);
    if (ltIds.length) {
      await step("leaverequest(ประเภททดสอบ)", () => admin.from("leaverequest").delete({ count: "exact" }).in("leave_type_id", ltIds));
      await step("userleavequota(ประเภททดสอบ)", () => admin.from("userleavequota").delete({ count: "exact" }).in("leave_type_id", ltIds));
      await step("leavetype(ทดสอบ)", () => admin.from("leavetype").delete({ count: "exact" }).in("leave_type_id", ltIds));
    }
  }
  await step("subject", () => admin.from("subject").delete({ count: "exact" }).like("subject_name", `${TEST_PREFIX}%`));
  await step("classroom", () => admin.from("classroom").delete({ count: "exact" }).like("classroom_name", `${TEST_PREFIX}%`));
  await step("level", () => admin.from("level").delete({ count: "exact" }).like("level_name", `${TEST_PREFIX}%`));
  await step("subjectgroup", () => admin.from("subjectgroup").delete({ count: "exact" }).like("subject_group_name", `${TEST_PREFIX}%`));
  await step("holiday", () => admin.from("holiday").delete({ count: "exact" }).like("holiday_name", `${TEST_PREFIX}%`));

  // ตรวจว่าไม่เหลือจริง
  const left = await findTestUserIds();
  const leftRows = await Promise.all([
    admin.from("subjectgroup").select("subject_group_id", { count: "exact", head: true }).like("subject_group_name", `${TEST_PREFIX}%`),
    admin.from("holiday").select("holiday_id", { count: "exact", head: true }).like("holiday_name", `${TEST_PREFIX}%`),
    admin.from("level").select("level_id", { count: "exact", head: true }).like("level_name", `${TEST_PREFIX}%`),
  ]);
  log.push(`เหลือผู้ใช้ทดสอบ: ${left.length}, เหลือแถวข้อมูลหลักทดสอบ: ${leftRows.map((r) => r.count ?? 0).join("/")}`);
  return log;
}

if (process.argv.includes("--cleanup")) {
  console.log((await cleanup()).join("\n"));
  process.exit(0);
}

/* ------------------------------------------------------------------ ไฟล์แนบตัวอย่าง */
const pdfBlob = () => new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"], { type: "application/pdf" });
function leaveForm(fields, files = []) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, String(v));
  for (const [blob, name] of files) f.append("file", blob, name);
  return f;
}

/* ================================================================== MAIN */
const U = {};
const ids = {};
const startedAt = new Date();

/* ---------------- การตั้งค่าระบบ: เก็บ/คืนค่าเดิม ---------------- */
let settingsSnapshot = null;
const uploadedLogos = [];
const SETTINGS_FILES = ["settings.json", "settings-history.json"];
async function snapshotSettings() {
  const snap = {};
  for (const f of SETTINGS_FILES) {
    const { data } = await admin.storage.from("app-config").download(f);
    snap[f] = data ? await data.text() : null;
  }
  return snap;
}
async function restoreSettings(snap) {
  // เขียนฉบับเดิมกลับด้วยเลขรุ่นใหม่ (_rev) — เซิร์ฟเวอร์ที่รันอยู่จะยอมรับเฉพาะฉบับที่ใหม่กว่าที่ตัวเองรู้
  const log = [];
  const rev = Date.now() + 1000;
  for (const f of SETTINGS_FILES) {
    let value;
    if (snap[f] === null) value = f === "settings.json" ? { _rev: rev } : { _rev: rev, items: [] };
    else {
      const parsed = JSON.parse(snap[f]);
      value = Array.isArray(parsed) ? { _rev: rev, items: parsed } : { ...parsed, _rev: rev };
    }
    const { error } = await admin.storage.from("app-config").upload(f, new Blob([JSON.stringify(value)], { type: "application/json" }), { upsert: true, contentType: "application/json", cacheControl: "0" });
    log.push(`${f}: ${error ? "ERROR " + error.message : snap[f] === null ? "คืนเป็นค่าเริ่มต้น (เดิมไม่มีไฟล์)" : "คืนค่าเดิม"}`);
  }
  const keys = uploadedLogos.map((u) => decodeURIComponent(u.split("/branding/")[1] ?? "")).filter(Boolean);
  if (keys.length) await admin.storage.from("branding").remove(keys);
  log.push(`โลโก้ทดสอบ: ลบ ${keys.length} ไฟล์`);
  return log;
}

try {
  /* -------------------------------------------------------------- เตรียม */
  section("0. เตรียมข้อมูลทดสอบ");
  const ping = await fetch(BASE + "/login").catch(() => null);
  if (!ping) throw new Error(`เซิร์ฟเวอร์ไม่ตอบที่ ${BASE}`);

  if (REAL_ADMIN) {
    // ใช้บัญชี admin จริงของโรงเรียน: ล็อกอินจริง แล้วสร้างกลุ่มสาระ/บัญชีทดสอบผ่านหน้าจอ admin (API เดียวกับที่หน้าเว็บใช้)
    const l = await login(REAL_ADMIN);
    if (!l.ok) throw new Error(`ล็อกอิน admin จริงไม่สำเร็จ: ${l.error}`);
    const sgr = await post(REAL_ADMIN, "/api/admin/subjectmanagement/subject-group", { subject_group_name: `${TEST_PREFIX}กลุ่มสาระ ${RUN}` });
    if (sgr.status !== 201) throw new Error("สร้างกลุ่มสาระผ่าน admin จริงไม่ได้: " + show(sgr));
    ids.group = sgr.json.item.subject_group_id;
    const viaApi = async (label, roles, teacher = false) => {
      const email = `e2e-${RUN}-${label}@example.com`.toLowerCase();
      const r = await post(REAL_ADMIN, "/api/admin/usermanagement/create-user", {
        email, password: PW, prename: "", name: `${TEST_PREFIX}${label}`, surname: RUN,
        role: roles.map((n) => ROLE_ID[n]), ...(teacher ? { is_teacher: true, subject_group_id: ids.group } : {}),
      });
      if (r.status !== 201) throw new Error(`admin จริงสร้างบัญชี ${label} ไม่ได้: ${show(r)}`);
      return { label, id: r.json.user_id, email, roles };
    };
    U.admin = await viaApi("admin", ["admin"]);
    U.sup = await viaApi("supervisor", ["supervisor"]);
    U.dir = await viaApi("director", ["director"]);
    U.aca = await viaApi("academic", ["academic"]);
    U.ta = await viaApi("teacherA", ["user"], true);
    U.tb = await viaApi("teacherB", ["user"], true);
    U.multi = await viaApi("multi", ["user", "supervisor", "director"]);
    U.none = await createTestUser("norole", []); // หน้าจอ admin บังคับให้มีอย่างน้อย 1 บทบาท จึงสร้างตรงด้วย service key
  } else {
    const sg = await admin.from("subjectgroup").insert({ subject_group_name: `${TEST_PREFIX}กลุ่มสาระ ${RUN}` }).select("subject_group_id").single();
    if (sg.error) throw new Error("subjectgroup: " + sg.error.message);
    ids.group = sg.data.subject_group_id;

    U.admin = await createTestUser("admin", ["admin"]);
    U.sup = await createTestUser("supervisor", ["supervisor"]);
    U.dir = await createTestUser("director", ["director"]);
    U.aca = await createTestUser("academic", ["academic"]);
    U.ta = await createTestUser("teacherA", ["user"], { teacherGroup: ids.group });
    U.tb = await createTestUser("teacherB", ["user"], { teacherGroup: ids.group });
    U.multi = await createTestUser("multi", ["user", "supervisor", "director"]);
    U.none = await createTestUser("norole", []);
  }
  for (const u of Object.values(U)) {
    const r = await login(u);
    if (!r.ok) throw new Error(`login ${u.label}: ${r.error}`);
  }
  console.log(`  สร้างบัญชีทดสอบ ${Object.keys(U).length} บัญชี + กลุ่มสาระ #${ids.group} (RUN=${RUN})`);

  const ROLE_USERS = { admin: U.admin, user: U.ta, supervisor: U.sup, director: U.dir, academic: U.aca };

  /* -------------------------------------------------------------- 0b. บัญชี admin จริง (อ่านอย่างเดียว) */
  if (REAL_ADMIN) {
    section("0b. บัญชี admin จริง (อ่านอย่างเดียว — ไม่แก้ข้อมูลของบัญชีนี้)");
    const countOf = async (table) => (await admin.from(table).select("*", { count: "exact", head: true })).count;
    await t("RA-01", "admin จริง: /api/me มีบทบาท admin และบัญชีเปิดใช้งาน", async () => {
      const r = await get(REAL_ADMIN, "/api/me");
      expectStatus(r, 200);
      REAL_ADMIN.id = r.json.user_id;
      expect(r.json.roles.some((x) => x.name === "admin"), JSON.stringify(r.json.roles));
      return `บทบาท: ${r.json.roles.map((x) => x.name).join(", ")}`;
    });
    await t("RA-02", "admin จริง: set-role admin → หน้าแรก /user-management", async () => {
      const r = await post(REAL_ADMIN, "/api/auth/set-role", { roleId: 1 });
      expect(r.status === 200 && r.json.home === "/user-management", show(r));
    });
    await t("RA-03", "admin จริง: เปิดหน้า admin ทั้ง 9 หน้าได้ (200) ด้วยข้อมูลจริง", async () => {
      const bad = [];
      for (const p of ["/user-management", "/classroom-management", "/holiday-management", "/level-management", "/schedule-management", "/semester-management", "/subjectgroup-management", "/subject-management", "/year-management"]) {
        const r = await get(REAL_ADMIN, p, { activeRole: "1" });
        if (r.status !== 200) bad.push(`${p} → ${r.status}`);
      }
      expect(bad.length === 0, bad.join(" | "));
    });
    await t("RA-04", "admin จริง: get-user แสดงผู้ใช้ครบเท่าตาราง users และทุกคนมีอีเมล", async () => {
      const r = await get(REAL_ADMIN, "/api/admin/usermanagement/get-user");
      expectStatus(r, 200);
      const db = await countOf("users");
      const noEmail = r.json.users.filter((u) => !u.email).length;
      expect(r.json.users.length === db, `API ${r.json.users.length} คน, DB ${db} คน`);
      expect(noEmail === 0, `ไม่มีอีเมล ${noEmail} คน`);
      return `${db} คน`;
    });
    await t("RA-05", "admin จริง: รายการข้อมูลหลักครบเท่าฐานข้อมูล (ระดับชั้น/ห้อง/กลุ่มสาระ/วิชา/วันหยุด)", async () => {
      const out = [];
      for (const [p, table] of [["/api/admin/levelmanagement", "level"], ["/api/admin/classroommanagement", "classroom"], ["/api/admin/subjectmanagement/subject-group", "subjectgroup"], ["/api/admin/subjectmanagement/subject", "subject"], ["/api/admin/holiday", "holiday"]]) {
        const r = await get(REAL_ADMIN, p);
        const db = await countOf(table);
        expect(r.status === 200 && r.json.items.length === db, `${table}: API ${r.json?.items?.length} DB ${db}`);
        out.push(`${table}=${db}`);
      }
      return out.join(" ");
    });
    await t("RA-06", "admin จริง: ตารางสอนของครูทุกคนเปิดได้", async () => {
      const r = await get(REAL_ADMIN, "/api/admin/schedule/teacher");
      expectStatus(r, 200);
      const list = r.json.items ?? r.json.teachers ?? r.json;
      const bad = [];
      for (const tch of Array.isArray(list) ? list : []) {
        const uid = tch.user_id ?? tch.id;
        if (!uid) continue;
        const s = await get(REAL_ADMIN, `/api/admin/schedule/table/${uid}`);
        if (s.status !== 200) bad.push(`${String(uid).slice(0, 8)} → ${s.status}`);
      }
      expect(bad.length === 0, bad.join(" | "));
      return `${Array.isArray(list) ? list.length : "?"} คน`;
    });
    await t("RA-07", "admin จริง: API ของบทบาทอื่น → 403 (ไม่มีสิทธิ์เกินบทบาท)", async () => {
      const roles = ((await get(REAL_ADMIN, "/api/me")).json.roles ?? []).map((x) => x.name);
      const bad = [];
      for (const [p, role] of [["/api/director/leave-approve", "director"], ["/api/supervisor/leave-review", "supervisor"], ["/api/academic/leaves", "academic"], ["/api/user/leave-history", "user"]]) {
        const r = await get(REAL_ADMIN, p);
        const shouldPass = roles.includes(role);
        if (shouldPass ? r.status !== 200 : r.status !== 403) bad.push(`${p} → ${r.status} (มีบทบาท ${role}: ${shouldPass})`);
      }
      expect(bad.length === 0, bad.join(" | "));
    });
  }

  /* -------------------------------------------------------------- 1. ไม่ได้ล็อกอิน */
  section("1. ไม่ได้ล็อกอิน (anonymous)");

  const API = [
    // [method, path, allowedRoles | "any"]
    ["GET", "/api/academic/free-teachers?date=2026-11-16&period=1", ["academic"]],
    ["GET", "/api/academic/leaves", ["academic"]],
    ["GET", "/api/academic/leaves/999999", ["academic"]],
    ["PATCH", "/api/academic/leaves/999999/complete", ["academic"]],
    ["GET", "/api/academic/substitution-history?from=2026-11-01&to=2026-11-30", ["academic"]],
    ["POST", "/api/academic/substitutions", ["academic"]],
    ["GET", "/api/admin/levelmanagement", "any"],
    ["POST", "/api/admin/levelmanagement", ["admin"]],
    ["PATCH", "/api/admin/levelmanagement/999999", ["admin"]],
    ["DELETE", "/api/admin/levelmanagement/999999", ["admin"]],
    ["GET", "/api/admin/classroommanagement", "any"],
    ["POST", "/api/admin/classroommanagement", ["admin"]],
    ["PATCH", "/api/admin/classroommanagement/999999", ["admin"]],
    ["DELETE", "/api/admin/classroommanagement/999999", ["admin"]],
    ["GET", "/api/admin/subjectmanagement/subject", "any"],
    ["POST", "/api/admin/subjectmanagement/subject", ["admin"]],
    ["PATCH", "/api/admin/subjectmanagement/subject/999999", ["admin"]],
    ["DELETE", "/api/admin/subjectmanagement/subject/999999", ["admin"]],
    ["GET", "/api/admin/subjectmanagement/subject-group", "any"],
    ["POST", "/api/admin/subjectmanagement/subject-group", ["admin"]],
    ["PATCH", "/api/admin/subjectmanagement/subject-group/999999", ["admin"]],
    ["DELETE", "/api/admin/subjectmanagement/subject-group/999999", ["admin"]],
    ["GET", "/api/admin/holiday", "any"],
    ["POST", "/api/admin/holiday", ["admin"]],
    ["PATCH", "/api/admin/holiday/999999", ["admin"]],
    ["DELETE", "/api/admin/holiday/999999", ["admin"]],
    ["GET", "/api/admin/role-type", ["admin"]],
    ["GET", "/api/admin/schedule/teacher", ["admin", "academic"]],
    ["GET", `/api/admin/schedule/table/${U.ta.id}`, ["admin", "academic"]],
    ["POST", `/api/admin/schedule/table/${U.ta.id}`, ["admin"]],
    ["PATCH", `/api/admin/schedule/table/${U.ta.id}?teaching_schedule_id=999999`, ["admin"]],
    ["DELETE", `/api/admin/schedule/table/${U.ta.id}?teaching_schedule_id=999999`, ["admin"]],
    ["POST", "/api/admin/usermanagement/create-user", ["admin"]],
    ["PUT", "/api/admin/usermanagement/deactivate-user", ["admin"]],
    ["DELETE", "/api/admin/usermanagement/delete-user", ["admin"]],
    ["PUT", "/api/admin/usermanagement/edit-user", ["admin"]],
    ["GET", "/api/admin/usermanagement/get-user", ["admin"]],
    ["PUT", "/api/admin/usermanagement/reactivate-user", ["admin"]],
    ["POST", "/api/auth/set-role", "any"],
    ["GET", "/api/director/approved-history", ["director"]],
    ["POST", "/api/director/create-leave", ["director"]],
    ["GET", "/api/director/dashboard-data", ["director"]],
    ["GET", `/api/director/employee-quota?userId=${U.ta.id}`, ["director"]],
    ["GET", "/api/director/employees", ["director"]],
    ["GET", "/api/director/leave-approve", ["director"]],
    ["POST", "/api/director/leave-approve", ["director"]],
    ["DELETE", "/api/director/leave-approve/999999", ["director"]],
    ["GET", "/api/holidays", "any"],
    ["GET", "/api/leave-types", "any"],
    ["GET", "/api/me", "any"],
    ["PATCH", "/api/me", "any"],
    ["GET", "/api/supervisor/leave-review", ["supervisor"]],
    ["POST", "/api/supervisor/leave-review", ["supervisor"]],
    ["GET", "/api/supervisor/reviewed-history", ["supervisor"]],
    ["GET", "/api/user/dashboard-user", ["user"]],
    ["GET", "/api/user/leave-history", ["user"]],
    ["GET", "/api/user/leave-history/999999", ["user"]],
    ["PATCH", "/api/user/leave-history/999999", ["user"]],
    ["DELETE", "/api/user/leave-history/999999", ["user"]],
    ["GET", "/api/user/leave-quota", ["user"]],
    ["POST", "/api/user/leave-request", ["user"]],
    ["GET", "/api/user/quota?leaveTypeId=1", ["user"]],
  ];

  await t("AN-01", `API ทุกตัว (${API.length} รายการ) ตอบ 401 เมื่อไม่ได้ล็อกอิน`, async () => {
    const bad = [];
    for (const [m, p] of API) {
      const r = await call(null, m, p, m === "GET" ? undefined : {});
      if (r.status !== 401) bad.push(`${m} ${p} → ${r.status}`);
    }
    expect(bad.length === 0, bad.join(" | "));
    return `${API.length}/${API.length}`;
  });
  await t("AN-02", "POST /api/auth/logout ไม่ได้ล็อกอิน → 200 (ไม่พัง)", async () => {
    const r = await post(null, "/api/auth/logout");
    expectStatus(r, 200);
  });
  await t("AN-03", "หน้า /login เปิดได้ 200", async () => expectStatus(await get(null, "/login"), 200));

  const PAGES = {
    admin: ["/user-management", "/classroom-management", "/holiday-management", "/level-management", "/schedule-management", "/semester-management", "/subjectgroup-management", "/subject-management", "/year-management"],
    user: ["/dashbord-user", "/leave-history", "/leave-overview", "/leave-page"],
    supervisor: ["/reviewed-page", "/reviewed-history"],
    director: ["/approved-history", "/dashboard", "/leave-approve"],
    academic: ["/leavetable", "/schedule", "/substitution-history"],
  };
  const ALL_PAGES = Object.values(PAGES).flat();

  await t("AN-04", `ทุกหน้า (${ALL_PAGES.length + 3}) redirect ไป /login เมื่อไม่ได้ล็อกอิน`, async () => {
    const bad = [];
    for (const p of [...ALL_PAGES, "/", "/select-role", "/403"]) {
      const r = await get(null, p);
      const loc = r.headers.get("location") ?? "";
      if (!(r.status >= 300 && r.status < 400 && loc.includes("/login"))) bad.push(`${p} → ${r.status} ${loc}`);
    }
    expect(bad.length === 0, bad.join(" | "));
  });
  await t("AN-05", "ไฟล์ static (/fonts/...) ไม่ถูก middleware บล็อก", async () => {
    const r = await get(null, "/fonts/Sarabun-Regular.ttf");
    expect(r.status === 200, `ได้ ${r.status}`);
  });

  /* -------------------------------------------------------------- 2. สิทธิ์ตามบทบาท (API) */
  section("2. สิทธิ์ตามบทบาท — API");
  for (const [roleName, u] of Object.entries(ROLE_USERS)) {
    await t(`RB-${roleName}`, `บทบาท ${roleName}: API ที่ไม่มีสิทธิ์ → 403, API ที่มีสิทธิ์ (GET) → ไม่ใช่ 401/403`, async () => {
      const bad = [];
      let n = 0;
      for (const [m, p, allowed] of API) {
        const ok = allowed === "any" || allowed.includes(roleName);
        if (ok && m !== "GET") continue; // ไม่ยิง mutation ของบทบาทที่มีสิทธิ์ในชุดนี้
        n++;
        const r = await call(u, m, p, m === "GET" ? undefined : {});
        if (ok && (r.status === 401 || r.status === 403 || r.status >= 500)) bad.push(`${m} ${p} → ${r.status} (ควรผ่าน)`);
        if (!ok && r.status !== 403) bad.push(`${m} ${p} → ${r.status} (ควร 403)`);
      }
      expect(bad.length === 0, bad.join(" | "));
      return `${n} คำขอ`;
    });
  }
  await t("RB-norole", "ผู้ใช้ที่ไม่มีบทบาท: API เฉพาะบทบาท → 403, API 'any' → 200", async () => {
    const bad = [];
    for (const [m, p, allowed] of API) {
      if (allowed === "any" && m !== "GET") continue;
      const r = await call(U.none, m, p, m === "GET" ? undefined : {});
      if (allowed === "any" && r.status !== 200) bad.push(`${m} ${p} → ${r.status}`);
      if (allowed !== "any" && r.status !== 403) bad.push(`${m} ${p} → ${r.status}`);
    }
    expect(bad.length === 0, bad.join(" | "));
  });
  await t("RB-cookie", "ปลอม cookie active_role=1 (admin) ด้วยบัญชี user → API admin ยังได้ 403", async () => {
    const r = await get(U.ta, "/api/admin/usermanagement/get-user", { activeRole: "1" });
    expectStatus(r, 403);
  });

  /* -------------------------------------------------------------- 3. หน้าเว็บตามบทบาท */
  section("3. สิทธิ์ตามบทบาท — หน้าเว็บ");
  for (const [roleName, u] of Object.entries(ROLE_USERS)) {
    await t(`PG-${roleName}`, `บทบาท ${roleName}: หน้าของตัวเอง 200, หน้าบทบาทอื่น → /403`, async () => {
      const bad = [];
      for (const [owner, pages] of Object.entries(PAGES)) {
        for (const p of pages) {
          const r = await get(u, p, { activeRole: String(ROLE_ID[roleName]) });
          const loc = r.headers.get("location") ?? "";
          if (owner === roleName && r.status !== 200) bad.push(`${p} → ${r.status} ${loc} (ควร 200)`);
          if (owner !== roleName) {
            const toForbidden = (r.status >= 300 && r.status < 400 && loc.includes("/403")) || /NEXT_REDIRECT;[^;]*;\/403/.test(r.text);
            if (!toForbidden) bad.push(`${p} → ${r.status} ${loc} (ควรไป /403)`);
          }
        }
      }
      expect(bad.length === 0, bad.join(" | "));
    });
  }
  await t("PG-02", "ล็อกอินแล้วแต่ยังไม่เลือกบทบาท → redirect /select-role", async () => {
    const r = await get(U.ta, "/leave-history");
    expect(r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/select-role"), show(r));
  });
  await t("PG-03", "ล็อกอินแล้วเปิด /login → redirect /select-role", async () => {
    const r = await get(U.ta, "/login");
    expect((r.headers.get("location") ?? "").includes("/select-role"), show(r));
  });
  await t("PG-04", "หน้า /select-role แสดงบทบาทของผู้ใช้หลายบทบาท", async () => {
    const r = await get(U.multi, "/select-role");
    expectStatus(r, 200);
  });
  await t("PG-05", "หน้าแรก / และ /403 เปิดได้เมื่อเลือกบทบาทแล้ว", async () => {
    expectStatus(await get(U.ta, "/", { activeRole: "2" }), 200);
    expectStatus(await get(U.ta, "/403", { activeRole: "2" }), 200);
  });
  await t("PG-06", "ผู้ใช้ไม่มีบทบาทเปิด /select-role ได้ (ไม่วนลูป redirect)", async () => {
    const r = await get(U.none, "/select-role");
    expect(r.status === 200, show(r));
  });

  /* -------------------------------------------------------------- 4. auth / me / ข้อมูลทั่วไป */
  section("4. เลือกบทบาท / โปรไฟล์ / ข้อมูลทั่วไป");
  await t("AU-01", "set-role บทบาทที่มีจริง → 200 + cookie active_role + หน้าแรก", async () => {
    const r = await post(U.multi, "/api/auth/set-role", { roleId: 3 });
    expectStatus(r, 200);
    expect(r.json.home === "/reviewed-page", `home=${r.json.home}`);
    expect((r.headers.get("set-cookie") ?? "").includes("active_role=3"), "ไม่มี set-cookie");
    const sc = r.headers.get("set-cookie") ?? "";
    return `cookie flags: ${sc.split(";").slice(1).map((s) => s.trim()).join(", ")}`;
  });
  await t("AU-02", "set-role บทบาทที่ไม่มี → 403", async () => expectStatus(await post(U.ta, "/api/auth/set-role", { roleId: 1 }), 403));
  await t("AU-03", "set-role ไม่ส่ง roleId → 400", async () => expectStatus(await post(U.ta, "/api/auth/set-role", {}), 400));
  await t("AU-04", "set-role body ไม่ใช่ JSON → 400", async () => {
    const r = await call(U.ta, "POST", "/api/auth/set-role", undefined, { headers: { "content-type": "application/json" } });
    expect(r.status === 400, show(r));
  });
  await t("ME-01", "GET /api/me คืนอีเมล ชื่อ และบทบาท", async () => {
    const r = await get(U.multi, "/api/me");
    expectStatus(r, 200);
    expect(r.json.email === U.multi.email, "email ไม่ตรง");
    expect(r.json.roles.length === 3, `roles=${JSON.stringify(r.json.roles)}`);
  });
  await t("ME-02", "PATCH /api/me แก้ชื่อ → 200 และอ่านกลับได้", async () => {
    expectStatus(await patch(U.tb, "/api/me", { prename: "นาย", name: `${TEST_PREFIX}teacherB`, surname: `${RUN}-แก้` }), 200);
    const r = await get(U.tb, "/api/me");
    expect(r.json.surname === `${RUN}-แก้` && r.json.prename === "นาย", show(r));
  });
  await t("ME-03", "PATCH /api/me ไม่มีชื่อ → 422", async () => expectStatus(await patch(U.tb, "/api/me", { name: "", surname: "x" }), 422));
  await t("ME-04", "PATCH /api/me เบอร์โทร 08x → เก็บเป็น 66x แสดงกลับเป็น 08x", async () => {
    const r1 = await patch(U.tb, "/api/me", { name: `${TEST_PREFIX}teacherB`, surname: RUN, tel: "081-000-" + String(Date.now()).slice(-4) });
    expectStatus(r1, 200);
    const r = await get(U.tb, "/api/me");
    expect(/^08\d{8}$/.test(r.json.tel), `tel=${r.json.tel}`);
  });
  await t("LT-01", "GET /api/leave-types คืนประเภทลาครบ (รวม max_leave_day = null)", async () => {
    const r = await get(U.ta, "/api/leave-types");
    expectStatus(r, 200);
    const items = r.json.items ?? r.json;
    expect(Array.isArray(items) && items.length >= 7, show(r));
    return `${items.length} ประเภท`;
  });
  await t("HO-01", "GET /api/holidays ค่าเริ่มต้น (เดือนนี้)", async () => {
    const r = await get(U.ta, "/api/holidays");
    expectStatus(r, 200);
    warnIf(r.json.degraded, "degraded=true → ดึงวันหยุดจาก Google ไม่สำเร็จ");
    return `${r.json.start}..${r.json.end} ${r.json.holidays.length} วัน`;
  });
  await t("HO-02", "GET /api/holidays?year=2026 มีวันหยุดราชการ (Google)", async () => {
    const r = await get(U.ta, "/api/holidays?year=2026");
    expectStatus(r, 200);
    const g = r.json.holidays.filter((h) => h.source === "google").length;
    expect(g > 5, `วันหยุดจาก Google = ${g} (degraded=${r.json.degraded})`);
    return `google=${g}, school=${r.json.holidays.length - g}`;
  });
  await t("HO-03", "GET /api/holidays?fiscal=2027 ช่วง 2026-10-01..2027-09-30", async () => {
    const r = await get(U.ta, "/api/holidays?fiscal=2027");
    expect(r.json.start === "2026-10-01" && r.json.end === "2027-09-30", show(r));
  });
  await t("HO-04", "GET /api/holidays พารามิเตอร์ผิด → 400 (month=2026-13, year=26, start>end)", async () => {
    for (const q of ["month=2026-13", "year=26", "start=2026-12-01&end=2026-11-01", "fiscal=abc"]) {
      const r = await get(U.ta, `/api/holidays?${q}`);
      expect(r.status === 400, `${q} → ${r.status}`);
    }
  });

  /* -------------------------------------------------------------- 5. ข้อมูลหลัก (CRUD) */
  section("5. ข้อมูลหลัก (admin CRUD)");
  const CRUD = [
    { key: "level", base: "/api/admin/levelmanagement", idCol: "level_id", create: { level_name: `${TEST_PREFIX}ระดับ` }, update: { level_name: `${TEST_PREFIX}ระดับ-แก้` }, missing: {} },
    { key: "subjectgroup", base: "/api/admin/subjectmanagement/subject-group", idCol: "subject_group_id", create: { subject_group_name: `${TEST_PREFIX}กลุ่ม` }, update: { subject_group_name: `${TEST_PREFIX}กลุ่ม-แก้` }, missing: { subject_group_name: "   " } },
    { key: "classroom", base: "/api/admin/classroommanagement", idCol: "classroom_id", create: () => ({ classroom_name: `${TEST_PREFIX}ห้อง`, classroom_level: ids.level }), update: { classroom_name: `${TEST_PREFIX}ห้อง-แก้` }, missing: { classroom_level: 1 } },
    { key: "subject", base: "/api/admin/subjectmanagement/subject", idCol: "subject_id", create: () => ({ subject_code: `T${RUN}`, subject_name: `${TEST_PREFIX}วิชา`, subject_level_id: ids.level, subject_group_id: ids.group }), update: { subject_name: `${TEST_PREFIX}วิชา-แก้` }, missing: { subject_code: "X" } },
    { key: "holiday", base: "/api/admin/holiday", idCol: "holiday_id", create: { holiday_name: `${TEST_PREFIX}วันหยุด`, holiday_date: "2030-01-15" }, update: { holiday_name: `${TEST_PREFIX}วันหยุด-แก้` }, missing: { holiday_name: "x" } },
  ];
  for (const c of CRUD) {
    await t(`CR-${c.key}-1`, `${c.key}: POST สร้าง → 201`, async () => {
      const body = typeof c.create === "function" ? c.create() : c.create;
      const r = await post(U.admin, c.base, body);
      expectStatus(r, 201);
      ids[c.key] = r.json.item[c.idCol];
      return `id=${ids[c.key]}`;
    });
    await t(`CR-${c.key}-2`, `${c.key}: POST ขาดฟิลด์บังคับ → 422`, async () => expectStatus(await post(U.admin, c.base, c.missing), 422));
    await t(`CR-${c.key}-3`, `${c.key}: GET รายการมีแถวที่สร้าง`, async () => {
      const r = await get(U.ta, c.base);
      expectStatus(r, 200);
      expect(r.json.items.some((x) => x[c.idCol] === ids[c.key]), "ไม่พบแถว");
    });
    await t(`CR-${c.key}-4`, `${c.key}: PATCH แก้ไข → 200`, async () => {
      const r = await patch(U.admin, `${c.base}/${ids[c.key]}`, c.update);
      expectStatus(r, 200);
    });
    await t(`CR-${c.key}-5`, `${c.key}: PATCH id ไม่มีอยู่ → 404, id ไม่ใช่ตัวเลข → 400, body ว่าง → 400`, async () => {
      expectStatus(await patch(U.admin, `${c.base}/99999999`, c.update), 404);
      expectStatus(await patch(U.admin, `${c.base}/abc`, c.update), 400);
      expectStatus(await patch(U.admin, `${c.base}/${ids[c.key]}`, { unknown: 1 }), 400);
    });
  }
  await t("CR-holiday-6", "holiday: วันที่ผิดรูปแบบ → 422", async () =>
    expectStatus(await post(U.admin, "/api/admin/holiday", { holiday_name: `${TEST_PREFIX}x`, holiday_date: "2030-02-30" }), 422)
  );
  await t("CR-level-6", "level: ลบระดับชั้นที่ห้องเรียนยังใช้อยู่ → 409 IN_USE (ใช้ระดับ/ห้องแยกเฉพาะเทสนี้)", async () => {
    const lv = await post(U.admin, "/api/admin/levelmanagement", { level_name: `${TEST_PREFIX}ระดับลบ` });
    const room = await post(U.admin, "/api/admin/classroommanagement", { classroom_name: `${TEST_PREFIX}ห้องลบ`, classroom_level: lv.json.item.level_id });
    const sub = await post(U.admin, "/api/admin/subjectmanagement/subject", { subject_code: `D${RUN}`, subject_name: `${TEST_PREFIX}วิชาลบ`, subject_level_id: lv.json.item.level_id });
    // คาบสอนของ teacherB ที่ใช้ห้อง/วิชานี้ — ดูว่าถูกลบลูกโซ่ด้วยหรือไม่
    const slot = await post(U.admin, `/api/admin/schedule/table/${U.tb.id}`, { day_of_week: 5, period_number: 6, subject_id: sub.json.item.subject_id, classroom_id: room.json.item.classroom_id });
    const slotId = slot.json?.schedules?.[0]?.teaching_schedule_id;
    const r = await del(U.admin, `/api/admin/levelmanagement/${lv.json.item.level_id}`);
    const roomLeft = await admin.from("classroom").select("classroom_id, classroom_level").eq("classroom_id", room.json.item.classroom_id).maybeSingle();
    const subLeft = await admin.from("subject").select("subject_id, subject_level_id").eq("subject_id", sub.json.item.subject_id).maybeSingle();
    const slotLeft = slotId ? await admin.from("teachingschedule").select("teaching_schedule_id, subject_id, classroom_id").eq("teaching_schedule_id", slotId).maybeSingle() : { data: "n/a" };
    if (slotId && slotLeft.data) await admin.from("teachingschedule").delete().eq("teaching_schedule_id", slotId);
    const effect = `ห้องเรียน: ${roomLeft.data ? `ยังอยู่ (level=${roomLeft.data.classroom_level})` : "ถูกลบตามไปด้วย (CASCADE)"}, รายวิชา: ${subLeft.data ? `ยังอยู่ (level=${subLeft.data.subject_level_id})` : "ถูกลบตามไปด้วย"}, คาบสอนที่ใช้ห้อง/วิชานี้: ${slotId ? (slotLeft.data ? `ยังอยู่ (${JSON.stringify(slotLeft.data)})` : "ถูกลบตามไปด้วย") : `สร้างคาบไม่ได้ ${show(slot)}`}`;
    expect(r.status === 409, `${show(r)} → ${effect}`);
    return effect;
  });
  await t("CR-group-6", "subjectgroup: ลบกลุ่มสาระที่ครู/วิชาใช้อยู่ → 409 IN_USE", async () => {
    const r = await del(U.admin, `/api/admin/subjectmanagement/subject-group/${ids.group}`);
    expect(r.status === 409, show(r));
  });
  await t("CR-group-7", "subjectgroup: ชื่อซ้ำ (ต่างตัวพิมพ์/เว้นวรรค) → 409", async () => {
    const r = await post(U.admin, "/api/admin/subjectmanagement/subject-group", { subject_group_name: `  ${TEST_PREFIX}กลุ่ม-แก้ ` });
    expect(r.status === 409, show(r));
  });
  await t("CR-classroom-7","classroom: classroom_level ไม่ใช่ตัวเลข → 422", async () =>
    expectStatus(await post(U.admin, "/api/admin/classroommanagement", { classroom_name: `${TEST_PREFIX}y`, classroom_level: "abc" }), 422)
  );
  await t("CR-classroom-8", "classroom: classroom_level ชี้ไประดับที่ไม่มี → 4xx (ไม่ใช่ 500)", async () => {
    const r = await post(U.admin, "/api/admin/classroommanagement", { classroom_name: `${TEST_PREFIX}z`, classroom_level: 99999999 });
    expect(r.status >= 400 && r.status < 500, show(r));
  });
  await t("CR-subject-7", "subject: รหัสวิชาซ้ำ → 409 DUPLICATE", async () => {
    const r = await post(U.admin, "/api/admin/subjectmanagement/subject", { subject_code: `T${RUN}`, subject_name: `${TEST_PREFIX}ซ้ำ` });
    warnIf(r.status === 201, "สร้างรหัสวิชาซ้ำได้ (ไม่มี unique constraint ที่ subject_code)");
    expect(r.status === 409, show(r));
  });
  await t("CR-level-7", "level: ชื่อซ้ำ", async () => {
    const r = await post(U.admin, "/api/admin/levelmanagement", { level_name: `${TEST_PREFIX}ระดับ-แก้` });
    warnIf(r.status === 201, "สร้างระดับชั้นชื่อซ้ำได้");
    expect(r.status === 409, show(r));
  });

  /* -------------------------------------------------------------- 6. ผู้ใช้ (admin) */
  section("6. จัดการผู้ใช้ (admin)");
  const tmpEmail = `e2e-${RUN}-tmp@example.com`;
  await t("US-01", "get-user มีบัญชีทดสอบ พร้อมอีเมล/บทบาท/ครู", async () => {
    const r = await get(U.admin, "/api/admin/usermanagement/get-user");
    expectStatus(r, 200);
    const a = r.json.users.find((x) => x.user_id === U.ta.id);
    expect(a && a.email === U.ta.email && a.is_teacher && a.subject_group_id === ids.group, JSON.stringify(a));
    return `ทั้งหมด ${r.json.users.length} คน`;
  });
  await t("US-02", "role-type คืน 5 บทบาท", async () => {
    const r = await get(U.admin, "/api/admin/role-type");
    expectStatus(r, 200);
    const list = r.json.items ?? r.json.roles ?? r.json;
    expect(Array.isArray(list) && list.length === 5, show(r));
  });
  await t("US-03", "create-user ข้อมูลไม่ครบ/ผิด → 422 (อีเมลผิด, รหัสสั้น, ไม่มีชื่อ, ไม่มีบทบาท, บทบาทไม่มีจริง)", async () => {
    const base = { email: tmpEmail, password: PW, name: `${TEST_PREFIX}tmp`, surname: RUN, role: [2] };
    for (const [k, v] of [["email", "bad"], ["password", "123"], ["name", ""], ["role", []], ["role", [99]]]) {
      const r = await post(U.admin, "/api/admin/usermanagement/create-user", { ...base, [k]: v });
      expect(r.status === 422, `${k}=${JSON.stringify(v)} → ${show(r)}`);
    }
  });
  await t("US-04", "create-user ถูกต้อง (ครู + เบอร์โทร) → 201", async () => {
    const r = await post(U.admin, "/api/admin/usermanagement/create-user", {
      email: tmpEmail, password: PW, prename: "นาง", name: `${TEST_PREFIX}tmp`, surname: RUN, role: [2], subject_group_id: ids.group, tel: "0899999" + String(Date.now()).slice(-3),
    });
    expectStatus(r, 201);
    U.tmp = { label: "tmp", id: r.json.user_id, email: tmpEmail };
  });
  await t("US-05", "create-user อีเมลซ้ำ → 400 และไม่เหลือข้อมูลค้าง", async () => {
    const r = await post(U.admin, "/api/admin/usermanagement/create-user", { email: tmpEmail, password: PW, name: `${TEST_PREFIX}dup`, surname: RUN, role: [2] });
    expect(r.status === 400, show(r));
    const left = await admin.from("users").select("user_id").eq("name", `${TEST_PREFIX}dup`);
    expect((left.data ?? []).length === 0, "มีแถว users ค้าง");
  });
  await t("US-06", "บัญชีที่สร้างใหม่ล็อกอินได้และมีบทบาท user", async () => {
    const l = await login(U.tmp);
    expect(l.ok, l.error);
    const r = await get(U.tmp, "/api/me");
    expect(r.json.roles.some((x) => x.name === "user"), show(r));
  });
  await t("US-07", "edit-user เปลี่ยนชื่อ+บทบาท [user,supervisor] → 200 และสิทธิ์มีผลทันที", async () => {
    const r = await put(U.admin, "/api/admin/usermanagement/edit-user", { user_id: U.tmp.id, prename: "นาง", name: `${TEST_PREFIX}tmp2`, surname: RUN, roles: [2, 3], is_teacher: true, subject_group_id: ids.group });
    expectStatus(r, 200);
    expectStatus(await get(U.tmp, "/api/supervisor/leave-review"), 200, "(บทบาทใหม่ยังใช้ไม่ได้)");
  });
  await t("US-08", "edit-user ถอดบทบาท supervisor → API ธุรการกลับเป็น 403 ทันที", async () => {
    expectStatus(await put(U.admin, "/api/admin/usermanagement/edit-user", { user_id: U.tmp.id, name: `${TEST_PREFIX}tmp2`, surname: RUN, roles: [2] }), 200);
    expectStatus(await get(U.tmp, "/api/supervisor/leave-review"), 403);
  });
  await t("US-09", "edit-user: user_id ไม่ใช่ uuid → 400, ไม่มีบทบาท → 422", async () => {
    expectStatus(await put(U.admin, "/api/admin/usermanagement/edit-user", { user_id: "x", name: "a", surname: "b", roles: [2] }), 400);
    expectStatus(await put(U.admin, "/api/admin/usermanagement/edit-user", { user_id: U.tmp.id, name: "a", surname: "b", roles: [] }), 422);
  });
  await t("US-10", "admin ถอดสิทธิ์ admin ของตัวเอง → 400", async () =>
    expectStatus(await put(U.admin, "/api/admin/usermanagement/edit-user", { user_id: U.admin.id, name: `${TEST_PREFIX}admin`, surname: RUN, roles: [2] }), 400)
  );
  await t("US-11", "admin ปิดใช้งาน/ลบตัวเอง → 400", async () => {
    expectStatus(await put(U.admin, "/api/admin/usermanagement/deactivate-user", { user_id: U.admin.id }), 400);
    expectStatus(await del(U.admin, "/api/admin/usermanagement/delete-user", { user_id: U.admin.id }), 400);
  });
  await t("US-12", "deactivate-user → session เดิมใช้ไม่ได้ (403) และล็อกอินใหม่ไม่ได้", async () => {
    expectStatus(await put(U.admin, "/api/admin/usermanagement/deactivate-user", { user_id: U.tmp.id }), 200);
    const r = await get(U.tmp, "/api/me");
    expect(r.status === 403 || r.status === 401, `session เดิม → ${show(r)}`);
    const l = await login({ ...U.tmp });
    expect(!l.ok, "ยังล็อกอินได้");
    return `session เดิม → ${r.status} ${r.json?.error}, ล็อกอินใหม่: ${l.error}`;
  });
  await t("US-13", "reactivate-user → ล็อกอินและใช้งานได้อีกครั้ง", async () => {
    expectStatus(await put(U.admin, "/api/admin/usermanagement/reactivate-user", { user_id: U.tmp.id }), 200);
    const l = await login(U.tmp);
    expect(l.ok, l.error);
    expectStatus(await get(U.tmp, "/api/me"), 200);
  });

  /* -------------------------------------------------------------- 7. ตารางสอน */
  section("7. ตารางสอน (admin)");
  const SCH = `/api/admin/schedule/table/${U.ta.id}`;
  await t("SC-01", "เพิ่ม 3 คาบ (จ คาบ1, จ คาบ2, อ คาบ1) → 201", async () => {
    const r = await post(U.admin, SCH, {
      rows: [
        { day_of_week: 1, period_number: 1, start_time: "08:00", end_time: "08:50", subject_id: ids.subject, classroom_id: ids.classroom },
        { day_of_week: 1, period_number: 2, start_time: "08:50", end_time: "09:40", subject_id: ids.subject, classroom_id: ids.classroom },
        { day_of_week: 2, period_number: 1, start_time: "08:00", end_time: "08:50", subject_id: ids.subject, classroom_id: ids.classroom },
      ],
    });
    expectStatus(r, 201);
    ids.ts = r.json.schedules.map((s) => s.teaching_schedule_id);
    expect(ids.ts.length === 3, show(r));
  });
  await t("SC-02", "เพิ่มคาบซ้ำวัน+คาบเดิม → 409 SLOT_TAKEN", async () =>
    expectStatus(await post(U.admin, SCH, { day_of_week: 1, period_number: 1 }), 409)
  );
  await t("SC-03", "ข้อมูลผิด: วันเสาร์ (6), คาบ 0, เวลาผิดรูปแบบ → 422", async () => {
    for (const b of [{ day_of_week: 6, period_number: 3 }, { day_of_week: 3, period_number: 0 }, { day_of_week: 3, period_number: 3, start_time: "8am" }]) {
      const r = await post(U.admin, SCH, b);
      expect(r.status === 422, `${JSON.stringify(b)} → ${show(r)}`);
    }
  });
  await t("SC-04", "GET ตารางสอน (admin และ academic) เรียงตามวัน/คาบ", async () => {
    for (const u of [U.admin, U.aca]) {
      const r = await get(u, SCH);
      expectStatus(r, 200);
      const s = r.json.schedules.map((x) => `${x.day_of_week}-${x.period_number}`).join(",");
      expect(s === "1-1,1-2,2-1", s);
    }
  });
  await t("SC-05", "GET ตารางของผู้ที่ไม่ใช่ครู → 404, uuid ผิด → 400", async () => {
    expectStatus(await get(U.admin, `/api/admin/schedule/table/${U.sup.id}`), 404);
    expectStatus(await get(U.admin, `/api/admin/schedule/table/not-uuid`), 400);
  });
  await t("SC-06", "PATCH แก้คาบ (เปลี่ยนเวลา) → 200; ย้ายไปชนคาบอื่น → 409", async () => {
    expectStatus(await patch(U.admin, `${SCH}?teaching_schedule_id=${ids.ts[1]}`, { day_of_week: 1, period_number: 2, start_time: "08:55", end_time: "09:45", subject_id: ids.subject, classroom_id: ids.classroom }), 200);
    expectStatus(await patch(U.admin, `${SCH}?teaching_schedule_id=${ids.ts[1]}`, { day_of_week: 1, period_number: 1 }), 409);
  });
  await t("SC-07", "PATCH/DELETE คาบของครูคนอื่นผ่าน URL ครูคนนี้ → 404/0 แถว", async () => {
    const r = await patch(U.admin, `/api/admin/schedule/table/${U.tb.id}?teaching_schedule_id=${ids.ts[0]}`, { day_of_week: 3, period_number: 5 });
    expect(r.status === 404, show(r));
    const d = await del(U.admin, `/api/admin/schedule/table/${U.tb.id}?teaching_schedule_id=${ids.ts[0]}`);
    expect(d.json?.deleted === 0, show(d));
  });
  await t("SC-08", "DELETE ไม่ระบุคาบและไม่ใส่ all=true → 400", async () => expectStatus(await del(U.admin, SCH), 400));
  await t("SC-10", "เพิ่มคาบโดยอ้างรายวิชาที่ไม่มีจริง → 4xx พร้อมข้อความที่ถูกต้อง", async () => {
    const r = await post(U.admin, SCH, { day_of_week: 4, period_number: 6, subject_id: 99999999 });
    expect(r.status >= 400 && r.status < 500, show(r));
    expect(!String(r.json?.detail ?? "").includes("ลบไม่ได้"), `ข้อความผิดบริบท: ${show(r)}`);
  });
  await t("SC-09", "GET /api/admin/schedule/teacher มีครูทดสอบ", async () => {
    const r = await get(U.aca, "/api/admin/schedule/teacher");
    expectStatus(r, 200);
    expect(JSON.stringify(r.json).includes(U.ta.id), "ไม่พบครูทดสอบ");
  });

  /* -------------------------------------------------------------- 8. ผู้ใช้ยื่นใบลา */
  section("8. ยื่นใบลา (user)");
  const submit = (u, fields, files) => post(u, "/api/user/leave-request", leaveForm(fields, files));
  const base1 = { leave_type_id: 1, date_start: "2026-11-16", date_end: "2026-11-17", date_start_type: "เต็มวัน", date_end_type: "เต็มวัน", reason: `${TEST_PREFIX}ป่วย` };

  await t("LV-01", "ส่งเป็น JSON (ไม่ใช่ multipart) → 400 CONTENT_TYPE", async () => expectStatus(await post(U.ta, "/api/user/leave-request", base1), 400));
  await t("LV-02", "ขาดฟิลด์ (ไม่มีประเภทลา) → 422", async () => expectStatus(await submit(U.ta, { ...base1, leave_type_id: undefined }), 422));
  await t("LV-03", "วันที่ไม่มีจริง (2026-02-30) → 422 INVALID_DATE", async () => expectStatus(await submit(U.ta, { ...base1, date_start: "2026-02-30", date_end: "2026-03-02" }), 422));
  await t("LV-04", "วันสิ้นสุดก่อนวันเริ่ม → 422", async () => expectStatus(await submit(U.ta, { ...base1, date_start: "2026-11-17", date_end: "2026-11-16" }), 422));
  await t("LV-05", "ข้ามปีงบ (28 ก.ย.–2 ต.ค. 2026) → 400 LEAVE_CROSSES_FISCAL_YEAR", async () => expectStatus(await submit(U.ta, { ...base1, date_start: "2026-09-28", date_end: "2026-10-02" }), 400));
  await t("LV-06", "ลาเฉพาะเสาร์-อาทิตย์ → 422 NO_WORKING_DAYS", async () => expectStatus(await submit(U.ta, { ...base1, date_start: "2026-11-21", date_end: "2026-11-22" }), 422));
  await t("LV-07", "ไม่มีเหตุผล → 422", async () => expectStatus(await submit(U.ta, { ...base1, reason: "" }), 422));
  await t("LV-08", "ประเภทลาไม่มีจริง (999) → 404", async () => expectStatus(await submit(U.ta, { ...base1, leave_type_id: 999 }), 404));
  await t("LV-09", "ไฟล์ชนิดไม่อนุญาต (.txt) → 422 และไม่มีใบลาค้าง", async () => {
    const before = (await admin.from("leaverequest").select("leave_request_id").eq("user_id", U.ta.id)).data.length;
    const r = await submit(U.ta, base1, [[new Blob(["hello"], { type: "text/plain" }), "a.txt"]]);
    expectStatus(r, 422);
    const after = (await admin.from("leaverequest").select("leave_request_id").eq("user_id", U.ta.id)).data.length;
    expect(before === after, `ใบลาค้าง ${after - before} ใบ`);
  });
  await t("LV-10", "ไฟล์เกิน 5MB → 422", async () => {
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 10)], { type: "application/pdf" });
    const r = await submit(U.ta, base1, [[big, "big.pdf"]]);
    expect(r.status === 422 || r.status === 413, show(r));
  });
  await t("LV-11", "ลาพักผ่อนเกินสิทธิ์ (30 วันทำการ) → 400 INSUFFICIENT_QUOTA", async () =>
    expectStatus(await submit(U.ta, { ...base1, leave_type_id: 3, date_start: "2027-01-04", date_end: "2027-02-12" }), 400)
  );
  await t("LV-12", "ยื่นถูกต้อง 2 วัน + ไฟล์ PDF แต่ปลอม total_day=0.5 → 201 และ server คิด 2 วัน", async () => {
    const r = await submit(U.ta, { ...base1, total_day: 0.5 }, [[pdfBlob(), "ใบรับรองแพทย์.pdf"]]);
    expectStatus(r, 201);
    ids.L1 = r.json.id;
    expect(r.json.total_day === 2 && r.json.year === 2027, show(r));
    return `id=${ids.L1}`;
  });
  await t("LV-13", "ยื่นซ้ำช่วงวันที่ทับใบเดิม (16–17 พ.ย.) → ควรถูกปฏิเสธ", async () => {
    const r = await submit(U.ta, base1);
    if (r.status === 201) {
      ids.Ldup = r.json.id;
      throw new Fail(`ระบบรับใบลาทับซ้อนวันเดิม (id=${ids.Ldup}) — ไม่มีการตรวจวันลาซ้อน`);
    }
    expect(r.status === 409 || r.status === 400, show(r));
  });
  await t("LV-14", "ลาครึ่งวันเช้า 1 วัน (19 พ.ย.) → total_day 0.5", async () => {
    const r = await submit(U.ta, { ...base1, date_start: "2026-11-19", date_end: "2026-11-19", date_start_type: "ครึ่งเช้า" });
    expectStatus(r, 201);
    ids.L2 = r.json.id;
    expect(r.json.total_day === 0.5, show(r));
  });
  await t("LV-15", "วันหยุดสถานศึกษา (admin เพิ่ม 25 พ.ย.) ถูกตัดออก: ลา 23–27 พ.ย. = 4 วัน", async () => {
    const h = await post(U.admin, "/api/admin/holiday", { holiday_name: `${TEST_PREFIX}หยุดโรงเรียน`, holiday_date: "2026-11-25" });
    expectStatus(h, 201);
    ids.holiday2 = h.json.item.holiday_id;
    const r = await submit(U.ta, { ...base1, date_start: "2026-11-23", date_end: "2026-11-27" }, [[pdfBlob(), "ใบรับรองแพทย์.pdf"]]);
    expectStatus(r, 201);
    ids.L3 = r.json.id;
    expect(r.json.total_day === 4, show(r));
  });
  await t("LV-17", "ลาครึ่งเช้า + ครึ่งบ่ายวันเดียวกัน (2 ใบ) ได้ แต่ใบเต็มวันวันนั้น → 409 OVERLAPPING_LEAVE", async () => {
    const day = { ...base1, date_start: "2026-11-26", date_end: "2026-11-26" };
    expectStatus(await submit(U.tb, { ...day, date_start_type: "ครึ่งเช้า" }), 201);
    expectStatus(await submit(U.tb, { ...day, date_start_type: "ครึ่งบ่าย" }), 201);
    const r = await submit(U.tb, day);
    expect(r.status === 409 && r.json.error === "OVERLAPPING_LEAVE", show(r));
  });
  await t("LV-18", "ลาครึ่งเช้าวันเดียวกันซ้ำ → 409", async () => {
    const r = await submit(U.tb, { ...base1, date_start: "2026-11-26", date_end: "2026-11-26", date_start_type: "ครึ่งเช้า" });
    expectStatus(r, 409);
  });
  await t("LV-16", "ลาในอดีต (เดือนที่แล้ว) — ระบบยอมรับหรือไม่", async () => {
    const r = await submit(U.tb, { ...base1, date_start: "2026-09-01", date_end: "2026-09-01" });
    if (r.status === 201) {
      ids.Lpast = r.json.id;
      return "ยอมรับ (ปกติสำหรับลาป่วยย้อนหลัง)";
    }
    return `ปฏิเสธ ${r.status}`;
  });

  /* -------------------------------------------------------------- 9. ผู้ใช้ดู/แก้/ลบ */
  section("9. ประวัติ / โควตา / แก้ไข / ลบ (user)");
  await t("UH-01", "leave-history มีใบลา พร้อมไฟล์แนบ (signed URL)", async () => {
    const r = await get(U.ta, "/api/user/leave-history?pageSize=50");
    expectStatus(r, 200);
    const row = r.json.data.find((x) => String(x.id ?? x.leave_request_id) === String(ids.L1));
    expect(row, "ไม่พบใบลา");
    const files = row.files ?? [];
    expect(files.length === 1 && /^https?:\/\//.test(files[0].url), JSON.stringify(files));
    ids.fileUrl = files[0].url;
    return `total=${r.json.total}`;
  });
  await t("UH-02", "signed URL ของไฟล์แนบดาวน์โหลดได้จริง", async () => {
    const r = await fetch(ids.fileUrl);
    expect(r.status === 200, `HTTP ${r.status}`);
  });
  await t("UH-03", "ตัวกรอง status=pending / leaveTypeId / q / แบ่งหน้า pageSize=1", async () => {
    const a = await get(U.ta, "/api/user/leave-history?status=pending&leaveTypeId=1&pageSize=1&page=1");
    expectStatus(a, 200);
    expect(a.json.data.length === 1 && a.json.totalPages >= 3, `len=${a.json.data.length} totalPages=${a.json.totalPages}`);
    const b = await get(U.ta, "/api/user/leave-history?status=approved");
    expect(b.json.data.length === 0, "status=approved ควรว่าง");
  });
  await t("UH-04", "คำค้น q ที่มีอักขระพิเศษ (a,b),or(...)%_) ไม่ทำให้ 500", async () => {
    const r = await get(U.ta, `/api/user/leave-history?q=${encodeURIComponent("a,b),or(user_id.neq.0)%_")}`);
    expectStatus(r, 200);
  });
  await t("UH-05", "leave-history/[id] ของตัวเอง → 200; ของคนอื่น → 404; id ผิด → 400", async () => {
    expectStatus(await get(U.ta, `/api/user/leave-history/${ids.L1}`), 200);
    expectStatus(await get(U.tb, `/api/user/leave-history/${ids.L1}`), 404);
    expectStatus(await get(U.ta, `/api/user/leave-history/abc`), 400);
  });
  await t("UH-06", "quota: ลาป่วย reserved = ผลรวม total_day ของใบ pending ในฐานข้อมูล", async () => {
    const r = await get(U.ta, "/api/user/leave-quota");
    expectStatus(r, 200);
    const s = r.json.items.find((i) => i.leave_type_id === 1);
    const { data } = await admin.from("leaverequest").select("total_day").eq("user_id", U.ta.id).eq("leave_type_id", 1).in("status", ["pending", "reviewed"]).gte("date_start", "2026-10-01");
    const exp = data.reduce((n, x) => n + Number(x.total_day), 0);
    expect(s.reserved === exp && s.used === 0, `คาด ${exp} ได้ ${JSON.stringify(s)}`);
    return `year=${r.json.year} ลาป่วย total=${s.total} reserved=${s.reserved} available=${s.available}`;
  });
  await t("UH-07", "quota?year=2570 (พ.ศ.) = ปีงบ 2027", async () => {
    const r = await get(U.ta, "/api/user/leave-quota?year=2570");
    expect(r.json.year === 2027, show(r));
  });
  await t("UH-08", "quota?leaveTypeId=1 → item; ไม่มี leaveTypeId → 400; 999 → 404", async () => {
    const r = await get(U.ta, "/api/user/quota?leaveTypeId=1");
    expect(r.status === 200 && r.json.item.leave_type_id === 1, show(r));
    expectStatus(await get(U.ta, "/api/user/quota"), 400);
    expectStatus(await get(U.ta, "/api/user/quota?leaveTypeId=999"), 404);
  });
  await t("UH-09", "dashboard-user ?year=2026&month=11 และ ?fy=2027&fmonth=2 (พ.ย.) มีใบลา", async () => {
    const a = await get(U.ta, "/api/user/dashboard-user?year=2026&month=11");
    const b = await get(U.ta, "/api/user/dashboard-user?fy=2027&fmonth=2");
    const c = await get(U.ta, "/api/user/dashboard-user?year=2026&month=12");
    expect(a.json.data.length >= 3 && b.json.data.length === a.json.data.length, `month=${a.json.data.length} fmonth=${b.json.data.length}`);
    expect(c.json.data.length === 0, `ธ.ค. ควรว่าง ได้ ${c.json.data.length}`);
  });
  await t("UH-10", "PATCH แก้เหตุผล (JSON) → 200", async () => expectStatus(await patch(U.ta, `/api/user/leave-history/${ids.L1}`, { reason: `${TEST_PREFIX}ป่วย (แก้)` }), 200));
  await t("UH-11", "PATCH ขยายวันลา 16–18 พ.ย. → total_day คำนวณใหม่ = 3", async () => {
    expectStatus(await patch(U.ta, `/api/user/leave-history/${ids.L1}`, { date_end: "2026-11-18" }), 200);
    const row = (await admin.from("leaverequest").select("total_day, date_end").eq("leave_request_id", ids.L1).single()).data;
    expect(Number(row.total_day) === 3 && row.date_end === "2026-11-18", JSON.stringify(row));
  });
  await t("UH-12", "PATCH แนบไฟล์ใหม่ (multipart) → ไฟล์เก่าถูกลบจาก Storage", async () => {
    const before = (await admin.from("leaverequest").select("file").eq("leave_request_id", ids.L1).single()).data.file;
    const r = await patch(U.ta, `/api/user/leave-history/${ids.L1}`, leaveForm({ reason: `${TEST_PREFIX}ป่วย (แก้2)` }, [[pdfBlob(), "ใหม่.pdf"]]));
    expectStatus(r, 200);
    const oldKey = JSON.parse(before)[0];
    const { data } = await admin.storage.from("leave-attachments").list(`public/${U.ta.id}`);
    expect(!data.some((f) => oldKey.endsWith(f.name)), "ไฟล์เก่ายังอยู่");
    return `ไฟล์ใน storage ตอนนี้ ${data.length}`;
  });
  await t("UH-17", "PATCH เลื่อนวันให้ทับใบอื่นของตัวเอง → 409 OVERLAPPING_LEAVE", async () => {
    const r = await patch(U.ta, `/api/user/leave-history/${ids.L2}`, { date_start: "2026-11-18", date_end: "2026-11-19" });
    expect(r.status === 409 && r.json.error === "OVERLAPPING_LEAVE", show(r));
  });
  await t("UH-13", "คนอื่นแก้/ลบใบลาของเรา → 404", async () => {
    expectStatus(await patch(U.tb, `/api/user/leave-history/${ids.L1}`, { reason: "hack" }), 404);
    expectStatus(await del(U.tb, `/api/user/leave-history/${ids.L1}`), 404);
  });
  await t("UH-14", "PATCH ทำให้ข้ามปีงบ → 400", async () => expectStatus(await patch(U.ta, `/api/user/leave-history/${ids.L1}`, { date_start: "2026-09-30" }), 400));
  if (ids.Ldup) {
    await t("UH-15", "ลบใบลาสถานะ pending ของตัวเอง → 200 และ reserved ลดลง", async () => {
      expectStatus(await del(U.ta, `/api/user/leave-history/${ids.Ldup}`), 200);
      const s = (await get(U.ta, "/api/user/leave-quota")).json.items.find((i) => i.leave_type_id === 1);
      expect(s.reserved === 7.5, `reserved=${s.reserved}`); // 3 + 0.5 + 4
      ids.Ldup = null;
    });
  }
  await t("UH-16", "snapshot userleavequota ตรงกับที่คำนวณ (ลาป่วย reserved 7.5)", async () => {
    const { data } = await admin.from("userleavequota").select("reserved, total_used, total_remaining, year").eq("user_id", U.ta.id).eq("leave_type_id", 1);
    expect(data.length === 1 && Number(data[0].reserved) === 7.5 && Number(data[0].total_used) === 0, JSON.stringify(data));
  });

  /* -------------------------------------------------------------- 10. ธุรการ */
  section("10. ธุรการตรวจสอบ (supervisor)");
  await t("SV-01", "คิวรอตรวจมีใบลาทดสอบ พร้อมชื่อ/อีเมล/ไฟล์", async () => {
    const r = await get(U.sup, `/api/supervisor/leave-review?q=${encodeURIComponent(TEST_PREFIX + "teacherA")}&pageSize=50`);
    expectStatus(r, 200);
    const row = r.json.data.find((x) => String(x.id ?? x.leave_request_id) === String(ids.L1));
    expect(row, `ไม่พบ (total=${r.json.total})`);
    return `fields: ${Object.keys(row).join(",")}`;
  });
  await t("SV-02", "ค้นหาด้วยอีเมลผู้ยื่น", async () => {
    const r = await get(U.sup, `/api/supervisor/leave-review?q=${encodeURIComponent(U.ta.email)}`);
    expect(r.json.data.some((x) => String(x.id ?? x.leave_request_id) === String(ids.L1)), `total=${r.json.total}`);
  });
  await t("SV-03", "action ผิด / ไม่มี id → 400", async () => {
    expectStatus(await post(U.sup, "/api/supervisor/leave-review", { action: "approve", payload: { id: ids.L1 } }), 400);
    expectStatus(await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: {} }), 400);
  });
  await t("SV-04", "ตีกลับ (fail) ใบครึ่งวัน พร้อมหมายเหตุ → failed", async () => {
    const r = await post(U.sup, "/api/supervisor/leave-review", { action: "fail", payload: { id: ids.L2, note: "แนบใบรับรองแพทย์" } });
    expect(r.status === 200 && r.json.status === "failed", show(r));
  });
  await t("SV-05", "ใบที่ failed ไม่นับเป็น reserved", async () => {
    const s = (await get(U.ta, "/api/user/leave-quota")).json.items.find((i) => i.leave_type_id === 1);
    expect(s.reserved === 7, `reserved=${s.reserved}`);
  });
  await t("SV-06", "ผู้ยื่นแก้ใบที่ failed → กลับเป็น pending และล้างหมายเหตุ", async () => {
    expectStatus(await patch(U.ta, `/api/user/leave-history/${ids.L2}`, { reason: `${TEST_PREFIX}แนบแล้ว` }), 200);
    const row = (await admin.from("leaverequest").select("status, comment, reviewed_by").eq("leave_request_id", ids.L2).single()).data;
    expect(row.status === "pending" && row.comment === null && row.reviewed_by === null, JSON.stringify(row));
  });
  await t("SV-07", "ตรวจผ่านพร้อมกัน 2 คำขอ (race) → สำเร็จ 1, 409 อีก 1", async () => {
    const body = { action: "reviewed", payload: { id: ids.L2, note: "" } };
    const [a, b] = await Promise.all([post(U.sup, "/api/supervisor/leave-review", body), post(U.multi, "/api/supervisor/leave-review", body)]);
    const codes = [a.status, b.status].sort().join(",");
    expect(codes === "200,409", codes);
  });
  await t("SV-08", "ตรวจผ่านใบหลัก (มีหมายเหตุ) → reviewed; ตรวจซ้ำ → 409", async () => {
    const r = await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: ids.L1, note: "เอกสารครบ" } });
    expect(r.status === 200 && r.json.status === "reviewed", show(r));
    expectStatus(await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: ids.L1 } }), 409);
  });
  await t("SV-09", "ตรวจใบที่ไม่มีอยู่ → 404", async () => expectStatus(await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: 99999999 } }), 404));
  await t("SV-10", "ผู้ยื่นแก้/ลบใบที่ reviewed แล้ว → 400", async () => {
    expectStatus(await patch(U.ta, `/api/user/leave-history/${ids.L1}`, { reason: "x" }), 400);
    expectStatus(await del(U.ta, `/api/user/leave-history/${ids.L1}`), 400);
  });
  await t("SV-11", "ตรวจใบ L3 (มีวันหยุดโรงเรียน) → reviewed", async () => expectStatus(await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: ids.L3 } }), 200));
  await t("SV-12", "reviewed-history ของธุรการมีใบที่ตนตรวจ", async () => {
    const r = await get(U.sup, "/api/supervisor/reviewed-history?pageSize=50");
    expectStatus(r, 200);
    const got = r.json.data.map((x) => Number(x.id ?? x.leave_request_id));
    expect(got.includes(ids.L1) && got.includes(ids.L3), `ได้ ${got.length} แถว`);
  });

  /* -------------------------------------------------------------- 11. ผอ. */
  section("11. ผู้อำนวยการ (director)");
  await t("DR-01", "คิวรออนุมัติมีใบที่ธุรการตรวจแล้ว", async () => {
    const r = await get(U.dir, "/api/director/leave-approve?pageSize=200");
    const got = r.json.data.map((x) => Number(x.id ?? x.leave_request_id));
    expect(got.includes(ids.L1) && got.includes(ids.L2) && got.includes(ids.L3), `ได้ ${got.length}`);
  });
  await t("DR-02", "อนุมัติใบหลัก โดยไม่ใส่หมายเหตุ → approved", async () => {
    const r = await post(U.dir, "/api/director/leave-approve", { action: "approved", payload: { id: ids.L1 } });
    expect(r.status === 200 && r.json.status === "approved" && r.json.year === 2027, show(r));
  });
  await t("DR-03", "หมายเหตุของธุรการ ('เอกสารครบ') ยังอยู่หลัง ผอ.อนุมัติโดยไม่ใส่หมายเหตุ", async () => {
    const row = (await admin.from("leaverequest").select("comment").eq("leave_request_id", ids.L1).single()).data;
    expect(row.comment === "เอกสารครบ", `comment=${JSON.stringify(row.comment)} — หมายเหตุของธุรการถูกเขียนทับ`);
  });
  await t("DR-04", "อนุมัติซ้ำ → 409; อนุมัติใบ pending โดยตรง → 409", async () => {
    expectStatus(await post(U.dir, "/api/director/leave-approve", { action: "approved", payload: { id: ids.L1 } }), 409);
    if (ids.Lpast) expectStatus(await post(U.dir, "/api/director/leave-approve", { action: "approved", payload: { id: ids.Lpast } }), 409);
  });
  await t("DR-05", "ไม่อนุมัติใบครึ่งวัน → rejected และไม่นับในโควตา", async () => {
    const r = await post(U.dir, "/api/director/leave-approve", { action: "rejected", payload: { id: ids.L2, note: "ทดสอบ" } });
    expect(r.json?.status === "rejected", show(r));
    const s = (await get(U.ta, "/api/user/leave-quota")).json.items.find((i) => i.leave_type_id === 1);
    expect(s.used === 3 && s.reserved === 4, `used=${s.used} reserved=${s.reserved}`);
  });
  await t("DR-06", "ผอ.ลบใบที่ reviewed (L3) → 200 และใบหายจากโควตา", async () => {
    expectStatus(await del(U.dir, `/api/director/leave-approve/${ids.L3}`), 200);
    const s = (await get(U.ta, "/api/user/leave-quota")).json.items.find((i) => i.leave_type_id === 1);
    expect(s.reserved === 0, `reserved=${s.reserved}`);
  });
  await t("DR-07", "ผอ.ลบใบที่ approved → 409", async () => expectStatus(await del(U.dir, `/api/director/leave-approve/${ids.L1}`), 409));
  await t("DR-08", "employees มีบุคลากรทดสอบ (เฉพาะที่ active)", async () => {
    const r = await get(U.dir, "/api/director/employees");
    expect(r.json.items.some((x) => x.user_id === U.tb.id && x.email === U.tb.email), "ไม่พบ teacherB");
  });
  await t("DR-09", "create-leave ด้วย user_id (teacherB 17 พ.ย.) → 201 approved ทันที", async () => {
    const r = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: 2, date_start: "2026-11-17", date_end: "2026-11-17", reason: `${TEST_PREFIX}ธุระ` });
    expectStatus(r, 201);
    ids.LB = r.json.id;
    const row = (await admin.from("leaverequest").select("status, approved_by").eq("leave_request_id", ids.LB).single()).data;
    expect(row.status === "approved" && row.approved_by === U.dir.id, JSON.stringify(row));
  });
  await t("DR-10", "create-leave ด้วยอีเมล → 201; อีเมลไม่มี → 404; ไม่ระบุใคร → 400", async () => {
    const r = await post(U.dir, "/api/director/create-leave", { employeeEmail: U.tb.email.toUpperCase(), leave_type_id: 1, date_start: "2026-12-14", date_end: "2026-12-14" });
    expectStatus(r, 201);
    expectStatus(await post(U.dir, "/api/director/create-leave", { employeeEmail: "nobody-e2e@example.com", leave_type_id: 1, date_start: "2026-12-14", date_end: "2026-12-14" }), 404);
    expectStatus(await post(U.dir, "/api/director/create-leave", { leave_type_id: 1, date_start: "2026-12-14", date_end: "2026-12-14" }), 400);
  });
  await t("DR-11", "create-leave user_id เป็น uuid ที่ไม่มีในระบบ → ควร 404 (ไม่ใช่ 500)", async () => {
    const r = await post(U.dir, "/api/director/create-leave", { user_id: "00000000-0000-4000-8000-000000000000", leave_type_id: 1, date_start: "2026-12-15", date_end: "2026-12-15" });
    expect(r.status === 404 || r.status === 400, show(r));
  });
  await t("DR-12", "create-leave เกินโควตา (ลาพักผ่อน 30 วันทำการ) → 400", async () => {
    const r = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: 3, date_start: "2027-01-04", date_end: "2027-02-12" });
    expectStatus(r, 400);
  });
  await t("DR-13", "create-leave ให้บุคลากรที่ถูกปิดใช้งาน → ควรถูกปฏิเสธ", async () => {
    await put(U.admin, "/api/admin/usermanagement/deactivate-user", { user_id: U.tmp.id });
    const r = await post(U.dir, "/api/director/create-leave", { user_id: U.tmp.id, leave_type_id: 1, date_start: "2026-12-16", date_end: "2026-12-16" });
    await put(U.admin, "/api/admin/usermanagement/reactivate-user", { user_id: U.tmp.id });
    if (r.status === 201) throw new Warn("ระบบสร้างใบลาให้บัญชีที่ปิดใช้งานได้");
    expect(r.status >= 400 && r.status < 500, show(r));
  });
  await t("DR-14", "approved-history ของ ผอ. มีใบที่ตนอนุมัติ/สร้าง", async () => {
    const r = await get(U.dir, "/api/director/approved-history?pageSize=100");
    const got = r.json.data.map((x) => Number(x.id ?? x.leave_request_id));
    expect(got.includes(ids.L1) && got.includes(ids.LB), `ได้ ${got.length}`);
  });
  await t("DR-15", "employee-quota ของ teacherB: ลากิจ used=1; uuid ผิด → 400", async () => {
    const r = await get(U.dir, `/api/director/employee-quota?userId=${U.tb.id}`);
    const s = r.json.items.find((i) => i.leave_type_id === 2);
    expect(s.used === 1, JSON.stringify(s));
    expectStatus(await get(U.dir, "/api/director/employee-quota?userId=x"), 400);
  });
  await t("DR-16", "dashboard-data ทุกโหมด (all, fy, calendar, month, mine) → 200", async () => {
    const out = [];
    for (const q of ["mode=all", "mode=fy&year=2027", "mode=calendar&year=2026", "mode=month&year=2026&month=11", "mine=1", `userId=${U.ta.id}`, "status=rejected"]) {
      const r = await get(U.dir, `/api/director/dashboard-data?${q}`);
      expect(r.status === 200, `${q} → ${show(r)}`);
      out.push(`${q}:${r.ms.toFixed(0)}ms`);
    }
    return out.join(" ");
  });

  /* -------------------------------------------------------------- 12. ผู้ใช้หลายบทบาท ตรวจ/อนุมัติใบของตัวเอง */
  section("12. ผู้ใช้หลายบทบาท (ตรวจ/อนุมัติใบของตัวเอง)");
  await t("MR-01", "ผู้ใช้ที่เป็นทั้ง user+ธุรการ ตรวจใบลาของตัวเองได้หรือไม่", async () => {
    const r = await submit(U.multi, { ...base1, date_start: "2026-11-30", date_end: "2026-11-30" });
    expectStatus(r, 201);
    ids.LM = r.json.id;
    const rv = await post(U.multi, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: ids.LM } });
    warnIf(rv.status === 200, "ตรวจใบลาของตัวเองได้ (ไม่มีการกันผู้ตรวจ = ผู้ยื่น)");
    expect(rv.status === 403 || rv.status === 400, show(rv));
  });
  await t("MR-02", "ผู้ใช้ที่เป็นทั้ง user+ผอ. อนุมัติใบลาของตัวเองได้หรือไม่", async () => {
    const st = (await admin.from("leaverequest").select("status").eq("leave_request_id", ids.LM).single()).data.status;
    if (st !== "reviewed") await post(U.sup, "/api/supervisor/leave-review", { action: "reviewed", payload: { id: ids.LM } });
    const r = await post(U.multi, "/api/director/leave-approve", { action: "approved", payload: { id: ids.LM } });
    warnIf(r.status === 200, "อนุมัติใบลาของตัวเองได้");
    expect(r.status === 403 || r.status === 400, show(r));
  });

  /* -------------------------------------------------------------- 13. ฝ่ายวิชาการ */
  section("13. ฝ่ายวิชาการ — จัดสอนแทน (academic)");
  await t("AC-01", "รายการลาที่อนุมัติแล้วของครู มีใบหลัก; ไม่มีใบของผู้ที่ไม่ใช่ครู (multi)", async () => {
    const r = await get(U.aca, "/api/academic/leaves?pageSize=100");
    expectStatus(r, 200);
    const got = r.json.data.map((x) => Number(x.id ?? x.leave_request_id));
    expect(got.includes(ids.L1), "ไม่พบใบหลัก");
    expect(!got.includes(ids.LM), "มีใบของผู้ที่ไม่ใช่ครู");
  });
  await t("AC-02", "รายละเอียดใบลา: ตาราง 16–18 พ.ย. ต้องสอนแทน 3 คาบ (จ 2, อ 1, พ 0)", async () => {
    const r = await get(U.aca, `/api/academic/leaves/${ids.L1}`);
    expectStatus(r, 200);
    const per = r.json.schedule.map((d) => `${d.date.slice(8)}:${d.slots.length}`).join(" ");
    expect(r.json.isTeacher && r.json.progress.required === 3 && r.json.progress.assigned === 0, `${per} ${JSON.stringify(r.json.progress)}`);
    return per;
  });
  await t("AC-03", "ปิดงาน (complete) ก่อนจัดครบ → 409 NOT_COMPLETE พร้อมรายการที่ขาด", async () => {
    const r = await patch(U.aca, `/api/academic/leaves/${ids.L1}/complete`);
    expect(r.status === 409 && r.json.detail?.missing?.length === 3, show(r));
  });
  await t("AC-04", "free-teachers จ 16 พ.ย. คาบ 1: teacherB อยู่กลุ่มเดียวกัน, ไม่มี teacherA", async () => {
    const r = await get(U.aca, `/api/academic/free-teachers?date=2026-11-16&period=1&excludeUserId=${U.ta.id}`);
    expectStatus(r, 200);
    expect(r.json.data1.some((x) => x.user_id === U.tb.id), "teacherB ไม่อยู่ใน data1");
    expect(![...r.json.data1, ...r.json.data2].some((x) => x.user_id === U.ta.id), "teacherA อยู่ในรายการ");
    return `กลุ่มเดียวกัน ${r.json.data1Count}, กลุ่มอื่น ${r.json.data2Count}`;
  });
  await t("AC-05", "free-teachers พารามิเตอร์ผิด (วันที่ผิด, คาบ 0) → 400; วันเสาร์ → รายการว่าง", async () => {
    expectStatus(await get(U.aca, "/api/academic/free-teachers?date=2026-02-30&period=1"), 400);
    expectStatus(await get(U.aca, "/api/academic/free-teachers?date=2026-11-16&period=0"), 400);
    const r = await get(U.aca, "/api/academic/free-teachers?date=2026-11-21&period=1");
    expect(r.json.data1Count + r.json.data2Count === 0, show(r));
  });
  await t("AC-06", "มอบหมาย teacherB สอนแทน จ คาบ 1 → 201", async () => {
    const r = await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[0], dateISO: "2026-11-16", substituteUserId: U.tb.id });
    expectStatus(r, 201);
  });
  await t("AC-07", "มอบหมายซ้ำคาบเดิม → 409 ALREADY_ASSIGNED (หรือ SUBSTITUTE_NOT_FREE)", async () => {
    const r = await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[0], dateISO: "2026-11-16", substituteUserId: U.tb.id });
    expect(r.status === 409, show(r));
    return r.json.error;
  });
  await t("AC-08", "หลังมอบหมาย teacherB ไม่ว่างใน จ คาบ 1 แล้ว", async () => {
    const r = await get(U.aca, `/api/academic/free-teachers?date=2026-11-16&period=1&excludeUserId=${U.ta.id}`);
    expect(![...r.json.data1, ...r.json.data2].some((x) => x.user_id === U.tb.id), "teacherB ยังว่าง");
  });
  await t("AC-09", "ข้อผิดพลาด: สอนแทนตัวเอง → 400, วันไม่ตรงตาราง → 400, payload ผิด → 400, คาบไม่มี → 404", async () => {
    expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[1], dateISO: "2026-11-16", substituteUserId: U.ta.id }), 400);
    expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[1], dateISO: "2026-11-17", substituteUserId: U.tb.id }), 400);
    expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: "x", dateISO: "2026-11-16", substituteUserId: "y" }), 400);
    expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: 99999999, dateISO: "2026-11-16", substituteUserId: U.tb.id }), 404);
  });
  await t("AC-10", "teacherB ลาวันที่ 17 พ.ย. (อนุมัติแล้ว) — ไม่ควรถูกเสนอเป็นครูว่าง", async () => {
    const r = await get(U.aca, `/api/academic/free-teachers?date=2026-11-17&period=1&excludeUserId=${U.ta.id}`);
    if ([...r.json.data1, ...r.json.data2].some((x) => x.user_id === U.tb.id)) throw new Fail("ครูที่ลาในวันนั้นยังถูกแสดงเป็นครูว่าง");
  });
  await t("AC-11", "มอบหมายครูที่ลาวันนั้น (teacherB 17 พ.ย.) — ไม่ควรทำได้", async () => {
    const r = await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[2], dateISO: "2026-11-17", substituteUserId: U.tb.id });
    if (r.status === 201) {
      ids.subOnLeave = true;
      throw new Fail("มอบหมายครูที่ลาอยู่ให้สอนแทนได้");
    }
    expect(r.status === 409, show(r));
  });
  await t("AC-12", "มอบหมายสอนแทนในวันที่ครูเจ้าของคาบไม่ได้ลา (จ 23 พ.ย.) — ไม่ควรทำได้", async () => {
    const r = await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[0], dateISO: "2026-11-23", substituteUserId: U.tmp.id });
    if (r.status === 201) throw new Fail("มอบหมายสอนแทนได้แม้ไม่มีใบลาอนุมัติในวันนั้น");
    expect(r.status >= 400, show(r));
  });
  await t("AC-13", "มอบหมายคาบที่เหลือให้ครบ แล้ว complete → 200 covered", async () => {
    expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[1], dateISO: "2026-11-16", substituteUserId: U.tb.id }), 201);
    if (!ids.subOnLeave) {
      expectStatus(await post(U.aca, "/api/academic/substitutions", { teachingScheduleId: ids.ts[2], dateISO: "2026-11-17", substituteUserId: U.tmp.id }), 201);
    }
    const r = await patch(U.aca, `/api/academic/leaves/${ids.L1}/complete`);
    expect(r.status === 200 && r.json.status === "covered", show(r));
  });
  await t("AC-14", "complete ซ้ำ → 409; complete ใบของผู้ไม่ใช่ครู → 400 NOT_TEACHER", async () => {
    expectStatus(await patch(U.aca, `/api/academic/leaves/${ids.L1}/complete`), 409);
    const r = await patch(U.aca, `/api/academic/leaves/${ids.LM}/complete`);
    expect(r.status === 400, show(r));
  });
  await t("AC-15", "ใบ covered ยังนับเป็น used ในโควตา (3 วัน)", async () => {
    const s = (await get(U.ta, "/api/user/leave-quota")).json.items.find((i) => i.leave_type_id === 1);
    expect(s.used === 3, JSON.stringify(s));
  });
  await t("AC-16", "substitution-history ?leaveId= → 3 รายการ; ?from&to&teacherUserId → ; วันที่ผิด → 400", async () => {
    const a = await get(U.aca, `/api/academic/substitution-history?leaveId=${ids.L1}`);
    expect(a.status === 200 && a.json.total === 3, show(a));
    const b = await get(U.aca, `/api/academic/substitution-history?from=2026-11-16&to=2026-11-18&teacherUserId=${U.ta.id}`);
    expect(b.json.total === 3, show(b));
    expectStatus(await get(U.aca, "/api/academic/substitution-history?from=bad&to=2026-11-18"), 400);
    return a.json.items.map((i) => `${i.date} คาบ${i.period} ${i.substitute}`).join(" | ");
  });
  await t("AC-17", "ลาครึ่งบ่าย: ไม่ควรต้องจัดสอนแทนคาบเช้า", async () => {
    // ผอ.สร้างลาครึ่งบ่ายให้ teacherA วันอังคาร 1 ธ.ค. (มีคาบ 1 ตอนเช้า) → ไม่ควรต้องจัดสอนแทนคาบเช้า
    const c = await post(U.dir, "/api/director/create-leave", { user_id: U.ta.id, leave_type_id: 1, date_start: "2026-12-01", date_end: "2026-12-01", date_start_type: "ครึ่งบ่าย" });
    expectStatus(c, 201);
    const r = await get(U.aca, `/api/academic/leaves/${c.json.id}`);
    if (r.json.progress.required > 0) throw new Warn(`ลาครึ่งบ่ายแต่ระบบให้จัดสอนแทนคาบเช้า ${r.json.progress.required} คาบ (ไม่แยกครึ่งวัน)`);
  });
  await t("AC-18", "ลาช่วงที่มีวันหยุดสถานศึกษา (อ 15 ธ.ค.): ไม่ควรต้องจัดสอนแทนวันหยุด", async () => {
    const h = await post(U.admin, "/api/admin/holiday", { holiday_name: `${TEST_PREFIX}หยุด 15 ธ.ค.`, holiday_date: "2026-12-15" });
    expectStatus(h, 201);
    const c = await post(U.dir, "/api/director/create-leave", { user_id: U.ta.id, leave_type_id: 1, date_start: "2026-12-14", date_end: "2026-12-15" });
    expectStatus(c, 201);
    const r = await get(U.aca, `/api/academic/leaves/${c.json.id}`);
    const holidaySlots = r.json.schedule.filter((d) => d.date === "2026-12-15").reduce((n, d) => n + d.slots.length, 0);
    if (holidaySlots > 0) throw new Fail(`total_day=${c.json.total_day} (ตัดวันหยุดแล้ว) แต่ยังต้องจัดสอนแทนวันหยุด ${holidaySlots} คาบ — required=${r.json.progress.required}`);
    return `total_day=${c.json.total_day}, required=${r.json.progress.required}`;
  });
  await t("AC-20", "ครูที่ลาครึ่งเช้า: ไม่ว่างคาบ 1 (เช้า) แต่ว่างคาบ 5 (บ่าย)", async () => {
    const c = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: 1, date_start: "2026-12-02", date_end: "2026-12-02", date_start_type: "ครึ่งเช้า" });
    expectStatus(c, 201);
    const am = await get(U.aca, "/api/academic/free-teachers?date=2026-12-02&period=1");
    const pm = await get(U.aca, "/api/academic/free-teachers?date=2026-12-02&period=5");
    const has = (r) => [...r.json.data1, ...r.json.data2].some((x) => x.user_id === U.tb.id);
    expect(!has(am) && has(pm), `คาบ 1: ${has(am) ? "ว่าง" : "ไม่ว่าง"}, คาบ 5: ${has(pm) ? "ว่าง" : "ไม่ว่าง"}`);
  });
  await t("AC-21", "ลบคาบสอนที่มีประวัติสอนแทน → 409 และคาบ/ประวัติยังอยู่", async () => {
    const r = await del(U.admin, `/api/admin/schedule/table/${U.ta.id}?teaching_schedule_id=${ids.ts[0]}`);
    expect(r.status === 409, show(r));
    const left = await admin.from("substituteuserteaching").select("substitute_teaching_id").eq("teaching_schedule_id", ids.ts[0]);
    expect(left.data.length > 0, "ประวัติสอนแทนหาย");
  });
  await t("AC-19", "วันหยุดราชการ (Google) ถูกตัดออกจากจำนวนวันลา: ลา 12–16 เม.ย. 2027 (สงกรานต์ 13–15) ควรได้ 2 วัน", async () => {
    const c = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: 1, date_start: "2027-04-12", date_end: "2027-04-16" });
    expectStatus(c, 201);
    expect(c.json.total_day <= 2, `total_day=${c.json.total_day} (วันหยุดราชการไม่ถูกตัด — Google Calendar ใช้ไม่ได้)`);
  });

  /* -------------------------------------------------------------- 14. หน้าเว็บที่โหลดข้อมูลฝั่งเซิร์ฟเวอร์ */
  section("14. หน้าเว็บที่ส่งข้อมูลมากับ HTML");
  await t("SSR-01", "/leave-history ของ teacherA มีข้อมูลใบลาใน HTML", async () => {
    const r = await get(U.ta, "/leave-history", { activeRole: "2" });
    expectStatus(r, 200);
    if (!r.text.includes(`${TEST_PREFIX}ป่วย`)) {
      fs.writeFileSync(path.join(process.env.TEMP || "/tmp", "e2e-leave-history.html"), r.text);
      throw new Fail(`HTML ไม่มีข้อมูลใบลา (ยาว ${r.text.length}, มี "ลาป่วย"=${r.text.includes("ลาป่วย")}, มีคำว่า initial=${r.text.includes("initial")})`);
    }
  });
  await t("SSR-02", "/leave-overview มีสิทธิ์ลาใน HTML", async () => {
    const r = await get(U.ta, "/leave-overview", { activeRole: "2" });
    expect(r.status === 200 && r.text.includes("ลาป่วย"), show(r));
  });
  await t("SSR-03", "/leavetable (วิชาการ) มีใบลาทดสอบใน HTML", async () => {
    const r = await get(U.aca, "/leavetable", { activeRole: "5" });
    expect(r.status === 200 && r.text.includes(`${TEST_PREFIX}teacherA`), "ไม่พบชื่อครูทดสอบ");
  });

  /* -------------------------------------------------------------- 15. ลบผู้ใช้ */
  /* -------------------------------------------------------------- 18. ข้อมูลจริง (อ่านอย่างเดียว) */
  section("18. ตรวจความถูกต้องของข้อมูลจริง (อ่านอย่างเดียว — ไม่แก้ไขอะไร)");
  {
    const testUserIds = new Set([...Object.values(U).map((u) => u?.id).filter(Boolean)]);
    const fyOf = (iso) => {
      const [y, m] = iso.split("-").map(Number);
      return m >= 10 ? y + 1 : y;
    };
    const DAY = 86_400_000;
    const isoAdd = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
    const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
    const half = (v) => {
      const s = String(v ?? "").trim().toLowerCase();
      return ["am", "เช้า", "ครึ่งเช้า", "pm", "บ่าย", "ครึ่งบ่าย"].includes(s);
    };

    const leaves = ((await admin.from("leaverequest").select("*").order("leave_request_id")).data ?? []).filter((r) => !testUserIds.has(r.user_id));
    const usersRows = (await admin.from("users").select("user_id, is_active, name")).data.filter((u) => !testUserIds.has(u.user_id) && !String(u.name ?? "").startsWith(TEST_PREFIX));
    const roleRows = (await admin.from("userrole").select("user_id, role_type_id")).data;
    const teacherRows = (await admin.from("teacher").select("teacher_id, user_id, subject_group_id")).data.filter((x) => !testUserIds.has(x.user_id));
    const tsRows = (await admin.from("teachingschedule").select("teaching_schedule_id, teacher_id, day_of_week, period_number, subject_id, classroom_id")).data;
    const subRows = (await admin.from("substituteuserteaching").select("substitute_teaching_id, date_time, substitute_user_id, teaching_schedule_id")).data.filter((x) => !testUserIds.has(x.substitute_user_id));
    const snapRows = (await admin.from("userleavequota").select("*")).data.filter((x) => !testUserIds.has(x.user_id));
    const types = (await admin.from("leavetype").select("*")).data;
    const schoolHol = new Set((await admin.from("holiday").select("holiday_date, holiday_name")).data.filter((h) => !String(h.holiday_name).startsWith(TEST_PREFIX)).map((h) => h.holiday_date));
    const realTs = tsRows.filter((x) => teacherRows.some((t) => t.teacher_id === x.teacher_id));
    console.log(`  ข้อมูลจริง: ใบลา ${leaves.length}, ผู้ใช้ ${usersRows.length}, ครู ${teacherRows.length}, คาบสอน ${realTs.length}, สอนแทน ${subRows.length}, snapshot โควตา ${snapRows.length}`);

    await t("DI-01", `ใบลาจริงทุกใบ (${leaves.length}) มีสถานะที่ระบบรู้จัก`, async () => {
      const ok = ["pending", "reviewed", "failed", "approved", "rejected", "covered", "cancelled"];
      const bad = leaves.filter((r) => !ok.includes(r.status));
      expect(bad.length === 0, bad.map((r) => `#${r.leave_request_id}=${r.status}`).join(", "));
      const by = {};
      for (const r of leaves) by[r.status] = (by[r.status] ?? 0) + 1;
      return JSON.stringify(by);
    });
    await t("DI-02", "วันที่ของใบลาถูกต้อง: สิ้นสุด ≥ เริ่ม และอยู่ปีงบเดียวกัน", async () => {
      const bad = leaves.filter((r) => !r.date_start || !r.date_end || r.date_end < r.date_start || fyOf(r.date_start) !== fyOf(r.date_end));
      expect(bad.length === 0, bad.map((r) => `#${r.leave_request_id} ${r.date_start}..${r.date_end}`).join(", "));
    });
    await t("DI-03", "คอลัมน์ year ตรงกับปีงบของวันเริ่มลา", async () => {
      const bad = leaves.filter((r) => r.year != null && Number(r.year) !== fyOf(r.date_start));
      const nul = leaves.filter((r) => r.year == null).length;
      expect(bad.length === 0, bad.map((r) => `#${r.leave_request_id} year=${r.year} ควร ${fyOf(r.date_start)}`).join(", "));
      warnIf(nul > 0, `year เป็น null ${nul} ใบ`);
    });
    await t("DI-04", "total_day ที่บันทึก เทียบกับที่คำนวณใหม่ (ตัดเสาร์-อาทิตย์ + วันหยุดสถานศึกษา; วันหยุดราชการดึงไม่ได้)", async () => {
      const more = [];
      const less = [];
      for (const r of leaves) {
        let w = 0;
        for (let d = r.date_start; d <= r.date_end; d = isoAdd(d, 1)) if (![0, 6].includes(dow(d)) && !schoolHol.has(d)) w++;
        let calc = w;
        if (w > 0) {
          if (r.date_start === r.date_end) calc = half(r.date_start_type) ? 0.5 : 1;
          else {
            if (half(r.date_start_type) && ![0, 6].includes(dow(r.date_start))) calc -= 0.5;
            if (half(r.date_end_type) && ![0, 6].includes(dow(r.date_end))) calc -= 0.5;
          }
        }
        const stored = Number(r.total_day);
        if (stored > calc) more.push(`#${r.leave_request_id} บันทึก ${stored} คำนวณได้ ${calc}`);
        else if (stored < calc) less.push(`#${r.leave_request_id} บันทึก ${stored} คำนวณได้ ${calc}`);
      }
      // บันทึก "มากกว่า" = นับเกินจริงแน่นอน (นับเสาร์-อาทิตย์/วันหยุด) — บันทึก "น้อยกว่า" อาจเป็นวันหยุดราชการ (ตรวจไม่ได้เพราะ Google ล้มเหลว)
      expect(more.length === 0, `นับเกิน ${more.length} ใบ: ${more.join("; ")}${less.length ? ` | น้อยกว่า (อาจเป็นวันหยุดราชการ) ${less.length} ใบ: ${less.join("; ")}` : ""}`);
      warnIf(less.length > 0, `น้อยกว่าที่คำนวณ ${less.length} ใบ (ถ้าไม่ใช่วันหยุดราชการ แปลว่านับขาด): ${less.join("; ")}`);
    });
    await t("DI-05", "ข้อมูลผู้ตรวจ/ผู้อนุมัติครบตามสถานะ", async () => {
      const bad = [];
      for (const r of leaves) {
        if (["approved", "covered", "rejected"].includes(r.status) && (!r.approved_by || !r.approved_at)) bad.push(`#${r.leave_request_id} ${r.status} ไม่มีผู้อนุมัติ/เวลา`);
        if (["reviewed", "failed"].includes(r.status) && (!r.reviewed_by || !r.reviewed_at)) bad.push(`#${r.leave_request_id} ${r.status} ไม่มีผู้ตรวจ/เวลา`);
      }
      expect(bad.length === 0, bad.join("; "));
    });
    await t("DI-06", "ไม่มีใบลาของคนเดียวกันที่วันทับกัน (นับเฉพาะสถานะที่ใช้/กันสิทธิ์)", async () => {
      const live = leaves.filter((r) => ["pending", "reviewed", "approved", "covered"].includes(r.status));
      const bad = [];
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i];
          const b = live[j];
          if (a.user_id === b.user_id && a.date_start <= b.date_end && b.date_start <= a.date_end) bad.push(`#${a.leave_request_id}↔#${b.leave_request_id}`);
        }
      expect(bad.length === 0, `${bad.length} คู่: ${bad.join(", ")}`);
    });
    await t("DI-07", "ไฟล์แนบที่อ้างในใบลามีอยู่จริงใน Storage", async () => {
      const folders = new Map();
      const missing = [];
      let n = 0;
      for (const r of leaves) {
        if (!r.file) continue;
        let keys = [];
        try {
          keys = String(r.file).trim().startsWith("[") ? JSON.parse(r.file) : [String(r.file).replace(/^["']+|["']+$/g, "")];
        } catch {
          keys = [String(r.file)];
        }
        for (const k0 of keys) {
          const k = k0.includes("/") ? k0.replace(/^\/+/, "") : `public/${r.user_id}/${k0}`;
          const dir = k.slice(0, k.lastIndexOf("/"));
          if (!folders.has(dir)) folders.set(dir, new Set(((await admin.storage.from("leave-attachments").list(dir, { limit: 1000 })).data ?? []).map((f) => f.name)));
          n++;
          if (!folders.get(dir).has(k.slice(k.lastIndexOf("/") + 1))) missing.push(`#${r.leave_request_id}`);
        }
      }
      expect(missing.length === 0, `หาไฟล์ไม่เจอ ${missing.length}/${n}: ${missing.join(", ")}`);
      return `ตรวจ ${n} ไฟล์`;
    });
    await t("DI-08", "ผู้ใช้ทุกคนในตาราง users มีบัญชีล็อกอิน (Auth) และมีอย่างน้อย 1 บทบาท", async () => {
      const authIds = new Set();
      for (let page = 1; page < 20; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        data.users.forEach((u) => authIds.add(u.id));
        if (data.users.length < 1000) break;
      }
      const noAuth = usersRows.filter((u) => !authIds.has(u.user_id)).length;
      const noRole = usersRows.filter((u) => !roleRows.some((r) => r.user_id === u.user_id)).length;
      expect(noAuth === 0 && noRole === 0, `ไม่มีบัญชีล็อกอิน ${noAuth} คน, ไม่มีบทบาท ${noRole} คน`);
    });
    await t("DI-09", "บัญชีที่ปิดใช้งาน ถูกบล็อกการล็อกอินที่ Auth ด้วย", async () => {
      const inactive = usersRows.filter((u) => u.is_active === false);
      const notBanned = [];
      for (const u of inactive) {
        const { data } = await admin.auth.admin.getUserById(u.user_id);
        const until = data?.user?.banned_until;
        if (!until || Date.parse(until) < Date.now()) notBanned.push(u.user_id.slice(0, 8));
      }
      expect(notBanned.length === 0, `ปิดใช้งานแต่ยังล็อกอินได้ ${notBanned.length}/${inactive.length} คน`);
      return `ปิดใช้งาน ${inactive.length} คน`;
    });
    await t("DI-10", "ครู: 1 คน 1 แถว และผูกกับผู้ใช้ที่มีอยู่", async () => {
      const seen = new Map();
      for (const x of teacherRows) seen.set(x.user_id, (seen.get(x.user_id) ?? 0) + 1);
      const dup = [...seen].filter(([, c]) => c > 1).length;
      const orphan = teacherRows.filter((x) => !usersRows.some((u) => u.user_id === x.user_id)).length;
      expect(dup === 0 && orphan === 0, `ครูซ้ำ ${dup} คน, ไม่มีผู้ใช้ ${orphan} แถว`);
    });
    await t("DI-11", "ตารางสอน: วัน จ–ศ, ไม่มีคาบซ้ำวัน+คาบเดียวกันของครูคนเดียว", async () => {
      const keys = new Map();
      const badDay = realTs.filter((x) => !(Number(x.day_of_week) >= 1 && Number(x.day_of_week) <= 5)).length;
      for (const x of realTs) {
        const k = `${x.teacher_id}|${x.day_of_week}|${x.period_number}`;
        keys.set(k, (keys.get(k) ?? 0) + 1);
      }
      const dup = [...keys].filter(([, c]) => c > 1);
      expect(badDay === 0 && dup.length === 0, `วันผิด ${badDay}, คาบซ้ำ ${dup.length}: ${dup.map(([k, c]) => `${k}×${c}`).join(", ")}`);
    });
    await t("DI-12", "สอนแทน: วันตรงตาราง, ไม่ใช่ครูเจ้าของคาบ, ไม่ซ้ำ, และครูเจ้าของคาบมีใบลาอนุมัติวันนั้น", async () => {
      const issues = { วันไม่ตรง: [], สอนแทนตัวเอง: [], ซ้ำ: [], ไม่มีใบลา: [], คาบไม่มี: [] };
      const seen = new Set();
      for (const s of subRows) {
        const ts = tsRows.find((x) => x.teaching_schedule_id === s.teaching_schedule_id);
        const d = String(s.date_time).slice(0, 10);
        if (!ts) {
          issues.คาบไม่มี.push(s.substitute_teaching_id);
          continue;
        }
        if (dow(d) !== Number(ts.day_of_week)) issues.วันไม่ตรง.push(s.substitute_teaching_id);
        const owner = teacherRows.find((x) => x.teacher_id === ts.teacher_id);
        if (owner && owner.user_id === s.substitute_user_id) issues.สอนแทนตัวเอง.push(s.substitute_teaching_id);
        const k = `${s.teaching_schedule_id}|${d}`;
        if (seen.has(k)) issues.ซ้ำ.push(s.substitute_teaching_id);
        seen.add(k);
        if (owner && !leaves.some((r) => r.user_id === owner.user_id && ["approved", "covered"].includes(r.status) && r.date_start <= d && d <= r.date_end)) issues.ไม่มีใบลา.push(s.substitute_teaching_id);
      }
      const summary = Object.entries(issues).filter(([, v]) => v.length).map(([k, v]) => `${k} ${v.length} (#${v.slice(0, 10).join(",")})`);
      expect(summary.length === 0, summary.join(" | "));
      return `${subRows.length} รายการ`;
    });
    await t("DI-13", "ใบลาสถานะ covered จัดสอนแทนครบจริง (เปิดผ่านหน้าจอวิชาการ)", async () => {
      const covered = leaves.filter((r) => r.status === "covered");
      const bad = [];
      for (const r of covered) {
        const x = await get(U.aca, `/api/academic/leaves/${r.leave_request_id}`);
        if (x.status !== 200) bad.push(`#${r.leave_request_id} → ${x.status}`);
        else if (x.json.isTeacher && !x.json.progress.complete) bad.push(`#${r.leave_request_id} จัด ${x.json.progress.assigned}/${x.json.progress.required}`);
      }
      expect(bad.length === 0, bad.join("; "));
      return `${covered.length} ใบ`;
    });
    await t("DI-14", "ใบลา approved ของครูที่จัดสอนแทนครบแล้วแต่ยังไม่ถูกปิดงาน (ข้อมูล)", async () => {
      const appr = leaves.filter((r) => r.status === "approved" && teacherRows.some((x) => x.user_id === r.user_id));
      const ready = [];
      for (const r of appr) {
        const x = await get(U.aca, `/api/academic/leaves/${r.leave_request_id}`);
        if (x.status === 200 && x.json.progress.complete) ready.push(`#${r.leave_request_id}(${x.json.progress.required} คาบ)`);
      }
      warnIf(ready.length > 0, `ครบแล้วแต่ยังเป็น approved ${ready.length}/${appr.length}: ${ready.join(", ")}`);
      return `approved ของครู ${appr.length} ใบ`;
    });
    await t("DI-15", "snapshot userleavequota ตรงกับโควตาที่ระบบคำนวณ (ผ่านหน้าจอ ผอ.)", async () => {
      const bad = [];
      const cache = new Map();
      for (const s of snapRows) {
        const k = `${s.user_id}|${s.year}`;
        if (!cache.has(k)) cache.set(k, await get(U.dir, `/api/director/employee-quota?userId=${s.user_id}&year=${s.year}`));
        const r = cache.get(k);
        if (r.status !== 200) {
          bad.push(`${s.user_id.slice(0, 8)} ปี ${s.year} → ${r.status}`);
          continue;
        }
        const it = r.json.items.find((i) => i.leave_type_id === s.leave_type_id);
        if (!it) continue;
        if (Number(s.total_used ?? 0) !== it.used || Number(s.reserved ?? 0) !== it.reserved)
          bad.push(`${s.user_id.slice(0, 8)} ปี ${s.year} ประเภท ${s.leave_type_id}: snapshot used=${s.total_used} reserved=${s.reserved} / คำนวณ used=${it.used} reserved=${it.reserved}`);
      }
      warnIf(bad.length > 0, `ไม่ตรง ${bad.length}/${snapRows.length} แถว (snapshot เก่าก่อน refactor จะถูกแก้เมื่อมีการเปลี่ยนสถานะครั้งถัดไป): ${bad.slice(0, 15).join("; ")}`);
      return `${snapRows.length} แถว`;
    });
    await t("DI-16", "ไม่มีบุคลากรที่ใช้สิทธิ์ลาเกินโควตา (ปีงบปัจจุบันและปีก่อน)", async () => {
      const over = [];
      const ids2 = [...new Set(leaves.map((r) => r.user_id))];
      for (const uid of ids2)
        for (const y of [2026, 2027]) {
          const r = await get(U.dir, `/api/director/employee-quota?userId=${uid}&year=${y}`);
          for (const it of r.json?.items ?? []) if (!it.unlimited && it.used > it.total) over.push(`${uid.slice(0, 8)} ปี ${y} ${it.name} ใช้ ${it.used}/${it.total}`);
        }
      expect(over.length === 0, over.join("; "));
      return `${ids2.length} คน`;
    });
    await t("DI-17", "ประเภทลาที่ใช้ในใบลามีอยู่จริง และตั้งค่าประเภทลาสมเหตุสมผล", async () => {
      const typeIds = new Set(types.map((x) => x.leave_type_id));
      const badRef = leaves.filter((r) => !typeIds.has(r.leave_type_id)).length;
      const badCfg = types.filter((x) => (x.max_leave_day != null && x.max_leave_day <= 0) || (x.carry_over_max != null && x.carry_over_max < 0));
      expect(badRef === 0 && badCfg.length === 0, `อ้างประเภทที่ไม่มี ${badRef}, ตั้งค่าผิด ${badCfg.map((x) => x.leave_type_id).join(",")}`);
      return `${types.length} ประเภท (ไม่จำกัด ${types.filter((x) => x.max_leave_day == null).length})`;
    });
    await t("DI-18", "จำนวนในคิวของแต่ละหน้าจอ ตรงกับฐานข้อมูล (ธุรการ/ผอ./วิชาการ/ประวัติอนุมัติ)", async () => {
      const all = (await admin.from("leaverequest").select("status, user_id")).data;
      const teacherIds = new Set((await admin.from("teacher").select("user_id")).data.map((x) => x.user_id));
      const cnt = (f) => all.filter(f).length;
      const checks = [
        ["/api/supervisor/leave-review?pageSize=1", U.sup, cnt((r) => r.status === "pending")],
        ["/api/director/leave-approve?pageSize=1", U.dir, cnt((r) => r.status === "reviewed")],
        ["/api/academic/leaves?pageSize=1", U.aca, cnt((r) => ["approved", "covered"].includes(r.status) && teacherIds.has(r.user_id))],
        ["/api/director/approved-history?pageSize=1", U.dir, cnt((r) => ["approved", "covered", "rejected"].includes(r.status))],
      ];
      const bad = [];
      const out = [];
      for (const [p, who, db] of checks) {
        const r = await get(who, p);
        out.push(`${p.split("?")[0].split("/").slice(-1)[0]}=${r.json?.total}`);
        if (r.json?.total !== db) bad.push(`${p} API ${r.json?.total} DB ${db}`);
      }
      expect(bad.length === 0, bad.join("; "));
      return out.join(" ");
    });
    await t("DI-19", "หน้าแดชบอร์ด ผอ. (ทุกปีงบที่มีข้อมูล) ตอบได้ และจำนวนใบลารวมตรงกับฐานข้อมูล", async () => {
      const r = await get(U.dir, "/api/director/dashboard-data?mode=all&status=all");
      expectStatus(r, 200);
      return `keys: ${Object.keys(r.json).join(",")}`;
    });
  }

  /* -------------------------------------------------------------- 19. ตั้งค่าระบบ */
  section("19. ตั้งค่าระบบ (admin)");
  {
    // เก็บค่าเดิมไว้ คืนให้ใน finally (เทสนี้แก้การตั้งค่าจริง)
    settingsSnapshot = await snapshotSettings();
    const pub = async () => (await call(null, "GET", "/api/settings/public")).json;
    const original = (await pub()).general;
    const NEW_NAME = `${TEST_PREFIX}ระบบลาทดสอบ ${RUN}`;

    await t("SET-01", "อ่านค่าสาธารณะได้โดยไม่ต้องล็อกอิน (ชื่อระบบ/สี/คาบ/ไฟล์แนบ)", async () => {
      const r = await call(null, "GET", "/api/settings/public");
      expectStatus(r, 200);
      expect(r.json.general?.systemName && r.json.periods?.periods?.length && r.json.attachments?.maxFiles, show(r));
      return `ชื่อระบบ: ${r.json.general.systemName}`;
    });
    await t("SET-02", "บทบาทอื่นอ่าน/แก้การตั้งค่าไม่ได้ (403)", async () => {
      for (const u of [U.ta, U.sup, U.dir, U.aca]) {
        expectStatus(await get(u, "/api/admin/settings"), 403);
        expectStatus(await put(u, "/api/admin/settings/general", { systemName: "hack" }), 403);
        expectStatus(await get(u, "/api/admin/settings/history"), 403);
      }
    });
    await t("SET-03", "admin อ่านการตั้งค่าทั้งหมด + ค่าเริ่มต้น", async () => {
      const r = await get(U.admin, "/api/admin/settings");
      expectStatus(r, 200);
      expect(r.json.settings?.general && r.json.defaults?.general && r.json.settings.leaveTypes?.["1"], show(r));
    });
    await t("SET-04", "ค่าผิด → 422 พร้อมข้อความไทย (ชื่อว่าง, สีไม่มีจริง, คาบซ้อน, ไฟล์ใหญ่เกิน) / หมวดไม่มีจริง → 404", async () => {
      const a = await put(U.admin, "/api/admin/settings/general", { systemName: "  " });
      expect(a.status === 422 && /ชื่อระบบ/.test(a.json.detail), show(a));
      expectStatus(await put(U.admin, "/api/admin/settings/general", { theme: "rainbow" }), 422);
      expectStatus(
        await put(U.admin, "/api/admin/settings/periods", { periods: [{ start_time: "08:00", end_time: "09:00" }, { start_time: "08:30", end_time: "09:30" }] }),
        422
      );
      expectStatus(await put(U.admin, "/api/admin/settings/attachments", { maxFileMB: 999 }), 422);
      expectStatus(await put(U.admin, "/api/admin/settings/nope", {}), 404);
      expect((await pub()).general.systemName === original.systemName, "ค่าผิดแต่ถูกบันทึก");
    });
    await t("SET-05", "เปลี่ยนชื่อระบบ + สีเขียว → หัวเว็บ, หน้าเข้าสู่ระบบ, ชื่อแท็บ, สี เปลี่ยนตามทันที", async () => {
      const r = await put(U.admin, "/api/admin/settings/general", { systemName: NEW_NAME, theme: "green" });
      expectStatus(r, 200);
      expect((await pub()).general.systemName === NEW_NAME, "ค่าสาธารณะไม่เปลี่ยน");
      const login = await get(null, "/login");
      expect(login.text.includes(NEW_NAME), "หน้าเข้าสู่ระบบไม่แสดงชื่อใหม่");
      expect(new RegExp(`<title>[^<]*${NEW_NAME}`).test(login.text), "ชื่อแท็บ (<title>) ไม่เปลี่ยน");
      expect(/--brand:\s*#059669/.test(login.text), "สีของระบบไม่เปลี่ยน");
      const page = await get(U.ta, "/leave-history", { activeRole: "2" });
      expect(page.text.includes(NEW_NAME), "หัวเว็บของผู้ใช้ไม่แสดงชื่อใหม่");
    });
    await t("SET-06", "ประวัติบันทึกว่าใครแก้อะไร (ค่าเดิม → ค่าใหม่)", async () => {
      const r = await get(U.admin, "/api/admin/settings/history?pageSize=5");
      expectStatus(r, 200);
      const h = r.json.data[0];
      expect(h && h.section === "general" && h.after.systemName === NEW_NAME && h.before.systemName === original.systemName && h.by.id === U.admin.id, JSON.stringify(h));
      ids.settingsEntry = h.id;
    });
    await t("SET-07", "ย้อนกลับจากประวัติ → ชื่อ/สีกลับเป็นค่าเดิม และบันทึกการย้อนกลับเป็นประวัติใหม่", async () => {
      expectStatus(await post(U.admin, `/api/admin/settings/history/${ids.settingsEntry}/revert`), 200);
      const now = (await pub()).general;
      expect(now.systemName === original.systemName && now.theme === original.theme, JSON.stringify(now));
      const r = await get(U.admin, "/api/admin/settings/history?pageSize=1");
      expect(/^ย้อนกลับ/.test(r.json.data[0]?.label), JSON.stringify(r.json.data[0]));
      expectStatus(await post(U.admin, "/api/admin/settings/history/not-a-real-id/revert"), 404);
    });
    await t("SET-08", "โลโก้: ชนิดไฟล์ผิด/ใหญ่เกิน → 422, PNG → 201 เปิดดูได้, เอาออกได้", async () => {
      const bad = new FormData();
      bad.append("file", new Blob(["<svg/>"], { type: "image/svg+xml" }), "a.svg");
      expectStatus(await post(U.admin, "/api/admin/settings/logo", bad), 422);
      const big = new FormData();
      big.append("file", new Blob([new Uint8Array(1024 * 1024 + 10)], { type: "image/png" }), "big.png");
      expectStatus(await post(U.admin, "/api/admin/settings/logo", big), 422);
      const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
      const ok = new FormData();
      ok.append("file", new Blob([png], { type: "image/png" }), "logo.png");
      const up = await post(U.admin, "/api/admin/settings/logo", ok);
      expectStatus(up, 201);
      uploadedLogos.push(up.json.logoUrl);
      expect((await fetch(up.json.logoUrl)).status === 200, "เปิดไฟล์โลโก้ไม่ได้");
      expect((await pub()).general.logoUrl === up.json.logoUrl, "ค่าสาธารณะไม่มีโลโก้");
      expectStatus(await del(U.admin, "/api/admin/settings/logo"), 200);
      expect((await pub()).general.logoUrl === null, "เอาโลโก้ออกไม่สำเร็จ");
      // ระบบจริงอาจมีโลโก้อยู่แล้ว → ใส่โลโก้เดิมกลับ (ไฟล์ตั้งค่าเดิมคืนให้อีกครั้งตอนล้างข้อมูล)
      if (original.logoUrl) expectStatus(await put(U.admin, "/api/admin/settings/general", { logoUrl: original.logoUrl }), 200);
    });
    await t("SET-09", "บันทึกค่าเดิมซ้ำ (ไม่มีอะไรเปลี่ยน) → ไม่เพิ่มประวัติ", async () => {
      const before = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.total;
      expectStatus(await put(U.admin, "/api/admin/settings/general", original), 200);
      const after = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.total;
      expect(before === after, `ประวัติเพิ่มจาก ${before} เป็น ${after}`);
    });
    const latest = async () => (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.data[0];
    await t("SET-10", "รายการที่เป็นการย้อนกลับ ย้อนซ้ำไม่ได้ (409) และรายการที่ถูกย้อนแล้วย้อนอีกไม่ได้ — กันกดวนไปมา", async () => {
      expectStatus(await put(U.admin, "/api/admin/settings/general", { footerText: `${TEST_PREFIX}ท้ายเมนู` }), 200);
      const edit = await latest();
      expect(edit.blockedReason === null, `รายการแก้ไขปกติควรย้อนได้: ${edit.blockedReason}`);
      expectStatus(await post(U.admin, `/api/admin/settings/history/${edit.id}/revert`), 200);
      const rev = await latest();
      expect(rev.revertOf === edit.id && rev.blockedReason, JSON.stringify(rev));
      const again = await post(U.admin, `/api/admin/settings/history/${rev.id}/revert`);
      expect(again.status === 409 && again.json.error === "CANNOT_REVERT", show(again));
      const twice = await post(U.admin, `/api/admin/settings/history/${edit.id}/revert`);
      expect(twice.status === 409, show(twice));
      expect((await pub()).general.footerText === original.footerText, "ข้อความท้ายเมนูไม่กลับเป็นค่าเดิม");
    });
    await t("SET-11", "คืนค่าเริ่มต้น: หมวดผิด → 422, บทบาทอื่น → 403, หมวดทั่วไป + กฎประเภทการลา กลับเป็นค่าตั้งต้น แล้วย้อนกลับได้", async () => {
      expectStatus(await post(U.ta, "/api/admin/settings/reset", { sections: ["general"] }), 403);
      expectStatus(await post(U.admin, "/api/admin/settings/reset", { sections: [] }), 422);
      expectStatus(await post(U.admin, "/api/admin/settings/reset", { sections: ["nope"] }), 422);
      const defaults = (await get(U.admin, "/api/admin/settings")).json.defaults;
      expectStatus(await put(U.admin, "/api/admin/settings/general", { systemName: NEW_NAME }), 200);
      expectStatus(await patch(U.admin, "/api/admin/leave-types/2", { minNoticeDays: 7 }), 200);
      const r = await post(U.admin, "/api/admin/settings/reset", { sections: ["general", "leaveTypes"] });
      expectStatus(r, 200);
      const s = (await get(U.admin, "/api/admin/settings")).json.settings;
      expect(JSON.stringify(s.general) === JSON.stringify(defaults.general), `ทั่วไปไม่ตรงค่าเริ่มต้น: ${s.general.systemName}`);
      expect(s.leaveTypes["2"].minNoticeDays === null && s.leaveTypes["1"].docRequiredAfterDays === 3, JSON.stringify(s.leaveTypes["2"]));
      // ย้อนกลับการคืนค่าเริ่มต้นกฎประเภทการลา (รายการล่าสุด) → กฎที่ตั้งไว้กลับมา
      const h = await latest();
      expect(h.key === "reset" && h.blockedReason === null, JSON.stringify(h));
      expectStatus(await post(U.admin, `/api/admin/settings/history/${h.id}/revert`), 200);
      expect((await get(U.admin, "/api/admin/settings")).json.settings.leaveTypes["2"].minNoticeDays === 7, "ย้อนการคืนค่าเริ่มต้นไม่สำเร็จ");
      // คืนสภาพให้เทสส่วนถัดไป (ไฟล์ตั้งค่าเดิมคืนให้อีกครั้งตอนล้างข้อมูล)
      expectStatus(await patch(U.admin, "/api/admin/leave-types/2", { minNoticeDays: null }), 200);
      expectStatus(await put(U.admin, "/api/admin/settings/general", original), 200);
      return `คืนค่า: ${r.json.sections.join(", ")}`;
    });
  }

  /* -------------------------------------------------------------- 20. ประเภทการลาและกฎการลา */
  section("20. ประเภทการลาและกฎการลา (admin + บังคับกฎ)");
  {
    settingsSnapshot ??= await snapshotSettings();
    const TYPE_NAME = `${TEST_PREFIX}ลาทดสอบกฎ ${RUN}`;
    const LT = "/api/admin/leave-types";
    const isoAdd = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
    const todayTH = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    /** วันทำการแรกที่ ≥ วันที่ให้มา */
    const weekday = (iso) => {
      let d = iso;
      while (dow(d) === 0 || dow(d) === 6) d = isoAdd(d, 1);
      return d;
    };
    const pdf = () => [[pdfBlob(), "doc.pdf"]];
    const submitT = (fields, files = []) => submit(U.ta, { leave_type_id: ids.ruleType, reason: `${TEST_PREFIX}ทดสอบกฎ`, date_start_type: "เต็มวัน", date_end_type: "เต็มวัน", ...fields }, files);
    const errOf = (r) => `${r.status} ${r.json?.error} ${r.json?.detail?.message ?? ""}`;

    await t("LTA-01", "admin ดูประเภทการลาทั้งหมดพร้อมกฎและจำนวนใบลาที่ใช้ / บทบาทอื่น 403", async () => {
      const r = await get(U.admin, LT);
      expectStatus(r, 200);
      const sick = r.json.items.find((x) => x.leave_type_id === 1);
      expect(sick && sick.rule.docRequiredAfterDays === 3 && typeof sick.usage === "number", JSON.stringify(sick));
      for (const u of [U.ta, U.sup, U.dir, U.aca]) expectStatus(await get(u, LT), 403);
      expectStatus(await post(U.ta, LT, { leave_type_name: "hack" }), 403);
      return `${r.json.items.length} ประเภท`;
    });
    await t("LTA-02", "เพิ่ม: ไม่มีชื่อ → 422, ชื่อซ้ำ (ลาป่วย) → 409, ตัวเลขติดลบ → 422", async () => {
      expectStatus(await post(U.admin, LT, { leave_type_name: " " }), 422);
      expectStatus(await post(U.admin, LT, { leave_type_name: "ลาป่วย" }), 409);
      expectStatus(await post(U.admin, LT, { leave_type_name: `${TYPE_NAME}x`, max_leave_day: -1 }), 422);
      expectStatus(await post(U.admin, LT, { leave_type_name: `${TYPE_NAME}x`, minNoticeDays: -2 }), 422);
    });
    await t("LTA-03", "เพิ่มประเภทใหม่พร้อมกฎ (ครั้งละ ≤2 วัน, แนบเอกสารเมื่อ >1 วัน, ล่วงหน้า 5 วัน, ห้ามครึ่งวัน) → 201", async () => {
      const r = await post(U.admin, LT, {
        leave_type_name: TYPE_NAME, max_leave_day: 10, carry_over_max: null, note: "ทดสอบ",
        description: "ประเภททดสอบกฎ", color: "teal", maxDaysPerRequest: 2, docRequiredAfterDays: 1, minNoticeDays: 5, allowHalfDay: false,
      });
      expectStatus(r, 201);
      ids.ruleType = r.json.item.leave_type_id;
      expect(r.json.item.rule.color === "teal" && r.json.item.rule.minNoticeDays === 5, JSON.stringify(r.json.item.rule));
      return `id=${ids.ruleType}`;
    });
    await t("LTA-04", "บุคลากรเห็นประเภทใหม่พร้อมกฎใน /api/leave-types (เรียงท้ายสุด)", async () => {
      const r = await get(U.ta, "/api/leave-types");
      const items = r.json.items;
      expect(items.at(-1)?.leave_type_id === ids.ruleType && items.at(-1).rule.maxDaysPerRequest === 2, items.map((x) => x.leave_type_id).join(","));
    });

    const far = weekday("2027-01-11"); // จันทร์ ล่วงหน้าเกิน 5 วันแน่นอน
    await t("LTA-05", "ระบบหลังบ้านบังคับกฎ: เกินครั้งละ / ไม่แนบเอกสาร / ครึ่งวัน / ยื่นไม่ล่วงหน้าพอ → 422 พร้อมข้อความ", async () => {
      const a = await submitT({ date_start: far, date_end: isoAdd(far, 2) }, pdf());
      expect(a.status === 422 && a.json.error === "EXCEEDS_MAX_PER_REQUEST" && a.json.detail.message === "ลาได้ครั้งละไม่เกิน 2 วัน", errOf(a));
      const b = await submitT({ date_start: far, date_end: isoAdd(far, 1) });
      expect(b.status === 422 && b.json.error === "DOCUMENT_REQUIRED", errOf(b));
      const c = await submitT({ date_start: far, date_end: far, date_start_type: "ครึ่งเช้า" });
      expect(c.status === 422 && c.json.error === "HALF_DAY_NOT_ALLOWED", errOf(c));
      const soon = weekday(isoAdd(todayTH, 1));
      const d = await submitT({ date_start: soon, date_end: soon }, pdf());
      expect(d.status === 422 && d.json.error === "NOTICE_TOO_SHORT", `${soon}: ${errOf(d)}`);
    });
    await t("LTA-06", "ยื่นตามกฎครบ (2 วัน + แนบเอกสาร + ล่วงหน้า) → 201", async () => {
      const r = await submitT({ date_start: far, date_end: isoAdd(far, 1) }, pdf());
      expectStatus(r, 201);
      expect(r.json.total_day === 2, errOf(r));
    });
    await t("LTA-07", "แก้กฎ: ห้ามยื่นย้อนหลัง (0) → ยื่นวันที่ผ่านมาแล้ว → 422 BACKDATE_TOO_FAR", async () => {
      expectStatus(await patch(U.admin, `${LT}/${ids.ruleType}`, { minNoticeDays: null, maxBackdateDays: 0 }), 200);
      const past = weekday(isoAdd(todayTH, -10));
      const r = await submitT({ date_start: past, date_end: past }, pdf());
      expect(r.status === 422 && r.json.error === "BACKDATE_TOO_FAR", `${past}: ${errOf(r)}`);
    });
    await t("LTA-08", "นับรวมวันหยุด: ลาศุกร์–จันทร์ = 4 วัน (นับเฉพาะวันทำการได้ 2)", async () => {
      expectStatus(await patch(U.admin, `${LT}/${ids.ruleType}`, { countMode: "calendar", maxDaysPerRequest: null, maxBackdateDays: null }), 200);
      const fri = "2027-01-22";
      const r = await submitT({ date_start: fri, date_end: isoAdd(fri, 3) }, pdf());
      expect(r.status === 201 && r.json.total_day === 4, errOf(r));
    });
    await t("LTA-09", "ผอ.สร้างแทน: ไม่ติดกฎล่วงหน้า/เอกสาร แต่ยังห้ามครึ่งวัน", async () => {
      expectStatus(await patch(U.admin, `${LT}/${ids.ruleType}`, { minNoticeDays: 30, docRequiredAfterDays: 0 }), 200);
      const soon = weekday(isoAdd(todayTH, 2));
      const ok = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: ids.ruleType, date_start: soon, date_end: soon });
      expect(ok.status === 201, `${soon}: ${errOf(ok)}`);
      const half = await post(U.dir, "/api/director/create-leave", { user_id: U.tb.id, leave_type_id: ids.ruleType, date_start: "2027-02-01", date_end: "2027-02-01", date_start_type: "ครึ่งบ่าย" });
      expect(half.status === 422 && half.json.error === "HALF_DAY_NOT_ALLOWED", errOf(half));
    });
    await t("LTA-10", "ปิดใช้งาน → หายจากฟอร์มยื่นลา, ยื่นไม่ได้, แต่ยังเห็นในตัวกรอง (?all=1) และในวันลาคงเหลือของคนที่เคยใช้", async () => {
      expectStatus(await patch(U.admin, `${LT}/${ids.ruleType}`, { isActive: false }), 200);
      expect(!(await get(U.ta, "/api/leave-types")).json.items.some((x) => x.leave_type_id === ids.ruleType), "ยังอยู่ในฟอร์มยื่นลา");
      expect((await get(U.ta, "/api/leave-types?all=1")).json.items.some((x) => x.leave_type_id === ids.ruleType), "หายจากตัวกรอง");
      const r = await submitT({ date_start: "2027-02-08", date_end: "2027-02-08" }, pdf());
      expect(r.status === 422 && r.json.error === "LEAVETYPE_INACTIVE", errOf(r));
      const q = await get(U.ta, "/api/user/leave-quota?year=2027");
      expect(q.json.items.some((x) => x.leave_type_id === ids.ruleType), "ไม่แสดงในวันลาคงเหลือทั้งที่เคยใช้แล้ว");
    });
    await t("LTA-11", "ลบประเภทที่มีใบลาแล้ว → 409 (ให้ปิดใช้งานแทน)", async () => {
      const r = await del(U.admin, `${LT}/${ids.ruleType}`);
      expect(r.status === 409 && /ปิดใช้งาน/.test(r.json.detail), errOf(r));
    });
    await t("LTA-12", "เรียงลำดับใหม่ (ย้ายไปบนสุด) แล้วย้อนกลับจากประวัติ → ลำดับเดิม", async () => {
      const before = (await get(U.admin, LT)).json.items.map((x) => x.leave_type_id);
      const moved = [ids.ruleType, ...before.filter((x) => x !== ids.ruleType)];
      expectStatus(await put(U.admin, `${LT}/order`, { ids: moved }), 200);
      expect((await get(U.admin, LT)).json.items[0].leave_type_id === ids.ruleType, "ไม่ขึ้นบนสุด");
      expectStatus(await put(U.admin, `${LT}/order`, { ids: [1, 2] }), 422);
      const h = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.data[0];
      expect(h.label === "เรียงลำดับประเภทการลา", h.label);
      expectStatus(await post(U.admin, `/api/admin/settings/history/${h.id}/revert`), 200);
      const after = (await get(U.admin, LT)).json.items.map((x) => x.leave_type_id);
      expect(JSON.stringify(after) === JSON.stringify(before), `${before} → ${after}`);
    });
    await t("LTA-13", "ประเภทที่ยังไม่มีใบลา: ลบได้ → ย้อนกลับ (สร้างคืนด้วยรหัสเดิม) → ลบอีกครั้ง", async () => {
      const c = await post(U.admin, LT, { leave_type_name: `${TYPE_NAME} ลบได้`, max_leave_day: 3 });
      expectStatus(c, 201);
      const id = c.json.item.leave_type_id;
      expectStatus(await del(U.admin, `${LT}/${id}`), 200);
      const h = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.data[0];
      expectStatus(await post(U.admin, `/api/admin/settings/history/${h.id}/revert`), 200);
      const back = (await get(U.admin, LT)).json.items.find((x) => x.leave_type_id === id);
      expect(back && back.max_leave_day === 3, "สร้างคืนไม่สำเร็จ");
      expectStatus(await del(U.admin, `${LT}/${id}`), 200);
    });
    await t("LTA-14", "ย้อนกลับการแก้ไขจากประวัติ → กฎกลับเป็นค่าก่อนแก้", async () => {
      expectStatus(await patch(U.admin, `${LT}/${ids.ruleType}`, { isActive: true, maxDaysPerRequest: 9 }), 200);
      const h = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.data[0];
      expectStatus(await post(U.admin, `/api/admin/settings/history/${h.id}/revert`), 200);
      const cur = (await get(U.admin, LT)).json.items.find((x) => x.leave_type_id === ids.ruleType);
      expect(cur.rule.maxDaysPerRequest === null && cur.rule.isActive === false, JSON.stringify(cur.rule));
    });
    await t("LTA-15", "กฎเดิมของลาป่วย (เกิน 3 วันต้องแนบเอกสาร) บังคับที่ระบบหลังบ้านแล้ว", async () => {
      const r = await submit(U.ta, { leave_type_id: 1, reason: `${TEST_PREFIX}ป่วยนาน`, date_start: "2027-03-01", date_end: "2027-03-04" });
      expect(r.status === 422 && r.json.error === "DOCUMENT_REQUIRED", errOf(r));
    });
  }

  /* -------------------------------------------------------------- 21. คาบเรียน + ไฟล์แนบ */
  section("21. ตั้งค่าคาบเรียนและไฟล์แนบ");
  {
    settingsSnapshot ??= await snapshotSettings();
    const cur = (await get(U.admin, "/api/admin/settings")).json.settings;
    const SCH = `/api/admin/schedule/table/${U.ta.id}`;
    await t("PER-01", "ลดเหลือ 5 คาบ (ไม่ปรับตารางเดิม) → ค่าสาธารณะเปลี่ยน + เพิ่มตารางสอนคาบ 6 ไม่ได้ (422) + แจ้งจำนวนแถวที่เกิน", async () => {
      const r = await put(U.admin, "/api/admin/settings/periods", { periods: cur.periods.periods.slice(0, 5), syncSchedule: false });
      expectStatus(r, 200);
      expect(r.json.value.periods.length === 5 && r.json.updatedRows === 0 && typeof r.json.rowsBeyond === "number", show(r));
      const pub = (await call(null, "GET", "/api/settings/public")).json;
      expect(pub.periods.periods.length === 5, "ค่าสาธารณะยังเป็นจำนวนคาบเดิม");
      const bad = await post(U.admin, SCH, { day_of_week: 5, period_number: 6, subject_id: ids.subject, classroom_id: ids.classroom });
      expect(bad.status === 422 && /ไม่มีคาบที่ 6/.test(bad.json.detail), show(bad));
      return `ตารางเดิมที่เกิน 5 คาบ: ${r.json.rowsBeyond} แถว`;
    });
    await t("PER-02", "ช่วงบ่ายเริ่ม 10:30 → คาบ 4 (10:40) นับเป็นบ่าย; คืนค่าเดิม", async () => {
      expectStatus(await put(U.admin, "/api/admin/settings/periods", { afternoonStartsAt: "10:30" }), 200);
      expect((await get(U.admin, "/api/admin/settings")).json.settings.periods.afternoonStartsAt === "10:30", "ไม่บันทึก");
      expectStatus(await put(U.admin, "/api/admin/settings/periods", { ...cur.periods, syncSchedule: false }), 200);
      expect(JSON.stringify((await get(U.admin, "/api/admin/settings")).json.settings.periods) === JSON.stringify(cur.periods), "คืนค่าเดิมไม่สำเร็จ");
    });
    const sendFiles = (files) =>
      submit(U.ta, { leave_type_id: 2, reason: `${TEST_PREFIX}ไฟล์แนบ`, date_start: "2027-04-05", date_end: "2027-04-05", date_start_type: "เต็มวัน", date_end_type: "เต็มวัน" }, files);
    const png = () => [new Blob([new Uint8Array(10)], { type: "image/png" }), "a.png"];
    await t("ATT-01", "ตั้ง 1 ไฟล์ เฉพาะ PDF → 2 ไฟล์ = 422 TOO_MANY_FILES, PNG = 422 FILE_TYPE_NOT_ALLOWED (ข้อความตามค่าใหม่, ไม่มีใบลาค้าง)", async () => {
      const r = await put(U.admin, "/api/admin/settings/attachments", { maxFiles: 1, kinds: ["pdf"], maxFileMB: 2 });
      expectStatus(r, 200);
      expect(r.json.bucketUpdated === true, "ปรับขีดจำกัดของที่เก็บไฟล์ไม่สำเร็จ");
      const pub = (await call(null, "GET", "/api/settings/public")).json;
      expect(pub.attachments.maxFiles === 1 && pub.attachments.kinds.join() === "pdf", JSON.stringify(pub.attachments));
      const two = await sendFiles([[pdfBlob(), "a.pdf"], [pdfBlob(), "b.pdf"]]);
      expect(two.status === 422 && two.json.error === "TOO_MANY_FILES" && two.json.detail.message === "แนบไฟล์ได้ไม่เกิน 1 ไฟล์", show(two));
      const img = await sendFiles([png()]);
      expect(img.status === 422 && img.json.error === "FILE_TYPE_NOT_ALLOWED" && /ไม่ใช่ PDF/.test(img.json.detail.message), show(img));
      const { count } = await admin.from("leaverequest").select("leave_request_id", { count: "exact", head: true }).eq("user_id", U.ta.id).eq("date_start", "2027-04-05");
      expect(count === 0, `มีใบลาค้าง ${count} ใบ`);
    });
    await t("ATT-02", "ย้อนกลับจากประวัติ → ค่าไฟล์แนบเดิม และ PNG แนบได้อีกครั้ง", async () => {
      const h = (await get(U.admin, "/api/admin/settings/history?pageSize=1")).json.data[0];
      expect(h.section === "attachments", h.label);
      expectStatus(await post(U.admin, `/api/admin/settings/history/${h.id}/revert`), 200);
      const now = (await get(U.admin, "/api/admin/settings")).json.settings.attachments;
      expect(JSON.stringify(now) === JSON.stringify(cur.attachments), JSON.stringify(now));
      if (cur.attachments.kinds.includes("png")) {
        const ok = await sendFiles([png()]);
        expectStatus(ok, 201);
        ids.attLeave = ok.json.id;
      }
    });
  }

  section("15. ลบผู้ใช้ (admin)");
  await t("UD-01", "ลบผู้ใช้ที่มีประวัติลา (teacherA) → 409 HAS_HISTORY", async () => expectStatus(await del(U.admin, "/api/admin/usermanagement/delete-user", { user_id: U.ta.id }), 409));
  await t("UD-02", "ลบผู้ใช้ที่เคยสอนแทน (tmp) → 409", async () => {
    const r = await del(U.admin, "/api/admin/usermanagement/delete-user", { user_id: U.tmp.id });
    expect(r.status === 409 || (r.status === 200 && ids.subOnLeave), show(r));
  });
  await t("UD-03", "ลบผู้ใช้ที่ไม่มีประวัติ (norole) → 200 และหายจากระบบ", async () => {
    expectStatus(await del(U.admin, "/api/admin/usermanagement/delete-user", { user_id: U.none.id }), 200);
    const { data } = await admin.auth.admin.getUserById(U.none.id);
    expect(!data?.user, "auth user ยังอยู่");
  });
  await t("UD-04", "session ของผู้ใช้ที่ถูกลบ → 401/403", async () => {
    const r = await get(U.none, "/api/me");
    expect(r.status === 401 || r.status === 403, show(r));
  });

  /* -------------------------------------------------------------- 16. ความปลอดภัยฐานข้อมูล */
  section("16. ความปลอดภัย (Supabase โดยตรงด้วย anon key)");
  for (const table of ["leaverequest", "users", "userrole"]) {
    await t(`SEC-${table}`, `anon key อ่านตาราง ${table} ตรงๆ ไม่ได้`, async () => {
      const r = await fetch(`${SUPA_URL}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
      const body = await r.json().catch(() => null);
      const leaked = r.status === 200 && Array.isArray(body) && body.length > 0;
      expect(!leaked, `HTTP ${r.status} อ่านได้ ${Array.isArray(body) ? body.length : 0} แถว (RLS ยังไม่เปิด)`);
    });
  }
  await t("SEC-write", "anon key เขียนตาราง holiday ตรงๆ ไม่ได้", async () => {
    const r = await fetch(`${SUPA_URL}/rest/v1/holiday`, {
      method: "POST",
      headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ holiday_name: `${TEST_PREFIX}anon-write`, holiday_date: "2030-03-03" }),
    });
    expect(r.status >= 400, `HTTP ${r.status} — anon key เขียนข้อมูลได้`);
  });
  await t("SEC-login-user", "ผู้ใช้ที่ล็อกอินแล้ว (token ของ user) อ่าน leaverequest ของคนอื่นตรงๆ ไม่ได้", async () => {
    const sb = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword({ email: U.tb.email, password: PW });
    const { data } = await sb.from("leaverequest").select("leave_request_id, user_id").eq("user_id", U.ta.id);
    expect(!data || data.length === 0, `อ่านใบลาของ teacherA ได้ ${data.length} แถว`);
  });
  await t("SEC-storage", "anon อ่านไฟล์แนบตรงๆ (ไม่ผ่าน signed URL) ไม่ได้", async () => {
    const key = JSON.parse((await admin.from("leaverequest").select("file").eq("leave_request_id", ids.L1).single()).data.file)[0];
    const r = await fetch(`${SUPA_URL}/storage/v1/object/public/leave-attachments/${key}`);
    expect(r.status >= 400, `HTTP ${r.status} — bucket เป็น public`);
  });
  await t("SEC-headers", "API ไม่เปิดเผย stack/ข้อความ error ภายใน (ลองส่ง id ใหญ่เกิน int)", async () => {
    const r = await get(U.ta, "/api/user/leave-history/99999999999999999999");
    expect(r.status < 500 && !/stack|at \w+ \(/.test(r.text), show(r));
  });

  /* -------------------------------------------------------------- 17. ออกจากระบบ */
  section("17. ออกจากระบบ");
  await t("LO-01", "logout → ลบ cookie และ session ใช้ไม่ได้อีก (signOut global)", async () => {
    const r = await post(U.multi, "/api/auth/logout");
    expectStatus(r, 200);
    const me = await get(U.multi, "/api/me");
    expect(me.status === 401, `หลัง logout /api/me → ${me.status}`);
  });
} catch (e) {
  results.push({ id: "FATAL", group: current, name: "สคริปต์หยุดกลางทาง", result: "FAIL", note: String(e?.stack || e) });
  console.error("FATAL", e);
} finally {
  section("ล้างข้อมูลทดสอบ");
  if (settingsSnapshot) {
    const restored = await restoreSettings(settingsSnapshot).catch((e) => [`restore ERROR ${e.message}`]);
    console.log(restored.map((l) => `  ตั้งค่า: ${l}`).join("\n"));
  }
  const log = await cleanup().catch((e) => [`cleanup ERROR ${e.message}`]);
  console.log(log.map((l) => "  " + l).join("\n"));

  // สรุปเวลา
  const byPath = new Map();
  for (const x of timings) {
    if (x.status >= 400) continue;
    const k = `${x.method} ${x.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":uuid").replace(/\/\d+(\/|$)/g, "/:id$1")}`;
    const e = byPath.get(k) ?? { n: 0, total: 0, max: 0 };
    e.n++;
    e.total += x.ms;
    e.max = Math.max(e.max, x.ms);
    byPath.set(k, e);
  }
  const perf = [...byPath].map(([k, v]) => ({ endpoint: k, n: v.n, avg: Math.round(v.total / v.n), max: Math.round(v.max) })).sort((a, b) => b.avg - a.avg);

  const summary = {
    run: RUN,
    base: BASE,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    totals: {
      PASS: results.filter((r) => r.result === "PASS").length,
      WARN: results.filter((r) => r.result === "WARN").length,
      FAIL: results.filter((r) => r.result === "FAIL").length,
      requests: timings.length,
    },
    results,
    perf,
    cleanup: log,
  };
  const out = path.join(ROOT, "tests", "e2e", "last-run.json");
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\nสรุป: PASS ${summary.totals.PASS} / WARN ${summary.totals.WARN} / FAIL ${summary.totals.FAIL} (${timings.length} requests) → ${path.relative(ROOT, out)}`);
}
