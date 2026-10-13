"use client";

import { CalendarDays, ClipboardList, History } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";
import { useNav } from "@/components/shell/NavContext";

export default function AcademicSidebar() {
  const { counts } = useNav();
  return (
    <AppSidebar
      title="ฝ่ายวิชาการ"
      subtitle="จัดการลา / สอนแทน"
      gradient="from-indigo-600 to-blue-600"
      pendingLabel="รอจัดสอนแทน"
      pendingCount={counts.cover}
      menus={[
        { title: "รายการลา", icon: ClipboardList, href: "/leavetable", badge: counts.cover },
        { title: "ประวัติการสอนแทน", icon: History, href: "/substitution-history" },
        { title: "ตารางสอน", icon: CalendarDays, href: "/schedule" },
      ]}
    />
  );
}
