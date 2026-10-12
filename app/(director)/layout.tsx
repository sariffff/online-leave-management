import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";

export default async function UserLayout({ children }: { children: ReactNode }) {
  const guard = await requireRole(["director"]);
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login");
    redirect("/403")
  }
  return <>{children}</>;
}
