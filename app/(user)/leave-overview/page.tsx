// app/user/leave/overview/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import UserSidebar from "@/components/user/UserSidebar";

type SummaryItem = {
  leave_type_id: number;
  name: string;
  note: string | null;
  max_leave_day: number | null;
  carry_over_max: number | null;
  used: number;
  remaining: number;
  reserved: number;
  total: number;
  available: number;
  percentUsed: number;
};

type SummaryRes = {
  ok: boolean;
  userId: string;
  year: number;
  items: SummaryItem[];
  error?: string;
};

const DEBUG = process.env.NODE_ENV !== "production";

// ปีงบปัจจุบัน (ค.ศ.) — ต.ค.–ธ.ค. นับเป็น FY ถัดไป
function currentFY(): number {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 10 ? y + 1 : y;
}
const CEtoBE = (y: number) => y + 543;

export default function LeaveOverviewPage() {
  // เริ่มที่ปีงบปัจจุบัน (ค.ศ.)
  const [year, setYear] = useState<number>(currentFY());
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  // สร้างรายการปี (ค.ศ.) 5 ปีล่าสุด — แสดงเป็น พ.ศ.
  const yearOptions = useMemo(() => {
    const base = currentFY();
    return Array.from({ length: 5 }, (_, i) => base - i);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(
        `/api/user/leave-quota?scope=summary&year=${year}${DEBUG ? "&debug=1" : ""}`,
        { cache: "no-store" }
      );
      const json: SummaryRes = await res.json().catch(() => ({ ok: false } as any));

      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `HTTP_${res.status}`);
      }

      setItems(json.items ?? []);
    } catch (e: any) {
      console.error(e);
      setItems([]);
      setErr(e?.message || "FETCH_FAILED");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBarColor = (item: SummaryItem) => {
    if (item.total <= 0) return "bg-gray-400";
    const percent = (item.used / item.total) * 100;
    if (item.available <= 0) return "bg-gray-400";
    if (percent >= 90) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ภาพรวมการลา</h2>
              <p className="mt-1 text-sm text-gray-600">
                แสดงจำนวนวันลาคงเหลือของแต่ละประเภท (อิงจากปีงบประมาณ)
              </p>
              <p className="mt-1 text-xs text-gray-500">
                ปีงบที่เลือก: {CEtoBE(year)} (ช่วง 1 ต.ค. {CEtoBE(year - 1)} – 30 ก.ย. {CEtoBE(year)})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">ปีงบ (พ.ศ.)</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-2 py-1 text-sm bg-white border rounded-md"
                title="เลือกปีงบ (พ.ศ.)"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{CEtoBE(y)}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">กำลังโหลดข้อมูล…</div>
          ) : err ? (
            <div className="space-y-2">
              <div className="text-sm text-red-600">เกิดข้อผิดพลาด: {err}</div>
              <button
                onClick={fetchData}
                className="px-3 py-1 text-sm bg-white border rounded-md hover:bg-gray-50"
              >
                ลองใหม่
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">ไม่พบข้อมูล</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const percent = item.total > 0 ? (item.used / item.total) * 100 : 0;
                const safeWidth = Math.min(100, Math.max(0, percent));
                const barColor = getBarColor(item);

                return (
                  <div key={item.leave_type_id} className="p-4 bg-white rounded-lg shadow">
                    <h3 className="mb-2 font-semibold text-gray-800">{item.name}</h3>

                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        ใช้แล้ว {item.used}/{item.total}
                      </span>
                      <span className="text-xs text-gray-500">
                        คงเหลือ {item.remaining}
                        {item.reserved > 0 ? ` (กันไว้ ${item.reserved})` : ""}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-200 rounded-full">
                      <div
                        className={`${barColor} h-2 rounded-full transition-all`}
                        style={{ width: `${safeWidth}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>พร้อมใช้ {item.available}</span>
                      <span>{item.percentUsed.toFixed(0)}%</span>
                    </div>

                    {item.note ? (
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">{item.note}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
