"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";

type Holiday = { start: string; summary: string; source: "google" | "school" };

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const pad = (n: number) => String(n).padStart(2, "0");

/** ช่องวันของเดือน (เติมช่องว่างให้ตรงวันในสัปดาห์) — คำนวณด้วย UTC กัน timezone เลื่อนวัน */
function buildDays(year: number, month: number) {
  const startDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function HomePage() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    apiFetch<{ holidays: Holiday[] }>(`/api/holidays?month=${ym.year}-${pad(ym.month)}`, { signal: ac.signal })
      .then((r) => setHolidays(r.holidays))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setHolidays([]);
        setError(e instanceof Error ? e.message : "โหลดวันหยุดไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [ym, tick]);

  const days = useMemo(() => buildDays(ym.year, ym.month), [ym]);
  const byDate = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) m.set(h.start, [...(m.get(h.start) ?? []), h]);
    return m;
  }, [holidays]);

  const shift = (delta: number) =>
    setYm(({ year, month }) => {
      const d = new Date(Date.UTC(year, month - 1 + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    });

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className="min-h-screen text-gray-900 bg-white">
      <main className="px-4 py-6 mx-auto space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">← เดือนก่อนหน้า</button>
            <button onClick={() => shift(1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">เดือนถัดไป →</button>
          </div>
          <div className="text-sm text-gray-600">
            ปฏิทิน <span className="font-medium text-gray-900">{MONTHS[ym.month - 1]} {ym.year + 543}</span>
          </div>
          <Link href="/leave-page" className="rounded-xl bg-[#4F8EF7] px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition">
            + ยื่นใบลา
          </Link>
        </div>

        {error && (
          <div className="flex items-center justify-between p-3 text-sm border rounded-xl border-amber-300 bg-amber-50 text-amber-800">
            <span>{error}</span>
            <button onClick={() => setTick((t) => t + 1)} className="px-2 py-1 text-xs border border-current rounded-lg hover:opacity-80">ลองโหลดใหม่</button>
          </div>
        )}

        <section className="p-4 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <div className="grid grid-cols-7 mb-2 text-xs text-center text-gray-500">
            {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => {
              const items = date ? byDate.get(date) ?? [] : [];
              return (
                <div key={date ?? `blank-${i}`} className={`relative min-h-[96px] rounded-xl border p-2 ${date ? "border-gray-200 bg-white hover:bg-gray-50" : "border-transparent"}`}>
                  {date && (
                    <div className="flex items-start justify-between">
                      <div className={`h-6 w-6 rounded-md text-center text-xs leading-6 ${date === today ? "bg-blue-600 text-white" : "text-gray-900"}`}>{Number(date.slice(8))}</div>
                      {loading && <div className="w-8 h-1.5 mt-1 bg-gray-200 rounded-full animate-pulse" />}
                    </div>
                  )}
                  {items.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {items.map((h, idx) => (
                        <div key={idx} title={h.summary} className={`w-full truncate rounded-md px-2 py-1 text-[10px] font-medium text-white ${h.source === "google" ? "bg-rose-500" : "bg-emerald-500"}`}>
                          {h.summary}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-600">
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-rose-500" /><span>วันหยุดราชการ</span></div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /><span>วันหยุดสถานศึกษา</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
