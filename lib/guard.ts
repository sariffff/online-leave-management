// lib/guard.ts
import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerRSC } from "@/lib/supabaseServer";

type RoleRow = {
  role_type_id: number;
  roletype?: { role_name?: string | null };
};

export type Role = { id: number; name: string };

export type GuardOK = {
  ok: true;
  status: 200;
  user: { id: string; email: string | null };
  roles: Role[]; // บทบาททั้งหมดของผู้ใช้
  activeRole?: Role; // บทบาทที่ถูกเลือกจาก cookie (เพื่อ UI เท่านั้น)
  supa: Awaited<ReturnType<typeof createSupabaseServerRSC>>;
};

export type GuardNG = { ok: false; status: number; message: string };
export type GuardResult = GuardOK | GuardNG;

/** แค่ตรวจ session และดึงบทบาททั้งหมดจาก DB */
export async function requireAuth(): Promise<GuardResult> {
  const supa = await createSupabaseServerRSC(); // ถ้า fn นี้เป็น sync จะลบ await ได้

  const {
    data: { user },
    error,
  } = await supa.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const { data: rows, error: roleErr } = (await supa
    .from("userrole")
    .select("role_type_id, roletype(role_name)")
    .eq("user_id", user.id)) as unknown as {
    data: RoleRow[] | null;
    error: any;
  };

  if (roleErr) {
    return { ok: false, status: 500, message: "Role check failed" };
  }

  const roles: Role[] = (rows ?? [])
    .map((r) => ({
      id: Number(r.role_type_id),
      name: String(r.roletype?.role_name ?? ""),
    }))
    .filter((r) => r.name.length > 0);

  const store = await cookies(); // ✅ ต้อง await ใน Next 15
  const activeRoleCookie = store.get("active_role")?.value;
  const activeRole = roles.find(
    (r) => String(r.id) === activeRoleCookie || r.name === activeRoleCookie
  );

  return {
    ok: true,
    status: 200,
    supa,
    user: { id: user.id, email: user.email ?? null },
    roles,
    activeRole,
  };
}

/**
 * ตรวจสิทธิ์อย่างน้อย 1 บทบาทที่อนุญาต
 * - allowed รับได้ทั้ง role id (number) และ role name (string)
 * - ไม่พึ่ง cookie ในการ authorize
 */
export async function requireRole(
  allowed: Array<number | string>
): Promise<GuardResult> {
  const base = await requireAuth();
  if (!base.ok) return base;

  const hasPermission = base.roles.some(
    (r) => allowed.includes(r.id) || allowed.includes(r.name)
  );

  if (!hasPermission) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return base;
}
