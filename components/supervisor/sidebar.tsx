"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FileCheck,
  History,
  Home,
  Menu,
  X,
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
  pendingCount?: number;
}

const AdminLeaveVerificationSidebar = ({ pendingCount: externalPendingCount }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(externalPendingCount || 0);
  const pathname = usePathname();

  // อัพเดท pendingCount เมื่อได้รับค่าใหม่จาก props
  useEffect(() => {
    if (externalPendingCount !== undefined) {
      setPendingCount(externalPendingCount);
    }
  }, [externalPendingCount]);

  const menus: MenuGroup[] = useMemo(
    () => [
      {
        title: "ตรวจสอบการลา",
        icon: FileCheck,
        badge: pendingCount,
        href: "/reviewed-page",
        items: [],
      },
      {
        title: "ประวัติการตรวจสอบ",
        icon: History,
        href: "/reviewed-history",
        items: [],
      },
    ],
    [pendingCount]
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

  const isActive = useCallback((href?: string) => {
    if (!href) return false;
    return pathname === href;
  }, [pathname]);

  const isParentActive = useCallback((items: MenuItem[]) => {
    return items.some((item) => {
      return pathname === item.href || 
             (item.href !== "/" && pathname.startsWith(item.href + "/"));
    });
  }, [pathname]);

  // Auto-expand parent menus when navigating
  useEffect(() => {
    const shouldExpand = menus
      .filter((menu) => menu.items?.length > 0)
      .filter((menu) => isParentActive(menu.items))
      .map((menu) => menu.title);
    
    if (shouldExpand.length > 0) {
      setExpandedSections((prev) => Array.from(new Set([...prev, ...shouldExpand])));
    }
  }, [pathname, menus, isParentActive]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const Badge = ({ count }: { count: number }) => (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );

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
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h2 className="text-lg font-bold text-white">ฝ่ายธุรการ</h2>
          <p className="text-sm text-blue-100">ตรวจสอบการลา</p>
        </div>

        {/* Quick Stats */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
            <div className="flex items-center space-x-2">
              <Clock size={16} className="text-orange-500" />
              <span className="text-sm font-medium text-gray-700">รอตรวจสอบ</span>
            </div>
            <Badge count={pendingCount} />
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-2 overflow-y-auto" aria-label="เมนูหลัก">
          <ul className="space-y-1">
            {menus.map((menu, idx) => {
              const Icon = menu.icon;
              const hasSubmenu = menu.items.length > 0;
              const isExpanded = expandedSections.includes(menu.title);
              const isMenuActive = isActive(menu.href) || isParentActive(menu.items);

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
                          ${isMenuActive
                            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <span className="flex items-center space-x-3">
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="font-medium">{menu.title}</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          {menu.badge && menu.badge > 0 && <Badge count={menu.badge} />}
                          {isExpanded ? (
                            <ChevronDown size={16} className="flex-shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="flex-shrink-0" />
                          )}
                        </div>
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
                                  flex items-center justify-between p-2 rounded-md transition-all duration-200 text-sm
                                  ${isActive(item.href)
                                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                                    : 'text-gray-700 hover:bg-gray-50'
                                  }
                                `}
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
                    /* Direct menu link */
                    <Link
                      href={menu.href || "#"}
                      onClick={closeSidebar}
                      className={`
                        flex items-center justify-between p-3 rounded-lg 
                        transition-all duration-200
                        ${isActive(menu.href)
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                            : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <span className="flex items-center space-x-3">
                        <Icon size={18} className="flex-shrink-0" />
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

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
          <div className="px-4 pb-3 text-xs text-center text-gray-500">
            <p>© 2025 Leave Management</p>
            <p>ระบบตรวจสอบการลา v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminLeaveVerificationSidebar;