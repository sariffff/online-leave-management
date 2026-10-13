"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, X, Clock } from "lucide-react";

export type MenuItem = { title: string; href: string; badge?: number };
export type MenuGroup = {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  href?: string;
  items?: MenuItem[];
  badge?: number;
};

type Props = {
  title: string;
  subtitle: string;
  /** เช่น "from-blue-600 to-indigo-600" */
  gradient: string;
  menus: MenuGroup[];
  /** ถ้าไม่ส่ง จะไม่แสดงกล่อง "รอดำเนินการ" */
  pendingLabel?: string;
  pendingCount?: number;
  footer?: string;
};

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** sidebar กลางของทุกบทบาท — แต่ละบทบาทกำหนดแค่ menus (เดิมเป็นไฟล์ซ้ำ 5 ไฟล์ ไฟล์ละ 150–300 บรรทัด) */
export default function AppSidebar({ title, subtitle, gradient, menus, pendingLabel, pendingCount = 0, footer }: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const isActive = useCallback((href?: string) => !!href && pathname === href, [pathname]);
  const isParentActive = useCallback(
    (items: MenuItem[] = []) => items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)),
    [pathname]
  );

  // เปิดกลุ่มเมนูที่มีหน้าปัจจุบันอยู่ข้างในอัตโนมัติ
  useEffect(() => {
    const open = menus.filter((m) => m.items?.length && isParentActive(m.items)).map((m) => m.title);
    if (open.length) setExpanded((prev) => [...new Set([...prev, ...open])]);
  }, [menus, isParentActive]);

  useEffect(() => {
    const onResize = () => window.innerWidth >= 640 && setIsOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = (t: string) => setExpanded((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const close = () => setIsOpen(false);

  return (
    <>
      <button
        className="fixed z-50 p-2 bg-white rounded-lg shadow-lg top-4 left-4 sm:hidden"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={close} aria-hidden="true" />}

      <aside
        aria-label={`เมนูหลัก (${title})`}
        className={`fixed sm:relative ${isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"} transition-transform duration-300 ease-in-out w-64 shrink-0 bg-white border-r border-gray-200 shadow-lg sm:shadow-none z-40 h-screen overflow-hidden flex flex-col`}
      >
        <div className={`flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r ${gradient}`}>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-sm text-blue-100">{subtitle}</p>
        </div>

        {pendingLabel && (
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-700">{pendingLabel}</span>
              </div>
              <Badge count={pendingCount} />
            </div>
          </div>
        )}

        <nav className="flex-1 p-2 overflow-y-auto" aria-label="เมนูหลัก">
          <ul className="space-y-1">
            {menus.map((menu) => {
              const Icon = menu.icon;
              const hasSub = !!menu.items?.length;
              const open = expanded.includes(menu.title);
              const active = isActive(menu.href) || isParentActive(menu.items);
              const activeCls = "bg-blue-50 text-blue-700 border-l-4 border-blue-500";
              const idleCls = "text-gray-700 hover:bg-gray-50";

              return (
                <li key={menu.title}>
                  {hasSub ? (
                    <>
                      <button
                        onClick={() => toggle(menu.title)}
                        aria-expanded={open}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 text-left ${active ? activeCls : idleCls}`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="font-medium">{menu.title}</span>
                        </span>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {open && (
                        <ul className="pl-4 mt-1 ml-4 space-y-1 border-l-2 border-gray-100">
                          {menu.items!.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={close}
                                className={`flex items-center justify-between p-2 text-sm rounded-md transition-all duration-200 ${isActive(item.href) ? "bg-blue-100 text-blue-700 font-medium border-l-2 border-blue-500" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                              >
                                <span>{item.title}</span>
                                {!!item.badge && item.badge > 0 && <Badge count={item.badge} />}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={menu.href ?? "#"}
                      onClick={close}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${active ? activeCls : idleCls}`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="font-medium">{menu.title}</span>
                      </span>
                      {!!menu.badge && menu.badge > 0 && <Badge count={menu.badge} />}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
            <div className="px-4 py-3 text-xs text-center text-gray-500">{footer}</div>
          </div>
        )}
      </aside>
    </>
  );
}
