import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import Sidebar from "@/components/admin/sidebar";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login");
    redirect("/403");
  }
  return <div> {children}
</div>
}
