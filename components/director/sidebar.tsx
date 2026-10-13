"use client";

import { CheckCircle, HistoryIcon, LayoutDashboard } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";
import { useNav } from "@/components/shell/NavContext";

export default function DirectorLeaveSidebar() {
  const { counts } = useNav();
  return (
    <AppSidebar
      title="ผู้อำนวยการ"
      subtitle="อนุมัติการลา"
      pendingLabel="รออนุมัติ"
      pendingCount={counts.approve}
      menus={[
        { title: "อนุมัติการลา", icon: CheckCircle, href: "/leave-approve", badge: counts.approve },
        { title: "ประวัติการอนุมัติ", icon: HistoryIcon, href: "/approved-history" },
        { title: "แดชบอร์ด", icon: LayoutDashboard, href: "/dashboard" },
      ]}
    />
  );
}
