// ตรวจหน้าจอจริงด้วยเบราว์เซอร์ (Playwright) — ทุกบทบาท ทุกหน้า 3 ขนาดจอ
// ใช้:  npx next start -p 3100   แล้ว   node tests/ui/audit.mjs
// เก็บ: console error, page error, API ที่ล้มเหลว, เนื้อหาล้นแนวนอน, หน้าที่เลื่อนซ้อน 2 ชั้น + ภาพหน้าจอ (tests/ui/screens/)
// ข้อมูลทดสอบ: บัญชี e2e-ui-*@example.com และใบลา __test__ — ลบทิ้งเองเมื่อจบ
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const BASE = process.env.BASE || "http://localhost:3100";
// ตรวจเฉพาะหน้าที่มีข้อความนี้ใน path เช่น AUDIT_ONLY=settings (ไม่ใส่ = ทุกหน้า; ใน Git Bash อย่าใส่ / นำหน้า)
const ONLY = process.env.AUDIT_ONLY || "";
const RUN = Date.now().toString(36);
const PW = `Ui-${RUN}-Pw!`;
const PREFIX = "__test__";
const SHOTS = path.join(ROOT, "tests", "ui", "screens");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ROLE_ID = { admin: 1, user: 2, supervisor: 3, director: 4, academic: 5 };

const VIEWPORTS = { desktop: { width: 1366, height: 800 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } };
const PAGES = {
  admin: ["/settings", "/settings?tab=leaveTypes", "/settings?tab=periods", "/settings?tab=attachments", "/settings?tab=history", "/user-management", "/classroom-management", "/holiday-management", "/level-management", "/schedule-management", "/semester-management", "/subjectgroup-management", "/subject-management", "/year-management"],
  user: ["/leave-page", "/leave-history", "/leave-overview", "/dashbord-user"],
  supervisor: ["/reviewed-page", "/reviewed-history"],
  director: ["/leave-approve", "/approved-history", "/dashboard"],
  academic: ["/leavetable", "/schedule", "/substitution-history"],
};

