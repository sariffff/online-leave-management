// lib/http.ts — ตัวห่อ API route: ตรวจสิทธิ์ + จัดการ error ที่เดียว
import "server-only";
import { NextResponse } from "next/server";
import { requireAuth, requireRole, type GuardOK } from "@/lib/guard";
import type { RoleName } from "@/lib/roles";
import { formatMarks, perfEnabled, runWithPerf, serverTiming, timed } from "@/lib/perf";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (msg = "BAD_REQUEST", detail?: unknown) => new HttpError(400, msg, detail);
export const notFound = (msg = "NOT_FOUND") => new HttpError(404, msg);
export const conflict = (msg = "CONFLICT", detail?: unknown) => new HttpError(409, msg, detail);

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, detail?: unknown) {
  return NextResponse.json(detail === undefined ? { error } : { error, detail }, { status });
}

export type RouteCtx<P> = { g: GuardOK; req: Request; url: URL; params: P };

/**
 * route(["admin"], async ({ g, req, params }) => json(...))
 *  - roles = "any" → ขอแค่ login แล้ว
 *  - HttpError ถูกแปลงเป็นสถานะที่เหมาะสม, error อื่นตอบ 500 โดยไม่เปิดเผยรายละเอียด
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  roles: readonly RoleName[] | "any",
  handler: (ctx: RouteCtx<P>) => Promise<Response> | Response
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const start = performance.now();
    const path = new URL(req.url).pathname;

    const { result: res, marks } = await runWithPerf(async () => {
      const g = await timed("auth", () => (roles === "any" ? requireAuth() : requireRole(roles)));
      if (!g.ok) return fail(g.status, g.message);

      try {
        const params = (ctx?.params ? await ctx.params : {}) as P;
        return await timed("handler", async () => handler({ g, req, url: new URL(req.url), params }));
      } catch (e) {
        if (e instanceof HttpError) {
          if (e.status < 500) return fail(e.status, e.message, e.detail);
          // 5xx: เก็บรายละเอียดไว้ใน log ฝั่งเซิร์ฟเวอร์ ไม่ส่งข้อความภายในของฐานข้อมูลให้เบราว์เซอร์
          console.error(`[api] ${req.method} ${path} ${e.status} ${e.message}`, e.detail ?? "");
          return fail(e.status, e.message);
        }
        console.error(`[api] ${req.method} ${path}`, e);
        return fail(500, "INTERNAL_ERROR");
      }
    });

    if (perfEnabled) {
      const total = performance.now() - start;
      console.log(`[perf] ${req.method} ${path} ${res.status} total=${total.toFixed(0)}ms | ${formatMarks(marks)}`);
      try {
        res.headers.set("Server-Timing", serverTiming(total, marks));
      } catch {
        /* headers เป็น immutable บน response บางแบบ — ข้ามได้ */
      }
    }
    return res;
  };
}

/** อ่าน JSON body แบบปลอดภัย */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest("INVALID_JSON");
  }
}
