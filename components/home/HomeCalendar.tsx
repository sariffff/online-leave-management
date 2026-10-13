"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { PageContainer, PageHeader } from "@/components/shell/Page";

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

export default function HomeCalendar() {
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

  const monthHolidays = holidays.filter((h) => h.start.startsWith(`${ym.year}-${pad(ym.month)}`));

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        title={`ปฏิทินวันหยุด ${MONTHS[ym.month - 1]} ${ym.year + 543}`}
        actions={
          <Link href="/leave-page" className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-white transition bg-blue-600 rounded-lg hover:bg-blue-700">
            + ยื่นใบลา
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} className="flex-1 h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg sm:flex-none hover:bg-gray-50" aria-label="เดือนก่อนหน้า">
          ← <span className="hidden sm:inline">เดือนก่อนหน้า</span>
        </button>
        <button onClick={() => setYm({ year: now.getFullYear(), month: now.getMonth() + 1 })} className="flex-1 h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg sm:flex-none hover:bg-gray-50">
          เดือนนี้
        </button>
        <button onClick={() => shift(1)} className="flex-1 h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg sm:flex-none hover:bg-gray-50" aria-label="เดือนถัดไป">
          <span className="hidden sm:inline">เดือนถัดไป</span> →
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 p-3 text-sm border rounded-xl border-amber-300 bg-amber-50 text-amber-800">
          <span>{error}</span>
          <button onClick={() => setTick((t) => t + 1)} className="px-2 py-1 text-xs border border-current rounded-lg shrink-0 hover:opacity-80">ลองโหลดใหม่</button>
        </div>
      )}

      <section className="p-2 bg-white border border-gray-200 shadow-sm sm:p-4 rounded-2xl">
        <div className="grid grid-cols-7 mb-1 text-xs text-center text-gray-500">
          {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, i) => {
            const items = date ? byDate.get(date) ?? [] : [];
            return (
              <div
                key={date ?? `blank-${i}`}
                className={`relative min-h-12 sm:min-h-24 rounded-lg border p-1 sm:p-2 ${date ? (items.length ? "border-rose-200 bg-rose-50/40" : "border-gray-200 bg-white") : "border-transparent"}`}
              >
                {date && (
                  <div className="flex items-start justify-between">
                    <div className={`h-6 w-6 rounded-md text-center text-xs leading-6 ${date === today ? "bg-blue-600 text-white" : "text-gray-900"}`}>{Number(date.slice(8))}</div>
                    {loading && <div className="hidden w-8 h-1.5 mt-1 bg-gray-200 rounded-full sm:block animate-pulse" />}
                  </div>
                )}
                {items.length > 0 && (
                  <>
                    {/* มือถือ: จุดสี (รายชื่ออยู่ด้านล่าง) */}
                    <div className="flex gap-0.5 mt-1 sm:hidden">
                      {items.map((h, idx) => <span key={idx} className={`h-1.5 w-1.5 rounded-full ${h.source === "google" ? "bg-rose-500" : "bg-emerald-500"}`} />)}
                    </div>
                    <div className="flex-col hidden gap-1 mt-2 sm:flex">
                      {items.map((h, idx) => (
                        <div key={idx} title={h.summary} className={`w-full truncate rounded-md px-2 py-1 text-[11px] font-medium text-white ${h.source === "google" ? "bg-rose-500" : "bg-emerald-500"}`}>
                          {h.summary}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 px-1 mt-4 text-xs text-gray-600">
          <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-rose-500" /><span>วันหยุดราชการ</span></div>
          <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /><span>วันหยุดสถานศึกษา</span></div>
        </div>
      </section>

      {/* รายการวันหยุดของเดือน — อ่านง่ายบนมือถือ */}
      <section className="p-4 bg-white border border-gray-200 shadow-sm sm:hidden rounded-2xl">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">วันหยุดเดือนนี้</h2>
        {monthHolidays.length === 0 ? (
          <p className="text-sm text-gray-500">{loading ? "กำลังโหลด..." : "ไม่มีวันหยุด"}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {monthHolidays.map((h, idx) => (
              <li key={idx} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${h.source === "google" ? "bg-rose-500" : "bg-emerald-500"}`} />
                <span className="w-10 font-medium shrink-0">{Number(h.start.slice(8))}</span>
                <span className="text-gray-700">{h.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
