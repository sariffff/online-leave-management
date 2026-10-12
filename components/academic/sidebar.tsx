// components/academic/sidebar.tsx
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  ClipboardList,
  CalendarDays,
  Clock,
} from "lucide-react";

type MenuItem = { title: string; href: string; badge?: number };
type MenuGroup = {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  items: MenuItem[];
  badge?: number;
};

interface Props {
  /** จำนวนคำขอลาที่ต้องจัดการ (optional) */
  pendingCount?: number;
}

const AcademicSidebar = ({ pendingCount = 0 }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const pathname = usePathname();

  const menus: MenuGroup[] = useMemo(
    () => [
      {
        title: "รายการลา",
        icon: ClipboardList,
        href: "/leavetable", // ถ้าต้องการใช้ /academic/leavetable ให้เปลี่ยนที่นี่
        badge: pendingCount,
        items: [],
      },
       {
        title: "ประวัติการสอนแทน",
        icon: ClipboardList,
        href: "/substitution-history", // ถ้าต้องการใช้ /academic/leavetable ให้เปลี่ยนที่นี่
        items: [],
      },
      {
        title: "ตารางสอน",
        icon: CalendarDays,
        href: "/schedule", // หรือ /academic/schedule
        items: [],
      },
    ],
    [pendingCount]
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  }, []);

  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const isActive = useCallback((href?: string) => !!href && pathname === href, [pathname]);
  const isParentActive = useCallback(
    (items: MenuItem[]) =>
      items.some(
        (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))
      ),
    [pathname]
  );

  useEffect(() => {
    const shouldExpand = menus
      .filter((m) => m.items?.length > 0 && isParentActive(m.items))
      .map((m) => m.title);
    if (shouldExpand.length) {
      setExpandedSections((prev) => Array.from(new Set([...prev, ...shouldExpand])));
    }
  }, [menus, pathname, isParentActive]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setIsOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const Badge = ({ count }: { count: number }) => (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
      {count > 99 ? "99+" : count}
    </span>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed z-50 p-2 bg-white rounded-lg shadow-lg left-4 top-4 sm:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-40 h-screen w-64 translate-x-0 overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-transform duration-300 ease-in-out sm:relative sm:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        }`}
        aria-label="เมนูหลัก (Academic)"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600">
          <h2 className="text-lg font-bold text-white">ฝ่ายวิชาการ</h2>
          <p className="text-sm text-blue-100">จัดการลา / สอนแทน</p>
        </div>

        {/* Quick Stats */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">รอดำเนินการ</span>
            </div>
            <Badge count={pendingCount} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-1">
            {menus.map((menu, idx) => {
              const Icon = menu.icon;
              const hasSub = menu.items.length > 0;
              const expanded = expandedSections.includes(menu.title);
              const active = isActive(menu.href) || isParentActive(menu.items);

              return (
                <li key={`m-${idx}`}>
                  {hasSub ? (
                    <>
                      <button
                        onClick={() => toggleSection(menu.title)}
                        aria-expanded={expanded}
                        className={`w-full rounded-lg p-3 text-left transition-all duration-200 ${
                          active
                            ? "border-l-4 border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center space-x-3">
                            <Icon size={18} />
                            <span className="font-medium">{menu.title}</span>
                          </span>
                          <span className="flex items-center space-x-2">
                            {menu.badge && menu.badge > 0 && <Badge count={menu.badge} />}
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                        </span>
                      </button>
                      {expanded && (
                        <ul className="pl-4 mt-1 ml-4 space-y-1 border-l-2 border-gray-100">
                          {menu.items.map((item, j) => (
                            <li key={`mi-${idx}-${j}`}>
                              <Link
                                href={item.href}
                                onClick={closeSidebar}
                                className={`flex items-center justify-between rounded-md p-2 text-sm transition-all duration-200 ${
                                  isActive(item.href)
                                    ? "border-l-2 border-indigo-500 bg-indigo-100 font-medium text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }`}
                              >
                                <span>{item.title}</span>
                                {item.badge && item.badge > 0 && <Badge count={item.badge} />}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={menu.href || "#"}
                      onClick={closeSidebar}
                      className={`flex items-center justify-between rounded-lg p-3 transition-all duration-200 ${
                        active
                          ? "border-l-4 border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center space-x-3">
                        <Icon size={18} />
                        <span className="font-medium">{menu.title}</span>
                      </span>
                      {menu.badge && menu.badge > 0 && <Badge count={menu.badge} />}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default AcademicSidebar;
