import { redirect } from "next/navigation";
import HomeCalendar from "@/components/home/HomeCalendar";
import RoleShell from "@/components/shell/RoleShell";
import { requireAuth } from "@/lib/guard";
import { ROLE, type RoleName } from "@/lib/roles";

// หน้าแรก (ปฏิทินวันหยุด) — แสดงเมนูของบทบาทที่เลือกอยู่ เพื่อไม่ให้เมนูหายเมื่อกด "หน้าแรก"
export default async function HomePage() {
  const g = await requireAuth();
  if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");
  const name = g.activeRole?.name;
  const role = name && (Object.values(ROLE) as string[]).includes(name) ? (name as RoleName) : null;
  return (
    <RoleShell role={role}>
      <HomeCalendar />
    </RoleShell>
  );
}
