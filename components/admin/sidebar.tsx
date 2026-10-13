"use client";

import { BookOpen, Calendar, CalendarX, GraduationCap, Home, School, Settings, Users } from "lucide-react";
import AppSidebar, { type MenuGroup } from "@/components/shared/AppSidebar";

const MENUS: MenuGroup[] = [
  { title: "หน้าแรก", icon: Home, href: "/select-role" },
  { title: "จัดการบุคลากร", icon: Users, href: "/user-management" },
  {
    title: "จัดการหลักสูตร",
    icon: BookOpen,
    items: [
      { title: "กลุ่มสาระ", href: "/subjectgroup-management" },
      { title: "รายวิชา", href: "/subject-management" },
    ],
  },
  {
    title: "จัดการห้องเรียน",
    icon: School,
    items: [
      { title: "ระดับชั้น", href: "/level-management" },
      { title: "ห้องเรียน", href: "/classroom-management" },
    ],
  },
  { title: "จัดการตารางสอน", icon: Calendar, href: "/schedule-management" },
  { title: "จัดการวันหยุด", icon: CalendarX, href: "/holiday-management" },
  { title: "ตั้งค่าระบบ", icon: Settings, href: "/settings" },
  {
    title: "ปีการศึกษา",
    icon: GraduationCap,
    items: [
      { title: "ชั้นปีการศึกษา", href: "/year-management" },
      { title: "ภาคเรียน", href: "/semester-management" },
    ],
  },
];

export default function Sidebar() {
  return (
    <AppSidebar
      title="ผู้ดูแลระบบ"
      subtitle="จัดการข้อมูลและตั้งค่าระบบ"
      menus={MENUS}
    />
  );
}