/* ---------------- ข้อมูลทดสอบ ---------------- */
const U = {};
async function mkUser(label, roles, teacherGroup) {
  const email = `e2e-ui-${RUN}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  await admin.from("users").insert({ user_id: id, prename: "นาย", name: `${PREFIX}${label}`, surname: "ทดสอบหน้าจอ", is_active: true });
  if (roles.length) await admin.from("userrole").insert(roles.map((r) => ({ user_id: id, role_type_id: ROLE_ID[r] })));
  let teacherId = null;
  if (teacherGroup !== undefined) teacherId = (await admin.from("teacher").insert({ user_id: id, subject_group_id: teacherGroup }).select("teacher_id").single()).data.teacher_id;
  return { label, id, email, teacherId };
}
async function cookieOf(u) {
  const jar = new Map();
  const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (all) => all.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await sb.auth.signInWithPassword({ email: u.email, password: PW });
  if (error) throw new Error(`login ${u.label}: ${error.message}`);
  return [...jar].map(([name, value]) => ({ name, value }));
}
async function seed() {
  const sg = (await admin.from("subjectgroup").insert({ subject_group_name: `${PREFIX}กลุ่มสาระ UI ${RUN}` }).select("subject_group_id").single()).data.subject_group_id;
  U.admin = await mkUser("admin", ["admin"]);
  U.sup = await mkUser("supervisor", ["supervisor"]);
  U.dir = await mkUser("director", ["director"]);
  U.aca = await mkUser("academic", ["academic"]);
  U.ta = await mkUser("teacher", ["user"], sg);
  U.tb = await mkUser("teacher2", ["user"], sg);
  U.multi = await mkUser("multi", ["user", "supervisor", "director", "academic", "admin"]);
  // ตารางสอน จ–ศ คาบ 1–2
  await admin.from("teachingschedule").insert(
    [1, 2, 3, 4, 5].flatMap((d) => [1, 2].map((p) => ({ teacher_id: U.ta.teacherId, day_of_week: String(d), period_number: p, start_time: p === 1 ? "08:00:00" : "08:50:00", end_time: p === 1 ? "08:50:00" : "09:40:00" })))
  );
  const now = new Date().toISOString();
  const leave = (user, type, s, e, days, status, extra = {}) => ({
    user_id: user.id, leave_type_id: type, date_start: s, date_end: e, date_start_type: "เต็มวัน", date_end_type: "เต็มวัน",
    total_day: days, reason: `${PREFIX}เหตุผลการลาที่ค่อนข้างยาวเพื่อทดสอบการตัดบรรทัดในตารางและหน้าต่างรายละเอียด`, status, year: 2027, ...extra,
  });
  const rev = { reviewed_by: U.sup.id, reviewed_at: now, comment: "เอกสารครบ" };
  const appr = { ...rev, approved_by: U.dir.id, approved_at: now };
  await admin.from("leaverequest").insert([
    leave(U.ta, 1, "2026-11-16", "2026-11-17", 2, "pending"),
    leave(U.ta, 2, "2026-11-19", "2026-11-19", 1, "reviewed", rev),
    leave(U.ta, 1, "2026-11-23", "2026-11-24", 2, "approved", appr),
    leave(U.ta, 3, "2026-11-02", "2026-11-03", 2, "covered", appr),
    leave(U.ta, 1, "2026-10-20", "2026-10-20", 1, "rejected", { ...appr, comment: "ไม่อนุมัติ" }),
    leave(U.ta, 2, "2026-10-26", "2026-10-26", 1, "failed", { ...rev, comment: "แนบเอกสารเพิ่ม" }),
    leave(U.tb, 1, "2026-11-30", "2026-12-01", 2, "pending"),
  ]);
}
async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ids = data.users.filter((u) => /^e2e-ui-/.test(u.email ?? "")).map((u) => u.id);
  if (ids.length) {
    const tIds = ((await admin.from("teacher").select("teacher_id").in("user_id", ids)).data ?? []).map((t) => t.teacher_id);
    if (tIds.length) await admin.from("teachingschedule").delete().in("teacher_id", tIds);
    for (const t of ["leaverequest", "userleavequota", "teacher", "userrole", "users"]) await admin.from(t).delete().in("user_id", ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
  await admin.from("subjectgroup").delete().like("subject_group_name", `${PREFIX}กลุ่มสาระ UI%`);
  return ids.length;
}
if (process.argv.includes("--cleanup")) {
  console.log("ลบผู้ใช้ทดสอบ", await cleanup());
  process.exit(0);
}

/* ---------------- ตรวจหน้า ---------------- */
const findings = [];
async function inspect(page, vpName) {
  return page.evaluate((vw) => {
    const doc = document.scrollingElement;
    const overflowX = doc.scrollWidth - window.innerWidth;
    const pageScrollY = doc.scrollHeight - window.innerHeight;
    // องค์ประกอบที่ล้นขอบขวาของจอ (ไม่นับที่อยู่ในกล่องเลื่อนแนวนอน)
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(cs.overflowX) && p.getBoundingClientRect().right <= vw + 1) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (clipped || getComputedStyle(el).position === "fixed") continue;
      const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : ""}`;
      wide.push(`${label} (กว้างถึง ${Math.round(r.right)}px) "${(el.textContent || "").trim().slice(0, 30)}"`);
      if (wide.length >= 5) break;
    }
    // ข้อความที่เล็กเกินไปบนมือถือ / ปุ่มที่เล็กเกินกดได้สะดวก
    const tinyTap = [...document.querySelectorAll("button, a")].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 28 || r.width < 28);
    }).length;
    const h1 = document.querySelector("main h1, h1:not(header h1)")?.textContent?.trim() ?? "";
    return { overflowX, pageScrollY, wide, tinyTap, h1 };
  }, VIEWPORTS[vpName].width);
}

