"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { LeaveTypeRow } from "@/types/db";

let cache: Promise<LeaveTypeRow[]> | null = null;

export function useLeaveTypes(): LeaveTypeRow[] {
  const [types, setTypes] = useState<LeaveTypeRow[]>([]);
  useEffect(() => {
    cache ??= apiFetch<{ items: LeaveTypeRow[] }>("/api/leave-types", { cache: "force-cache" })
      .then((r) => r.items)
      .catch(() => {
        cache = null;
        return [] as LeaveTypeRow[];
      });
    let alive = true;
    cache.then((t) => alive && setTypes(t));
    return () => {
      alive = false;
    };
  }, []);
  return types;
}
