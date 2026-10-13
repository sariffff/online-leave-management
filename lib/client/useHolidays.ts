"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { holidayMapFrom, type HolidayMap } from "@/lib/leave/days";

type Item = { start: string; summary: string };

// cache ระดับ module: ปีเดียวกันเรียกเพียงครั้งเดียวต่อการเปิดหน้าเว็บ และรวม request ที่ซ้อนกัน
const yearCache = new Map<number, Promise<Item[]>>();

function loadYear(year: number): Promise<Item[]> {
  let p = yearCache.get(year);
  if (!p) {
    p = apiFetch<{ holidays: Item[] }>(`/api/holidays?year=${year}`, { cache: "force-cache" })
      .then((r) => r.holidays ?? [])
      .catch(() => {
        yearCache.delete(year); // ให้ลองใหม่ได้ครั้งถัดไป
        return [] as Item[];
      });
    yearCache.set(year, p);
  }
  return p;
}

/** วันหยุดของปีที่ระบุ (เช่น ปีของวันเริ่ม/วันสิ้นสุดใบลา) */
export function useHolidays(years: number[]): { map: HolidayMap; loading: boolean } {
  const key = [...new Set(years.filter((y) => y > 1900))].sort().join(",");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ys = key ? key.split(",").map(Number) : [];
    if (ys.length === 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(ys.map(loadYear)).then((lists) => {
      if (cancelled) return;
      setItems(lists.flat());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const map = useMemo(() => holidayMapFrom(items), [items]);
  return { map, loading };
}
