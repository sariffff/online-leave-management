"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Users,
  BookOpen,
  School,
  Calendar,
  CalendarX,
  GraduationCap,
  FileText,
  Home,
  Settings,
  Menu,
  X,
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";

type MenuItem = { title: string; href: string };
type MenuGroup = {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  items: MenuItem[];
};

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const pathname = usePathname();

  const menus: MenuGroup[] = useMemo(
    () => [
      {
        title: "หน้าแรก",
        icon: Home,
        href: "/select-role",
        items: [],
      },
      {
        title: "จัดการบุคลากร",
        href: "/user-management",
        icon: Users,
        items: [],
      },
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
      {
        title: "จัดการตารางสอน",
        href: "/schedule-management",
        icon: Calendar,
        items: [],
      },
      {
        title: "ปีการศึกษา",
        icon: GraduationCap,
        items: [
          { title: "ชั้นปีการศึกษา", href: "/year-management" },
          { title: "ภาคเรียน", href: "/semester-management" },
        ],
      },
      {
        title: "จัดการการลา",
        href: "/leavetype-management",
        icon: FileText,
        items: [],
      },
    ],
    []
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const isActive = useCallback(
    (href?: string) => {
      if (!href) return false;
      return pathname === href;
    },
    [pathname]
  );

  const isParentActive = useCallback(
    (items: MenuItem[]) => {
      return items.some((item) => {
        // ตรวจสอบ exact match หรือ path ที่เริ่มต้นด้วย href (สำหรับ nested routes)
        return (
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"))
        );
      });
    },
    [pathname]
  );

  // Auto-expand parent menus when navigating
  useEffect(() => {
    const shouldExpand = menus
      .filter((menu) => menu.items?.length > 0)
      .filter((menu) => isParentActive(menu.items))
      .map((menu) => menu.title);

    if (shouldExpand.length > 0) {
      setExpandedSections((prev) =>
        Array.from(new Set([...prev, ...shouldExpand]))
      );
    }
  }, [pathname, menus, isParentActive]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        // sm breakpoint
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed z-50 p-2 bg-white rounded-lg shadow-lg top-4 left-4 sm:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed sm:relative
          ${isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
          transition-transform duration-300 ease-in-out
          w-64 bg-white border-r border-gray-200 shadow-lg sm:shadow-none z-40
          h-screen overflow-hidden
          flex flex-col
        `}
        aria-label="เมนูหลัก"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-lg font-bold text-white">Admin Panel</h2>
          <p className="text-sm text-blue-100">ระบบจัดการโรงเรียน</p>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-2 overflow-y-auto" aria-label="เมนูหลัก">
          <ul className="space-y-1">
            {menus.map((menu, idx) => {
              const Icon = menu.icon;
              const hasSubmenu = menu.items.length > 0;
              const isExpanded = expandedSections.includes(menu.title);
              const isMenuActive =
                isActive(menu.href) || isParentActive(menu.items);

              return (
                <li key={`menu-${idx}`}>
                  {hasSubmenu ? (
                    <>
                      {/* Parent menu with submenu */}
                      <button
                        onClick={() => toggleSection(menu.title)}
                        aria-expanded={isExpanded}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-lg 
                          transition-all duration-200 text-left
                          ${
                            isMenuActive
                              ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                        `}
                      >
                        <span className="flex items-center space-x-3">
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="font-medium">{menu.title}</span>
                        </span>
                        {isExpanded ? (
                          <ChevronDown size={16} className="flex-shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="flex-shrink-0" />
                        )}
                      </button>

                      {/* Submenu */}
                      {isExpanded && (
                        <ul className="pl-4 mt-1 ml-4 space-y-1 border-l-2 border-gray-100">
                          {menu.items.map((item, subIdx) => (
                            <li key={`submenu-${idx}-${subIdx}`}>
                              <Link
                                href={item.href}
                                onClick={closeSidebar}
                                className={`
                                  block p-2 rounded-md transition-all duration-200 text-sm
                                  ${
                                    isActive(item.href)
                                      ? "bg-blue-100 text-blue-700 font-medium border-l-2 border-blue-500"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }
                                `}
                              >
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    /* Direct menu link */
                    <Link
                      href={menu.href || "#"}
                      onClick={closeSidebar}
                      className={`
                        flex items-center space-x-3 p-3 rounded-lg 
                        transition-all duration-200
                        ${
                          isActive(menu.href)
                            ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                            : "text-gray-700 hover:bg-gray-50"
                        }
                      `}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <span className="font-medium">{menu.title}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
         
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
          <div className="px-4 pb-3 text-xs text-center text-gray-500">
            <p>© 2025 School Management</p>
            <p>Version 1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
