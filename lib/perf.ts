// ตัวจับเวลาแบบเบา ๆ — บอกว่าแต่ละ request ช้าตรงไหน (auth / query / signed URL / Google ฯลฯ)
//  - เปิดอัตโนมัติตอน `npm run dev`; ใน production เปิดด้วย PERF_LOG=1
//  - API: พิมพ์สรุปใน terminal และแนบ header `Server-Timing` (ดูในเบราว์เซอร์: F12 → Network → คลิก request → Timing)
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export const perfEnabled = process.env.PERF_LOG === "1" || process.env.NODE_ENV !== "production";

type Mark = { label: string; ms: number; count: number };
type Ctx = { marks: Map<string, Mark> };

const als = new AsyncLocalStorage<Ctx>();

function record(ctx: Ctx, label: string, ms: number) {
  const m = ctx.marks.get(label);
  if (m) {
    m.ms += ms;
    m.count += 1;
  } else {
    ctx.marks.set(label, { label, ms, count: 1 });
  }
}

/** จับเวลาของงานหนึ่งงาน; อยู่ใน request ที่ห่อด้วย runWithPerf จะถูกรวมในสรุปของ request นั้น */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - start;
    const ctx = als.getStore();
    if (ctx) record(ctx, label, ms);
    else console.log(`[perf] ${label} ${ms.toFixed(0)}ms`);
  }
}

export async function runWithPerf<T>(fn: () => Promise<T>): Promise<{ result: T; marks: Mark[] }> {
  const ctx: Ctx = { marks: new Map() };
  const result = await als.run(ctx, fn);
  return { result, marks: [...ctx.marks.values()] };
}

/**
 * จับเวลาหน้า (server component) ทั้งหน้า แล้วพิมพ์สรุปบรรทัดเดียว: "[perf] PAGE /leave-history total=…ms | …"
 * พิมพ์ทั้งกรณีปกติและกรณี throw (เช่น redirect())
 */
export async function perfPage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled) return fn();
  const ctx: Ctx = { marks: new Map() };
  const start = performance.now();
  try {
    return await als.run(ctx, fn);
  } finally {
    const total = performance.now() - start;
    console.log(`[perf] PAGE ${name} total=${total.toFixed(0)}ms | ${formatMarks([...ctx.marks.values()])}`);
  }
}

/** ข้อความสรุปสำหรับ log: "auth.getUser=70ms db.leaves=120ms(x2)" */
export function formatMarks(marks: Mark[]): string {
  return marks
    .sort((a, b) => b.ms - a.ms)
    .map((m) => `${m.label}=${m.ms.toFixed(0)}ms${m.count > 1 ? `(x${m.count})` : ""}`)
    .join(" ");
}

/** ค่าสำหรับ header Server-Timing */
export function serverTiming(total: number, marks: Mark[]): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return [`total;dur=${total.toFixed(1)}`, ...marks.map((m) => `${safe(m.label)};dur=${m.ms.toFixed(1)}`)].join(", ");
}
