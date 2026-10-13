"use client";

import { FileCheck, History } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";
import { useNav } from "@/components/shell/NavContext";

export default function SupervisorSidebar() {
  const { counts } = useNav();
  return (
    <AppSidebar
      title="ฝ่ายธุรการ"
      subtitle="ตรวจสอบการลา"
      gradient="from-blue-600 to-indigo-600"
      pendingLabel="รอตรวจสอบ"
      pendingCount={counts.review}
      menus={[
        { title: "ตรวจสอบการลา", icon: FileCheck, href: "/reviewed-page", badge: counts.review },
        { title: "ประวัติการตรวจสอบ", icon: History, href: "/reviewed-history" },
      ]}
      footer="ระบบตรวจสอบการลา v1.0.0"
    />
  );
}
