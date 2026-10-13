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
      pendingLabel="รอตรวจสอบ"
      pendingCount={counts.review}
      menus={[
        { title: "ตรวจสอบการลา", icon: FileCheck, href: "/reviewed-page", badge: counts.review },
        { title: "ประวัติการตรวจสอบ", icon: History, href: "/reviewed-history" },
      ]}
    />
  );
}
