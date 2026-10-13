"use client";

import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/sidebar";
import UserSidebar from "@/components/user/UserSidebar";
import SupervisorSidebar from "@/components/supervisor/sidebar";
import DirectorLeaveSidebar from "@/components/director/sidebar";
import AcademicSidebar from "@/components/academic/sidebar";
import type { RoleName } from "@/lib/roles";

const SIDEBAR: Record<RoleName, () => ReactNode> = {
  admin: () => <AdminSidebar />,
  user: () => <UserSidebar />,
  supervisor: () => <SupervisorSidebar />,
  director: () => <DirectorLeaveSidebar />,
  academic: () => <AcademicSidebar />,
};

/**
 * กรอบหน้าของแต่ละบทบาท: เมนูด้านข้าง + พื้นที่เนื้อหาที่เลื่อนได้ในตัว
 * (อยู่ใน layout จึงไม่ถูกสร้างใหม่ทุกครั้งที่เปลี่ยนหน้า — เมนูที่กางไว้ไม่หุบ)
 */
export default function RoleShell({ role, children }: { role: RoleName | null; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0">
      {role ? SIDEBAR[role]() : null}
      <main id="main" className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
