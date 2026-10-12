"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Home,
  History,
  FileText,
  User,
  Book,
  Menu,
  LayoutDashboard,
  X,
} from "lucide-react";

const UserSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const pathname = usePathname();

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const menus = [
    {
      title: "หน้าแรก",
      icon: Home,
      href: "/",
      items: []
    },
    {
      title: "การลา",
      icon: FileText,
      href: "/leave-page",
      items: [
        // { title: "หน้าแรก", href: "/leave" },
        // { title: "ยื่นใบลา", href: "/leave/request" },
      ]
    },
    {
      title: "ประวัติการลา",
      icon: History,
      href: "/leave-history",
      items: [
        // { title: "ประวัติเวลาลาของฉัน", href: "/attendance/history" }
      ]
    },
    {
      title: "วันลาคงเหลือ",
      icon: History,
      href: "/leave-overview",
      items: [
        // { title: "ประวัติเวลาลาของฉัน", href: "/attendance/history" }
      ]
    },
    {
      title: "dashboard",
      icon: LayoutDashboard,
      href: "/dashbord-user",
      items: [
        // { title: "หน้าแรก", href: "/leave" },
        // { title: "ยื่นใบลา", href: "/leave/request" },
      ]
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  const isParentActive = (items: { href: string }[]) => {
    return items.some(item => pathname.startsWith(item.href));
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed z-50 p-2 bg-white rounded-md shadow-md sm:hidden top-4 left-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed sm:relative
          ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
          transition-transform duration-300 ease-in-out
          w-64 bg-white h-full border-r border-gray-200 shadow-lg sm:shadow-none
          z-40 flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h2 className="text-lg font-bold text-white">ระบบการลา</h2>
          <p className="text-sm text-blue-100">สำหรับบุคลากร</p>
        </div>

        {/* Menu Items - Scrollable */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-1">
            {menus.map((menu, idx) => {
              const Icon = menu.icon;
              const hasSubmenu = menu.items.length > 0;
              const isExpanded = expandedSections.includes(menu.title);
              const isMenuActive = isActive(menu.href) || isParentActive(menu.items);

              return (
                <li key={idx}>
                  {hasSubmenu ? (
                    <>
                      {/* Parent menu with submenu */}
                      <button
                        onClick={() => toggleSection(menu.title)}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200
                          ${isMenuActive 
                            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon size={18} />
                          <span className="font-medium">{menu.title}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      {/* Submenu */}
                      {isExpanded && (
                        <ul className="pl-4 mt-1 ml-4 space-y-1 border-l-2 border-gray-100">
                          {menu.items.map((item, subIdx) => (
                            <li key={subIdx}>
                              <Link
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={`
                                  block p-2 rounded-md transition-all duration-200 text-sm
                                  ${isActive(item.href)
                                    ? 'bg-blue-100 text-blue-700 font-medium border-l-2 border-blue-500'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                    /* Single menu item */
                    <Link
                      href={menu.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        flex items-center space-x-3 p-3 rounded-lg transition-all duration-200
                        ${isActive(menu.href)
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon size={18} />
                      <span className="font-medium">{menu.title}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-center text-gray-500">
            <p>© 2025 School Management</p>
            <p>Version 1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default UserSidebar;