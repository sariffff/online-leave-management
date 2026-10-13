"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

export type Counts = { review: number | null; approve: number | null; cover: number | null };

type NavState = {
  /** เมนูด้านข้างบนจอเล็ก (< lg) เปิดอยู่หรือไม่ */
  open: boolean;
  setOpen: (v: boolean) => void;
  /** หน้านี้มีเมนูด้านข้างหรือไม่ (header จะแสดงปุ่ม ☰ เฉพาะเมื่อมี) */
  hasNav: boolean;
  setHasNav: (v: boolean) => void;
  counts: Counts;
  /** เรียกหลังตรวจ/อนุมัติ/ปิดงาน เพื่ออัปเดตตัวเลขบนเมนูทันที */
  refreshCounts: () => void;
};

const Ctx = createContext<NavState | null>(null);
const EMPTY: Counts = { review: null, approve: null, cover: null };

export function NavProvider({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasNav, setHasNav] = useState(false);
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [tick, setTick] = useState(0);
  const pathname = usePathname();

  // เปลี่ยนหน้าแล้วปิดเมนูบนมือถือ
  useEffect(() => setOpen(false), [pathname]);

  // ตัวเลขงานที่รอ: โหลดเมื่อเปลี่ยนหน้า/กลับมาที่แท็บ/ทุก 2 นาที
  useEffect(() => {
    if (!signedIn || !hasNav) return;
    const ac = new AbortController();
    apiFetch<Counts>("/api/me/counts", { signal: ac.signal })
      .then(setCounts)
      .catch(() => undefined);
    return () => ac.abort();
  }, [signedIn, hasNav, pathname, tick]);

  useEffect(() => {
    if (!signedIn) return;
    const bump = () => setTick((t) => t + 1);
    const id = window.setInterval(bump, 120_000);
    window.addEventListener("focus", bump);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", bump);
    };
  }, [signedIn]);

  // ล็อกการเลื่อนหน้าข้างหลังขณะเปิดเมนูบนมือถือ + ปิดด้วย Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const refreshCounts = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo(
    () => ({ open, setOpen, hasNav, setHasNav, counts, refreshCounts }),
    [open, hasNav, counts, refreshCounts]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNav ต้องอยู่ภายใน NavProvider");
  return v;
}
