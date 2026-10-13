"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Clock, X } from "lucide-react";
import { useNav } from "@/components/shell/NavContext";
import { usePublicSettings } from "@/components/shell/SettingsContext";

export type MenuItem = { title: string; href: string; badge?: number | null };
export type MenuGroup = {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  href?: string;
  items?: MenuItem[];
  badge?: number | null;
};

type Props = {
  title: string;
  subtitle: string;
  menus: MenuGroup[];
  /** ถ้าไม่ส่ง จะไม่แสดงกล่อง "รอดำเนินการ" */
  pendingLabel?: string;
  pendingCount?: number | null;
  /** ข้อความท้ายเมนู — ไม่ส่งจะใช้ค่าจากการตั้งค่าระบบ */
  footer?: string;
};

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium text-white bg-red-500 rounded-full">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * เมนูด้านข้างของทุกบทบาท
 *  - จอ ≥ lg (1024px): แสดงค้างด้านซ้าย
 *  - จอเล็กกว่า: เป็นลิ้นชักเลื่อนออกมา เปิดจากปุ่ม ☰ ใน header (ผ่าน NavContext)
 */
export default function AppSidebar({ title, subtitle, menus, pendingLabel, pendingCount, footer }: Props) {
  const pathname = usePathname();
  const { open, setOpen, setHasNav } = useNav();
  const { general } = usePublicSettings();
  const footerText = footer ?? general.footerText;
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    setHasNav(true);
    return () => setHasNav(false);
  }, [setHasNav]);

  const isActive = useCallback((href?: string) => !!href && pathname === href, [pathname]);
  const isParentActive = useCallback(
    (items: MenuItem[] = []) => items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)),
    [pathname]
  );

  // เปิดกลุ่มเมนูที่มีหน้าปัจจุบันอยู่ข้างในอัตโนมัติ
  useEffect(() => {
    const groups = menus.filter((m) => m.items?.length && isParentActive(m.items)).map((m) => m.title);
    if (groups.length) setExpanded((prev) => [...new Set([...prev, ...groups])]);
  }, [menus, isParentActive]);

  const toggle = (t: string) => setExpanded((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const activeCls = "bg-blue-50 text-blue-700 font-semibold";
  const idleCls = "text-gray-700 hover:bg-gray-100";

  return (
    <>
      {/* พื้นหลังมืดตอนเปิดเมนูบนจอเล็ก */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        aria-label={`เมนูหลัก (${title})`}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out
          lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:border-r lg:border-gray-200 lg:shadow-none
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-2 p-4 shrink-0 bg-linear-to-r from-(--brand) to-(--brand-to)">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{title}</h2>
            <p className="text-sm truncate text-white/80">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 -mr-1 text-white rounded-md hover:bg-white/20 lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X size={20} />
          </button>
        </div>

        {pendingLabel && (
          <div className="shrink-0 p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg shadow-sm">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock size={16} className="text-blue-500" />
                {pendingLabel}
              </span>
              {pendingCount === null || pendingCount === undefined ? (
                <span className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
              ) : (
                <Badge count={pendingCount} />
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 p-2 overflow-y-auto" aria-label="เมนูหลัก">
          <ul className="space-y-1">
            {menus.map((menu) => {
              const Icon = menu.icon;
              const hasSub = !!menu.items?.length;
              const isOpen = expanded.includes(menu.title);
              const active = isActive(menu.href) || isParentActive(menu.items);

              return (
                <li key={menu.title}>
                  {hasSub ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggle(menu.title)}
                        aria-expanded={isOpen}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? activeCls : idleCls}`}
                      >
                        <span className="flex items-center min-w-0 gap-3">
                          <Icon size={18} className="shrink-0" />
                          <span className="truncate">{menu.title}</span>
                        </span>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {isOpen && (
                        <ul className="mt-1 ml-5 space-y-1 border-l-2 border-gray-100 pl-3">
                          {menu.items!.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${isActive(item.href) ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
                              >
                                <span className="truncate">{item.title}</span>
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
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors ${active ? activeCls : idleCls}`}
                    >
                      <span className="flex items-center min-w-0 gap-3">
                        <Icon size={18} className="shrink-0" />
                        <span className="truncate">{menu.title}</span>
                      </span>
                      {!!menu.badge && menu.badge > 0 && <Badge count={menu.badge} />}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {footerText && <div className="px-4 py-3 text-xs text-center text-gray-500 border-t border-gray-200 shrink-0 bg-gray-50">{footerText}</div>}
      </aside>
    </>
  );
}
