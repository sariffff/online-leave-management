"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";

export type Params = Record<string, string | number | null | undefined>;

type PageResult<T> = { data?: T[]; items?: T[]; total?: number; totalPages?: number };

/** ข้อมูลหน้าแรกที่เซิร์ฟเวอร์ส่งมากับ HTML (ต้องตรงกับ params เริ่มต้น + หน้า 1 + pageSize เดียวกัน) */
export type InitialPage<T> = { data: T[]; total: number; totalPages: number };

/**
 * โหลดรายการแบบแบ่งหน้าจาก API (กรอง/แบ่งหน้าที่ฝั่ง DB)
 *  - มี `initial` → แสดงทันทีโดยไม่ยิง API ครั้งแรก ยิงเฉพาะเมื่อผู้ใช้กรอง/เปลี่ยนหน้า/รีโหลด
 *  - เปลี่ยน params → กลับไปหน้า 1 อัตโนมัติ
 *  - ยกเลิก request เก่าที่ยังไม่เสร็จ ป้องกันผลเก่าทับผลใหม่
 */
export function usePagedQuery<T>(endpoint: string, params: Params, pageSize = 10, enabled = true, initial?: InitialPage<T>) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>(initial?.data ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [totalPages, setTotalPages] = useState(initial?.totalPages ?? 1);
  const [loading, setLoading] = useState(initial ? false : enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const paramsKey = JSON.stringify(params);
  const prevKey = useRef(paramsKey);

  // key ของข้อมูลที่แสดงอยู่ตอนนี้ — ถ้า key ใหม่เท่ากับของเดิม ไม่ต้องโหลดซ้ำ
  const loadedKey = useRef<string | null>(initial ? JSON.stringify([endpoint, paramsKey, 1, pageSize, 0]) : null);

  useEffect(() => {
    if (prevKey.current !== paramsKey) {
      prevKey.current = paramsKey;
      setPage(1);
    }
  }, [paramsKey]);

  useEffect(() => {
    if (!enabled) return;
    const key = JSON.stringify([endpoint, paramsKey, page, pageSize, tick]);
    if (loadedKey.current === key) return;
    loadedKey.current = key;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(JSON.parse(paramsKey) as Params)) {
      if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
    }
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    setLoading(true);
    setError(null);
    apiFetch<PageResult<T>>(`${endpoint}?${qs}`, { signal: ac.signal })
      .then((res) => {
        const list = res.data ?? res.items ?? [];
        setRows(list);
        setTotal(res.total ?? list.length);
        setTotalPages(res.totalPages ?? 1);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRows([]);
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        setLoading(false);
      });

    return () => {
      ac.abort();
      loadedKey.current = null; // (รวมถึง StrictMode ที่ mount ซ้ำ) ให้รอบถัดไปโหลดใหม่ได้
    };
  }, [endpoint, paramsKey, page, pageSize, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { rows, total, totalPages, page, setPage, loading, error, reload };
}
