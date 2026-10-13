"use client";

import { FileCheck, History } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";

export default function SupervisorSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <AppSidebar
      title="ฝ่ายธุรการ"
      subtitle="ตรวจสอบการลา"
      gradient="from-blue-600 to-indigo-600"
      pendingLabel="รอตรวจสอบ"
      pendingCount={pendingCount}
      menus={[
        { title: "ตรวจสอบการลา", icon: FileCheck, href: "/reviewed-page", badge: pendingCount },
        { title: "ประวัติการตรวจสอบ", icon: History, href: "/reviewed-history" },
      ]}
      footer="ระบบตรวจสอบการลา v1.0.0"
    />
  );
}