async function visit(ctx, role, url, vpName, extra = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) errors.push(`API ${r.status()} ${new URL(r.url()).pathname}`);
  });
  const name = `${role}${url.replace(/[/?=]/g, "_")}-${vpName}`;
  let status = 0;
  try {
    const res = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(600);
    const m = await inspect(page, vpName);
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

    // เปิดหน้าต่างรายละเอียดอันแรก (ถ้ามี)
    let modal = null;
    if (extra.openModal) {
      const btn = page.getByRole("button", { name: /ดูรายละเอียด|ดู \/ แก้ไข|ตรวจสอบ|พิจารณา|จัดสอนแทน|ดูตาราง|แก้ไข/ }).first();
      if (await btn.count()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(800);
        const dlg = page.locator("[role=dialog]").first();
        if (await dlg.count()) {
          const box = await dlg.boundingBox();
          modal = box ? { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.x), cutOff: box.x < 0 || box.x + box.width > VIEWPORTS[vpName].width + 1 || box.y < 0 } : null;
          await page.screenshot({ path: path.join(SHOTS, `${name}-modal.png`) });
          await page.keyboard.press("Escape");
        }
      }
    }
    // เมนูมือถือ
    if (extra.openMenu) {
      const menuBtn = page.getByRole("button", { name: "เปิดเมนู" });
      if (await menuBtn.count()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, `${name}-menu.png`) });
      }
    }
    findings.push({ role, url, vp: vpName, status, ...m, modal, errors: [...new Set(errors)] });
  } catch (e) {
    findings.push({ role, url, vp: vpName, status, errors: [...errors, `navigation: ${e.message.slice(0, 150)}`] });
  } finally {
    await page.close();
  }
}

fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) fs.unlinkSync(path.join(SHOTS, f));
const browser = await chromium.launch();
try {
  await seed();
  const users = { admin: U.admin, user: U.ta, supervisor: U.sup, director: U.dir, academic: U.aca };
  const host = new URL(BASE).hostname;
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    // หน้าที่ไม่ต้องล็อกอิน
    const anon = await browser.newContext({ viewport: vp, locale: "th-TH" });
    if (!ONLY || "/login".includes(ONLY)) await visit(anon, "public", "/login", vpName);
    await anon.close();
    // ผู้ใช้หลายบทบาท: หน้าเลือกบทบาท
    const multi = await browser.newContext({ viewport: vp, locale: "th-TH" });
    await multi.addCookies((await cookieOf(U.multi)).map((c) => ({ ...c, domain: host, path: "/" })));
    if (!ONLY || "/select-role".includes(ONLY)) await visit(multi, "multi", "/select-role", vpName);
    await multi.close();

    for (const [role, u] of Object.entries(users)) {
      const ctx = await browser.newContext({ viewport: vp, locale: "th-TH" });
      const cookies = await cookieOf(u);
      await ctx.addCookies([...cookies, { name: "active_role", value: String(ROLE_ID[role]) }].map((c) => ({ ...c, domain: host, path: "/" })));
      for (const p of PAGES[role].filter((x) => !ONLY || x.includes(ONLY))) await visit(ctx, role, p, vpName, { openModal: true, openMenu: vpName === "mobile" && p === PAGES[role][0] });
      if (role === "user" && !ONLY) await visit(ctx, role, "/", vpName);
      await ctx.close();
    }
    console.log(`ตรวจขนาด ${vpName} เสร็จ`);
  }
} finally {
  await browser.close();
  console.log("ลบข้อมูลทดสอบ:", await cleanup(), "บัญชี");
  fs.writeFileSync(path.join(ROOT, "tests", "ui", "last-audit.json"), JSON.stringify(findings, null, 2));
  const bad = findings.filter((f) => f.errors?.length || f.overflowX > 1 || f.pageScrollY > 1 || f.status >= 400 || f.modal?.cutOff);
  console.log(`หน้า×ขนาดจอที่ตรวจ ${findings.length}, มีปัญหา ${bad.length}`);
}
