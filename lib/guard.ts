// lib/guard.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerRSC } from "@/lib/supabaseServer";
import type { RoleName } from "@/lib/roles";
import { timed } from "@/lib/perf";

export type Role = { id: number; name: string };

export type GuardOK = {
  ok: true;
  status: 200;
  user: { id: string; email: string | null };
  profile: { prename: string | null; name: string | null; surname: string | null } | null;
  roles: Role[]; // บทบาททั้งหมดของผู้ใช้ (จาก DB)
  activeRole?: Role; // บทบาทที่เลือกจาก cookie (ใช้กับ UI เท่านั้น ห้ามใช้ authorize)
  supa: Awaited<ReturnType<typeof createSupabaseServerRSC>>;
};

export type GuardNG = { ok: false; status: number; message: string };
export type GuardResult = GuardOK | GuardNG;

type RoleRow = {
  role_type_id: number;
  roletype: { role_name: string | null } | { role_name: string | null }[] | null;
};

export type Profile = { prename: string | null; name: string | null; surname: string | null };

/**
 * cache สั้น ๆ ของ "บทบาท + สถานะบัญชี" ต่อผู้ใช้ (ในหน่วยความจำของ instance นั้น)
 * ลด query 2 ครั้งต่อทุก request — การเปลี่ยนบทบาท/ปิดบัญชีผ่านหน้า admin จะล้าง cache ทันที (invalidateGuardCache)
 * ส่วน instance อื่นจะเห็นการเปลี่ยนแปลงภายใน TTL
 */
const TTL_MS = 15_000;
type Cached = { at: number; roles: Role[]; active: boolean; profile: Profile | null };
const userCache = new Map<string, Cached>();

export function invalidateGuardCache(userId?: string) {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

async function loadUserInfo(supa: Awaited<ReturnType<typeof createSupabaseServerRSC>>, userId: string): Promise<Cached | { error: true }> {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;

  const [{ data: rows, error: roleErr }, profile] = await timed("auth.roles_db", () =>
    Promise.all([
      supa.from("userrole").select("role_type_id, roletype(role_name)").eq("user_id", userId),
      supa.from("users").select("is_active, prename, name, surname").eq("user_id", userId).maybeSingle(),
    ])
  );
  if (roleErr) return { error: true };

  const roles: Role[] = ((rows ?? []) as RoleRow[])
    .map((r) => {
      const rt = Array.isArray(r.roletype) ? r.roletype[0] : r.roletype;
      return { id: Number(r.role_type_id), name: String(rt?.role_name ?? "") };
    })
    .filter((r) => r.name.length > 0);

  const entry: Cached = {
    at: Date.now(),
    roles,
    active: profile.data?.is_active !== false,
    profile: profile.data ? { prename: profile.data.prename, name: profile.data.name, surname: profile.data.surname } : null,
  };
  if (userCache.size > 500) userCache.clear();
  userCache.set(userId, entry);
  return entry;
}

/**
 * ตรวจ session และดึงบทบาททั้งหมดจาก DB
 * ห่อด้วย React cache(): layout + page ใน request เดียวกันเรียกซ้ำได้โดยไม่ยิง Supabase ซ้ำ
 */
export const requireAuth = cache(async (): Promise<GuardResult> => {
  const supa = await createSupabaseServerRSC();

  const {
    data: { user },
    error,
  } = await timed("auth.getUser", () => supa.auth.getUser());

  if (error || !user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const [info, store] = await Promise.all([loadUserInfo(supa, user.id), cookies()]);
  if ("error" in info) return { ok: false, status: 500, message: "Role check failed" };

  // บัญชีที่ถูกปิดใช้งานต้องใช้งานต่อไม่ได้ แม้ session เดิมยังไม่หมดอายุ
  if (!info.active) return { ok: false, status: 403, message: "ACCOUNT_DISABLED" };

  const activeRoleCookie = store.get("active_role")?.value;
  const activeRole = info.roles.find((r) => String(r.id) === activeRoleCookie || r.name === activeRoleCookie);

  return {
    ok: true,
    status: 200,
    supa,
    user: { id: user.id, email: user.email ?? null },
    profile: info.profile,
    roles: info.roles,
    activeRole,
  };
});

/** ผู้ใช้ต้องมีอย่างน้อย 1 บทบาทที่อนุญาต (ตรวจจาก DB ไม่พึ่ง cookie) */
export async function requireRole(allowed: ReadonlyArray<RoleName | number | string>): Promise<GuardResult> {
  const base = await requireAuth();
  if (!base.ok) return base;

  const hasPermission = base.roles.some((r) => allowed.includes(r.id) || allowed.includes(r.name));
  if (!hasPermission) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return base;
}

export function hasRole(g: GuardOK, ...names: RoleName[]): boolean {
  return g.roles.some((r) => (names as string[]).includes(r.name));
}
