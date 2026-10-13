// ทดสอบอัตโนมัติแบบ "ดูได้" — เปิดเบราว์เซอร์จริงบนจอ คลิก/พิมพ์เหมือนคน เดินครบขั้นตอนการลาทุกบทบาท
// ใช้:  npx next start -p 3100   แล้ว   npm run test:demo
//   DEMO_HEADLESS=1  ไม่เปิดหน้าต่าง (เช่นบนเซิร์ฟเวอร์)      DEMO_SLOWMO=400  ปรับความช้า (ms)
// ผลลัพธ์: tests/ui/demo-output/report.html (ภาพทุกขั้น + วิดีโอแต่ละบทบาท) — เปิดให้อัตโนมัติเมื่อจบ
// ข้อมูลทดสอบ: บัญชี e2e-demo-*@example.com + ใบลา __test__ — ลบทิ้งเองเมื่อจบ
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const BASE = process.env.BASE || "http://localhost:3100";
const HEADLESS = process.env.DEMO_HEADLESS === "1";
const SLOWMO = Number(process.env.DEMO_SLOWMO ?? 350);
const RUN = Date.now().toString(36);
const PW = `Demo-${RUN}-Pw!`;
const PREFIX = "__test__";
const OUT = path.join(ROOT, "tests", "ui", "demo-output");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ROLE_ID = { admin: 1, user: 2, supervisor: 3, director: 4, academic: 5 };

// วันลาทดสอบ: จันทร์ 16 พ.ย. 2569 (มีคาบสอน คาบ 1) — ไม่ใช่วันหยุด
const LEAVE_DATE = "2026-11-16";
const REASON = `${PREFIX}ไข้หวัด ทดสอบอัตโนมัติ (${RUN})`;

