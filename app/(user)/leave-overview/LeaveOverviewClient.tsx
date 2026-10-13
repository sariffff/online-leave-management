"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UserSidebar from "@/components/user/UserSidebar";
import { apiFetch } from "@/lib/client/api";
import { getFiscalYearFromISO } from "@/utils/year";

export type QuotaItem = {
  leave_type_id: number;
  name: string;
  note: string | null;
  unlimited: boolean;
  carried: number;
  total: number | null;
  used: number;
  reserved: number;
  remaining: number | null;
  available: number | null;
  percentUsed: number;
};

const toBE = (y: number) => y + 543;

function barColor(i: QuotaItem) {
  if (i.unlimited || !i.total) return "bg-gray-400";
  if ((i.available ?? 0) <= 0) return "bg-gray-400";
  return i.percentUsed >= 90 ? "bg-yellow-500" : "bg-green-500";
}

export default function LeaveOverviewClient({ initialYear, initialItems }: { initialYear: number; initialItems?: QuotaItem[] }) {
  const currentFY = useMemo(() => getFiscalYearFromISO(new Date().toISOString().slice(0, 10)), []);
  const [year, setYear] = useState(initialYear || currentFY);
  const [items, setItems] = useState<QuotaItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  // ข้อมูลที่แสดงอยู่ตรงกับปี+รอบนี้แล้ว (มาจากเซิร์ฟเวอร์) → ไม่ต้องโหลดซ้ำ
  const loadedKey = useRef<string | null>(initialItems ? `${initialYear}:0` : null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const yearOptions = useMemo(() => Array.from({ length: 5 }, (_, i) => currentFY - i), [currentFY]);

  useEffect(() => {
    if (loadedKey.current === `${year}:${tick}`) return;
    loadedKey.current = `${year}:${tick}`;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    apiFetch<{ items: QuotaItem[] }>(`/api/user/leave-quota?year=${year}`, { signal: ac.signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setItems([]);
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
    return () => {
      ac.abort();
      loadedKey.current = null;
    };
  }, [year, tick]);

  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ภาพรวมการลา</h2>
              <p className="mt-1 text-sm text-gray-600">แสดงจำนวนวันลาคงเหลือของแต่ละประเภท (อิงจากปีงบประมาณ)</p>
              <p className="mt-1 text-xs text-gray-500">
                ปีงบที่เลือก: {toBE(year)} (ช่วง 1 ต.ค. {toBE(year - 1)} – 30 ก.ย. {toBE(year)})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="fy" className="text-sm text-gray-600">ปีงบ (พ.ศ.)</label>
              <select id="fy" value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-2 py-1 text-sm bg-white border rounded-md">
                {yearOptions.map((y) => <option key={y} value={y}>{toBE(y)}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 bg-white rounded-lg shadow animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="space-y-2">
              <div className="text-sm text-red-600">เกิดข้อผิดพลาด: {error}</div>
              <button onClick={() => setTick((t) => t + 1)} className="px-3 py-1 text-sm bg-white border rounded-md hover:bg-gray-50">ลองใหม่</button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">ไม่พบข้อมูล</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.leave_type_id} className="p-4 bg-white rounded-lg shadow">
                  <h3 className="mb-2 font-semibold text-gray-800">{item.name}</h3>

                  {item.unlimited ? (
                    <p className="text-sm text-gray-600">
                      ไม่จำกัดจำนวนวัน • ใช้แล้ว <span className="font-semibold">{item.used}</span> วัน
                      {item.reserved > 0 ? ` (รออนุมัติ ${item.reserved})` : ""}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">ใช้แล้ว {item.used}/{item.total}</span>
                        <span className="text-xs text-gray-500">
                          คงเหลือ {item.remaining}
                          {item.reserved > 0 ? ` (รออนุมัติ ${item.reserved})` : ""}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full">
                        <div className={`${barColor(item)} h-2 rounded-full transition-all`} style={{ width: `${item.percentUsed}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>
                          ลาได้อีก {item.available}
                          {item.carried > 0 ? ` • สะสมจากปีก่อน ${item.carried}` : ""}
                        </span>
                        <span>{item.percentUsed.toFixed(0)}%</span>
                      </div>
                    </>
                  )}

                  {item.note ? <p className="mt-2 text-xs leading-relaxed text-gray-500">{item.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
