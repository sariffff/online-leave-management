import type { ReactNode } from "react";
import { RoleLayout } from "@/lib/roleLayout";
import { ROLE } from "@/lib/roles";

export default function Layout({ children }: { children: ReactNode }) {
  return <RoleLayout roles={[ROLE.user]}>{children}</RoleLayout>;
}
