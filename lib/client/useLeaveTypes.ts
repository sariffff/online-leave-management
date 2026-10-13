"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { LeaveTypeWithRule } from "@/types/db";

// โหลดครั้งเดียวต่อการเปิดเว็บ (ผู้ดูแลแก้ประเภทการลาแล้ว ผู้ใช้เห็นค่าใหม่เมื่อรีเฟรชหน้า)
const cache = new Map<string, Promise<LeaveTypeWithRule[]>>();

/** ประเภทการลาพร้อมกฎ เรียงตามที่ตั้งไว้ — includeInactive ใช้กับตัวกรองประวัติ */
export function useLeaveTypes(includeInactive = false): LeaveTypeWithRule[] {
  const [types, setTypes] = useState<LeaveTypeWithRule[]>([]);
  useEffect(() => {
    const key = includeInactive ? "all" : "active";
    let p = cache.get(key);
    if (!p) {
      p = apiFetch<{ items: LeaveTypeWithRule[] }>(`/api/leave-types${includeInactive ? "?all=1" : ""}`)
        .then((r) => r.items)
        .catch(() => {
          cache.delete(key);
          return [] as LeaveTypeWithRule[];
        });
      cache.set(key, p);
    }
    let alive = true;
    p.then((t) => alive && setTypes(t));
    return () => {
      alive = false;
    };
  }, [includeInactive]);
  return types;
}
