"use client";

import { CheckCircle, HistoryIcon, LayoutDashboard } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";

export default function DirectorLeaveSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <AppSidebar
      title="ผู้อำนวยการ"
      subtitle="อนุมัติการลา"
      gradient="from-blue-600 to-indigo-600"
      pendingLabel="รออนุมัติ"
      pendingCount={pendingCount}
      menus={[
        { title: "อนุมัติการลา", icon: CheckCircle, href: "/leave-approve", badge: pendingCount },
        { title: "ประวัติการอนุมัติ", icon: HistoryIcon, href: "/approved-history" },
        { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      ]}
      footer="ระบบอนุมัติการลา v1.0.0"
    />
  );
}
