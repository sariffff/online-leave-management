"use client";

import { FileText, History, Home, LayoutDashboard, Wallet } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";

export default function UserSidebar() {
  return (
    <AppSidebar
      title="ระบบการลา"
      subtitle="สำหรับบุคลากร"
      menus={[
        { title: "หน้าแรก", icon: Home, href: "/" },
        { title: "การลา", icon: FileText, href: "/leave-page" },
        { title: "ประวัติการลา", icon: History, href: "/leave-history" },
        { title: "วันลาคงเหลือ", icon: Wallet, href: "/leave-overview" },
        { title: "แดชบอร์ด", icon: LayoutDashboard, href: "/dashbord-user" },
      ]}
    />
  );
}
