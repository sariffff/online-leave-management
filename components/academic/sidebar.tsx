"use client";

import { CalendarDays, ClipboardList } from "lucide-react";
import AppSidebar from "@/components/shared/AppSidebar";

export default function AcademicSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <AppSidebar
      title="ฝ่ายวิชาการ"
      subtitle="จัดการลา / สอนแทน"
      gradient="from-indigo-600 to-blue-600"
      pendingLabel="รายการลา"
      pendingCount={pendingCount}
      menus={[
        { title: "รายการลา", icon: ClipboardList, href: "/leavetable", badge: pendingCount },
        { title: "ประวัติการสอนแทน", icon: ClipboardList, href: "/substitution-history" },
        { title: "ตารางสอน", icon: CalendarDays, href: "/schedule" },
      ]}
    />
  );
}
