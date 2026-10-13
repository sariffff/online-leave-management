import "server-only";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import type { RoleName } from "@/lib/roles";
import { perfPage } from "@/lib/perf";
import RoleShell from "@/components/shell/RoleShell";

/** layout ของแต่ละกลุ่มหน้าตามบทบาท — ตรวจสิทธิ์จาก DB ทุกครั้งที่เข้าหน้า แล้วใส่กรอบหน้า (เมนู + เนื้อหา) ของบทบาทนั้น */
export async function RoleLayout({ roles, children }: { roles: RoleName[]; children: ReactNode }) {
  const guard = await perfPage(`LAYOUT [${roles.join(",")}]`, () => requireRole(roles));
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login");
    redirect("/403");
  }
  return <RoleShell role={roles[0]}>{children}</RoleShell>;
}