/* ---------------- บันทึกผล ---------------- */
const steps = [];
let shotNo = 0;
const log = (msg) => console.log(`\x1b[36m▶\x1b[0m ${msg}`);
async function step(page, role, title, fn) {
  const t0 = Date.now();
  log(`[${role}] ${title}`);
  try {
    const note = await fn();
    const file = `${String(++shotNo).padStart(2, "0")}-${role}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    steps.push({ role, title, ok: true, note: note ?? "", ms: Date.now() - t0, file });
    console.log(`  \x1b[32m✔ ผ่าน\x1b[0m ${note ?? ""}`);
  } catch (e) {
    const file = `${String(++shotNo).padStart(2, "0")}-${role}-FAIL.png`;
    await page.screenshot({ path: path.join(OUT, file) }).catch(() => {});
    steps.push({ role, title, ok: false, note: String(e?.message ?? e).split("\n")[0].slice(0, 300), ms: Date.now() - t0, file });
    console.log(`  \x1b[31m✘ ไม่ผ่าน\x1b[0m ${e?.message?.split("\n")[0]}`);
    throw e;
  }
}
const expectVisible = async (locator, msg, timeout = 15000) => {
  try {
    // เลือกเฉพาะที่มองเห็น (หน้าเดียวมีทั้งเวอร์ชันมือถือ/เดสก์ท็อป ซ่อนไว้อย่างใดอย่างหนึ่ง)
    await locator.filter({ visible: true }).first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`ไม่พบ: ${msg}`);
  }
};

/* ---------------- ข้อมูลทดสอบ ---------------- */
const U = {};
async function mkUser(label, roles, teacherGroup) {
  const email = `e2e-demo-${RUN}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const names = { teacher: "สมศรี", teacher2: "สมชาย", supervisor: "ธุรการ", director: "ผู้อำนวยการ", academic: "วิชาการ" };
  await admin.from("users").insert({ user_id: id, prename: "ครู", name: `${PREFIX}${names[label] ?? label}`, surname: "ทดสอบ", is_active: true });
  await admin.from("userrole").insert(roles.map((r) => ({ user_id: id, role_type_id: ROLE_ID[r] })));
  let teacherId = null;
  if (teacherGroup !== undefined) teacherId = (await admin.from("teacher").insert({ user_id: id, subject_group_id: teacherGroup }).select("teacher_id").single()).data.teacher_id;
  return { label, id, email, teacherId, display: `ครู${PREFIX}${names[label] ?? label} ทดสอบ` };
}
async function seed() {
  const sg = (await admin.from("subjectgroup").insert({ subject_group_name: `${PREFIX}กลุ่มสาระ DEMO ${RUN}` }).select("subject_group_id").single()).data.subject_group_id;
  U.teacher = await mkUser("teacher", ["user"], sg);
  U.teacher2 = await mkUser("teacher2", ["user"], sg);
  U.supervisor = await mkUser("supervisor", ["supervisor"]);
  U.director = await mkUser("director", ["director"]);
  U.academic = await mkUser("academic", ["academic"]);
  // ครูสมศรีสอนวันจันทร์ คาบ 1
  await admin.from("teachingschedule").insert({ teacher_id: U.teacher.teacherId, day_of_week: "1", period_number: 1, start_time: "08:00:00", end_time: "08:50:00" });
}
async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ids = data.users.filter((u) => /^e2e-demo-/.test(u.email ?? "")).map((u) => u.id);
  if (ids.length) {
    const tIds = ((await admin.from("teacher").select("teacher_id").in("user_id", ids)).data ?? []).map((t) => t.teacher_id);
    if (tIds.length) {
      const ts = ((await admin.from("teachingschedule").select("teaching_schedule_id").in("teacher_id", tIds)).data ?? []).map((r) => r.teaching_schedule_id);
      if (ts.length) await admin.from("substituteuserteaching").delete().in("teaching_schedule_id", ts);
      await admin.from("teachingschedule").delete().in("teacher_id", tIds);
    }
    for (const t of ["leaverequest", "userleavequota", "teacher", "userrole", "users"]) await admin.from(t).delete().in("user_id", ids);
    for (const id of ids) {
      const { data: files } = await admin.storage.from("leave-attachments").list(`public/${id}`);
      if (files?.length) await admin.storage.from("leave-attachments").remove(files.map((f) => `public/${id}/${f.name}`));
      await admin.auth.admin.deleteUser(id);
    }
  }
  await admin.from("subjectgroup").delete().like("subject_group_name", `${PREFIX}กลุ่มสาระ DEMO%`);
  return ids.length;
}
if (process.argv.includes("--cleanup")) {
  console.log("ลบบัญชีทดสอบ", await cleanup());
  process.exit(0);
}

/* ---------------- ขั้นตอนที่ใช้ซ้ำ ---------------- */
async function login(page, role, user) {
  await step(page, role, "เปิดหน้าเข้าสู่ระบบ แล้วพิมพ์อีเมล/รหัสผ่าน", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("อีเมล", { exact: true }).fill(user.email);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    // บัญชีมีบทบาทเดียว → หน้าเลือกบทบาทพาไปหน้าแรกของบทบาทเอง
    await page.waitForURL((u) => !/\/(login|select-role)$/.test(new URL(u).pathname), { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    return `เข้าสู่ระบบแล้ว → ${new URL(page.url()).pathname}`;
  });
}
async function logout(page, role) {
  await step(page, role, "ออกจากระบบจากเมนูผู้ใช้มุมขวาบน", async () => {
    await page.getByRole("button", { name: "เมนูผู้ใช้" }).click();
    await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
    await page.waitForURL(/\/login$/, { timeout: 15000 });
  });
}
async function newSession(browser, name, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    locale: "th-TH",
    recordVideo: { dir: path.join(OUT, "video-tmp"), size: opts.viewport ?? { width: 1366, height: 800 } },
    ...opts,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  return {
    page,
    async close() {
      const video = page.video();
      await ctx.close();
      if (video) {
        const target = path.join(OUT, `${name}.webm`);
        await video.saveAs(target).catch(() => {});
        await video.delete().catch(() => {});
      }
    },
  };
}

/* ---------------- รายงาน ---------------- */
function writeReport(meta) {
  const passed = steps.filter((s) => s.ok).length;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const roleTh = { user: "บุคลากร", supervisor: "ธุรการ", director: "ผอ.", academic: "วิชาการ", mobile: "มือถือ" };
  const videos = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ผลทดสอบอัตโนมัติ — ระบบลาออนไลน์</title>
<style>
body{font-family:system-ui,"Noto Sans Thai",sans-serif;margin:0;background:#f3f4f6;color:#111}
header{background:#2563eb;color:#fff;padding:20px}
main{max-width:1100px;margin:auto;padding:16px}
.sum{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.sum div{background:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 1px 2px #0001}
.ok{color:#059669}.bad{color:#dc2626}
.step{background:#fff;border-radius:12px;margin:12px 0;box-shadow:0 1px 2px #0001;overflow:hidden}
.step h3{margin:0;padding:12px 16px;font-size:16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #eee}
.step .meta{padding:8px 16px;font-size:13px;color:#555}
.step img{width:100%;display:block;cursor:zoom-in}
.tag{font-size:12px;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:2px 8px}
video{width:100%;border-radius:12px;background:#000}
.videos{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
</style></head><body>
<header><h1 style="margin:0;font-size:22px">ผลทดสอบอัตโนมัติ — ขั้นตอนการลาครบวงจร</h1>
<div>${esc(meta.startedAt)} · ${esc(BASE)}</div></header>
<main>
<div class="sum"><div>ผลรวม: <b class="${passed === steps.length && meta.completed ? "ok" : "bad"}">${passed}/${steps.length} ขั้นผ่าน</b></div>
<div>เวลา ${Math.round(meta.ms / 1000)} วินาที</div><div>ล้างข้อมูลทดสอบ: ${esc(meta.cleaned)} บัญชี</div></div>
${meta.error ? `<p class="bad">หยุดที่: ${esc(meta.error)}</p>` : ""}
<h2>วิดีโอแต่ละบทบาท</h2><div class="videos">${videos.map((v) => `<div><b>${esc(v.replace(".webm", ""))}</b><video src="${v}" controls preload="metadata"></video></div>`).join("")}</div>
<h2>ทุกขั้นตอน</h2>
${steps.map((s, i) => `<div class="step"><h3><span class="${s.ok ? "ok" : "bad"}">${s.ok ? "✔" : "✘"}</span> ${i + 1}. ${esc(s.title)} <span class="tag">${esc(roleTh[s.role] ?? s.role)}</span></h3>
<div class="meta">${esc(s.note)} · ${(s.ms / 1000).toFixed(1)} วินาที</div><a href="${s.file}" target="_blank"><img src="${s.file}" loading="lazy" alt=""></a></div>`).join("")}
</main></body></html>`;
  fs.writeFileSync(path.join(OUT, "report.html"), html);
  return path.join(OUT, "report.html");
}

/* ================================================================ MAIN */
fs.rmSync(OUT, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
fs.mkdirSync(OUT, { recursive: true });
const started = Date.now();
const meta = { startedAt: new Date().toLocaleString("th-TH"), completed: false, error: "", cleaned: 0, ms: 0 };
const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : SLOWMO });

try {
  log("เตรียมบัญชีทดสอบ 5 บัญชี (บุคลากร 2, ธุรการ, ผอ., วิชาการ) + ตารางสอน");
  await seed();

  /* ---------- 1) บุคลากรยื่นใบลา ---------- */
  {
    const s = await newSession(browser, "1-บุคลากร-ยื่นลา");
    const page = s.page;
    await login(page, "user", U.teacher);
    await step(page, "user", "เลือกเมนู \"การลา\" → เลือกประเภท \"ลาป่วย\"", async () => {
      await page.goto(`${BASE}/leave-page`);
      await page.getByRole("button", { name: /^ลาป่วย/ }).click();
      await expectVisible(page.getByText("กรอกข้อมูลการลา"), "ฟอร์มขั้นที่ 2");
    });
    await step(page, "user", `กรอกวันที่ลา ${LEAVE_DATE} และเหตุผล`, async () => {
      await page.getByLabel("วันที่เริ่มลา", { exact: true }).fill(LEAVE_DATE);
      await page.getByLabel("วันที่สิ้นสุดการลา", { exact: true }).fill(LEAVE_DATE);
      await page.getByPlaceholder("โปรดระบุเหตุผลการลา...").fill(REASON);
      await expectVisible(page.getByText("1 วัน", { exact: true }), "ระบบคำนวณจำนวนวันลา = 1 วัน");
      return "ระบบคำนวณจำนวนวันลา = 1 วัน";
    });
    await step(page, "user", "กด \"ถัดไป\" → ตรวจสอบข้อมูล", async () => {
      await page.getByRole("button", { name: "ถัดไป" }).click();
      await expectVisible(page.getByText("ตรวจสอบข้อมูลและยืนยัน"), "หน้าตรวจสอบข้อมูล");
    });
    await step(page, "user", "กด \"ยืนยันส่งใบลา\"", async () => {
      await page.getByRole("button", { name: "ยืนยันส่งใบลา" }).click();
      await expectVisible(page.getByText("ส่งใบลาเรียบร้อยแล้ว"), "ข้อความส่งสำเร็จ");
      return "ส่งสำเร็จ";
    });
    await step(page, "user", "เปิด \"ประวัติการลา\" → เห็นใบลาสถานะ \"รอพิจารณา\"", async () => {
      await page.getByRole("link", { name: "ดูประวัติการลา" }).click();
      await page.waitForURL(/leave-history/);
      const row = page.locator("tr", { hasText: "ลาป่วย" }).filter({ hasText: "รอพิจารณา" });
      await expectVisible(row, "แถวใบลาสถานะรอพิจารณา");
    });
    await logout(page, "user");
    await s.close();
  }

  /* ---------- 2) ธุรการตรวจสอบ ---------- */
  {
    const s = await newSession(browser, "2-ธุรการ-ตรวจสอบ");
    const page = s.page;
    await login(page, "supervisor", U.supervisor);
    await step(page, "supervisor", "ค้นหาใบลาของครูสมศรีในคิว \"รอตรวจสอบ\"", async () => {
      await page.getByPlaceholder("ค้นหา...").fill(`${PREFIX}สมศรี`);
      await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
      await expectVisible(page.locator("tr", { hasText: `${PREFIX}สมศรี` }), "ใบลาของครูสมศรี");
      const badge = await page.locator("#app-sidebar").getByText(/^\d+$/).first().textContent();
      return `ตัวเลขรอตรวจบนเมนู = ${badge}`;
    });
    await step(page, "supervisor", "กด \"ตรวจสอบ\" → ใส่หมายเหตุ → กด \"ผ่าน\"", async () => {
      await page.locator("tr", { hasText: `${PREFIX}สมศรี` }).getByRole("button", { name: "ตรวจสอบ" }).click();
      const dlg = page.getByRole("dialog");
      await expectVisible(dlg.getByText(REASON), "รายละเอียดใบลาในหน้าต่าง");
      await dlg.getByRole("textbox").fill("เอกสารครบถ้วน");
      await dlg.getByRole("button", { name: "ผ่าน", exact: true }).click();
      await expectVisible(page.getByText("ผ่านเรียบร้อย"), "แจ้งเตือนผ่านเรียบร้อย");
    });
    await logout(page, "supervisor");
    await s.close();
  }

  /* ---------- 3) ผอ.อนุมัติ ---------- */
  {
    const s = await newSession(browser, "3-ผอ-อนุมัติ");
    const page = s.page;
    await login(page, "director", U.director);
    await step(page, "director", "ค้นหาใบลาในคิว \"รออนุมัติ\"", async () => {
      await page.getByPlaceholder("ค้นหา...").fill(`${PREFIX}สมศรี`);
      await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
      await expectVisible(page.locator("tr", { hasText: `${PREFIX}สมศรี` }), "ใบลาที่ธุรการตรวจแล้ว");
    });
    await step(page, "director", "กด \"พิจารณา\" → กด \"อนุมัติ\"", async () => {
      await page.locator("tr", { hasText: `${PREFIX}สมศรี` }).getByRole("button", { name: "พิจารณา" }).click();
      const dlg = page.getByRole("dialog");
      await expectVisible(dlg.getByText("เอกสารครบถ้วน"), "หมายเหตุของธุรการ");
      await dlg.getByRole("button", { name: "อนุมัติ", exact: true }).click();
      await expectVisible(page.getByText("อนุมัติเรียบร้อย"), "แจ้งเตือนอนุมัติเรียบร้อย");
    });
    await step(page, "director", "เปิด \"แดชบอร์ด\" ดูสถิติ", async () => {
      await page.getByRole("link", { name: "แดชบอร์ด" }).click();
      await page.waitForURL(/dashboard/);
      await expectVisible(page.getByText("สถิติสรุปการลา"), "หน้าแดชบอร์ด");
      await page.waitForLoadState("networkidle");
    });
    await logout(page, "director");
    await s.close();
  }

  /* ---------- 4) วิชาการจัดสอนแทน ---------- */
  {
    const s = await newSession(browser, "4-วิชาการ-จัดสอนแทน");
    const page = s.page;
    await login(page, "academic", U.academic);
    await step(page, "academic", "ค้นหาใบลาที่อนุมัติแล้ว → กด \"จัดสอนแทน\"", async () => {
      await page.getByPlaceholder("ค้นหา...").fill(`${PREFIX}สมศรี`);
      await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
      await page.locator("tr", { hasText: `${PREFIX}สมศรี` }).getByRole("button", { name: "จัดสอนแทน" }).click();
      await expectVisible(page.getByRole("dialog").getByText("คาบ 1"), "ตารางสอนคาบ 1 วันจันทร์");
      return "พบคาบที่ต้องสอนแทน 1 คาบ";
    });
    await step(page, "academic", "กด \"เลือกครูสอนแทน\" → เลือกครูสมชาย → \"มอบหมาย\"", async () => {
      await page.getByRole("dialog").getByRole("button", { name: "เลือกครูสอนแทน" }).last().click();
      const assign = page.getByRole("dialog").filter({ hasText: "มอบหมาย" }).last();
      await assign.getByRole("combobox").click();
      await page.getByRole("option", { name: new RegExp(`${PREFIX}สมชาย`) }).click();
      await assign.getByRole("button", { name: "มอบหมาย", exact: true }).click();
      await expectVisible(page.getByText("มอบหมายครูสอนแทนแล้ว"), "แจ้งเตือนมอบหมายสำเร็จ");
    });
    await step(page, "academic", "ครบทุกคาบ → กด \"✓ เสร็จสิ้น\"", async () => {
      await page.getByRole("button", { name: "✓ เสร็จสิ้น" }).click();
      await expectVisible(page.getByText("ปิดงานสอนแทนเรียบร้อย"), "แจ้งเตือนปิดงาน");
    });
    await logout(page, "academic");
    await s.close();
  }

  /* ---------- 5) บุคลากรเห็นผลบนมือถือ ---------- */
  {
    const phone = devices["iPhone 13"];
    const s = await newSession(browser, "5-มือถือ-ดูผล", { ...phone, viewport: phone.viewport, locale: "th-TH" });
    const page = s.page;
    await login(page, "mobile", U.teacher);
    await step(page, "mobile", "บนมือถือ: กดปุ่ม ☰ เปิดเมนู", async () => {
      await page.getByRole("button", { name: "เปิดเมนู" }).click();
      await expectVisible(page.locator("#app-sidebar").getByText("ประวัติการลา"), "เมนูลิ้นชัก");
    });
    await step(page, "mobile", "เลือก \"ประวัติการลา\" → เห็นการ์ดสถานะ \"อนุมัติ (จัดสอนแทนแล้ว)\"", async () => {
      await page.locator("#app-sidebar").getByRole("link", { name: "ประวัติการลา" }).click();
      await page.waitForURL(/leave-history/);
      await expectVisible(page.locator("li", { hasText: "ลาป่วย" }).filter({ hasText: "จัดสอนแทนแล้ว" }), "การ์ดใบลาสถานะจัดสอนแทนแล้ว");
      const w = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
      if (w > 1) throw new Error(`หน้ากว้างเกินจอ ${w}px`);
      return "ไม่มีส่วนล้นจอแนวนอน";
    });
    await step(page, "mobile", "กด \"ดู / แก้ไข\" → เห็นรายละเอียดและหมายเหตุ", async () => {
      await page.locator("li", { hasText: "จัดสอนแทนแล้ว" }).getByRole("button", { name: "ดู / แก้ไข" }).first().click();
      await expectVisible(page.getByRole("dialog").getByText("เอกสารครบถ้วน"), "หมายเหตุในรายละเอียด");
    });
    await s.close();
  }
  meta.completed = true;
} catch (e) {
  meta.error = String(e?.message ?? e).split("\n")[0];
} finally {
  await browser.close();
  // ล้างข้อมูลทดสอบก่อนเสมอ แล้วค่อยเก็บกวาดไฟล์ (Windows อาจล็อกไฟล์วิดีโอไว้ชั่วครู่)
  meta.cleaned = await cleanup().catch(() => "ล้มเหลว");
  try {
    fs.rmSync(path.join(OUT, "video-tmp"), { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    /* ปล่อยไว้ได้ */
  }
  meta.ms = Date.now() - started;
  const report = writeReport(meta);
  const passed = steps.filter((s) => s.ok).length;
  console.log(`\nสรุป: ${passed}/${steps.length} ขั้นผ่าน${meta.completed ? " — ครบทุกขั้นตอน" : ` — หยุดที่: ${meta.error}`}`);
  console.log(`รายงาน: ${report}`);
  if (!HEADLESS && process.platform === "win32") exec(`start "" "${report}"`);
  process.exitCode = meta.completed ? 0 : 1;
}
