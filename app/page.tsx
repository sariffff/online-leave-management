// app/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Holiday = {
  date: string;                 // YYYY-MM-DD
  name: string;                 // ชื่อวันหยุด
  type: "ราชการ" | "สถานศึกษา"; // แสดงสีต่างกันที่ UI
};

// ======= CONFIG (ฝั่ง frontend เท่านั้น) =======
// 1) กำหนดเวลารอ API ก่อน timeout (มิลลิวินาที)
const API_TIMEOUT_MS = 6000;

// 2) อายุ cache ใน localStorage (มิลลิวินาที) – 30 วัน
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// 3) Fallback วันหยุด (ใส่เฉพาะรายการที่อยากให้มีตอนออฟไลน์)
//    👉 เพิ่ม/แก้ชื่อ-วันที่ได้ตามต้องการ
const FALLBACK_HOLIDAYS: Holiday[] = [
  // ตัวอย่าง (ปี 2025): เติมเท่าที่จำเป็น
  { date: "2025-01-01", name: "วันขึ้นปีใหม่", type: "ราชการ" },
  { date: "2025-04-13", name: "สงกรานต์", type: "ราชการ" },
  { date: "2025-04-14", name: "สงกรานต์ (ชดเชย)", type: "ราชการ" },
  { date: "2025-04-15", name: "สงกรานต์", type: "ราชการ" },
  // ตัวอย่าง “สถานศึกษา”
  { date: "2025-10-01", name: "เปิดภาคเรียนที่ 2", type: "สถานศึกษา" },
];

// เดา “สถานศึกษา” จากชื่อ กรณีรับจาก API เดิม (ปรับ keyword ได้)
const isSchoolHoliday = (name: string) =>
  /สถานศึกษา|โรงเรียน|มหาวิทยาลัย|ปิดภาคเรียน|เปิดภาคเรียน/i.test(name);

// ======= utils =======
function parseYM(m?: string | null) {
  const now = new Date();
  if (!m || !/^\d{4}-\d{2}$/.test(m)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [y, mm] = m.split("-").map(Number);
  return { year: y, month: mm };
}
function ymEdges(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startISO: iso(start), endISO: iso(end) };
}
function daysOfMonth(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const total = last.getUTCDate();
  const startWeekday = first.getUTCDay(); // 0-6 (Sun..Sat)
  const days: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) days.push({ date: "", inMonth: false });
  for (let d = 1; d <= total; d++) {
    const iso = new Date(Date.UTC(year, month - 1, d)).toISOString().slice(0, 10);
    days.push({ date: iso, inMonth: true });
  }
  while (days.length % 7 !== 0) days.push({ date: "", inMonth: false });
  return days;
}
function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
const cacheKey = (startISO: string, endISO: string) => `holidays:${startISO}:${endISO}`;
type Cached = { ts: number; data: Holiday[] };

async function fetchJsonWithTimeout<T>(url: string, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export default function HomePage() {
  const search = useSearchParams();
  const router = useRouter();
  const { year, month } = parseYM(search.get("m"));

  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fromCache, setFromCache] = React.useState(false);
  const [fromFallback, setFromFallback] = React.useState(false);

  const { startISO, endISO } = ymEdges(year, month);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setFromCache(false);
    setFromFallback(false);

    const key = cacheKey(startISO, endISO);

    // 1) ลองโหลดจาก API (มี timeout)
    try {
      const json = await fetchJsonWithTimeout<{ holidays?: any[]; error?: string }>(
        `/api/holidays?start=${startISO}&end=${endISO}`,
        API_TIMEOUT_MS
      );

      if (!Array.isArray(json.holidays)) {
        throw new Error(json.error || "Invalid response");
      }

      // แปลง { start, end, summary } -> Holiday
      const mapped: Holiday[] = json.holidays
        .map((e: any) => {
          const start =
            (typeof e.start === "string" ? e.start : e?.start?.date || e?.start?.dateTime || "") as string;
          const date = start.slice(0, 10);
          const name = (e?.summary ?? "").toString().trim();
          if (!date || !name) return null;
          const type: Holiday["type"] = isSchoolHoliday(name) ? "สถานศึกษา" : "ราชการ";
          return { date, name, type };
        })
        .filter(Boolean) as Holiday[];

      // cache ลง localStorage
      const payload: Cached = { ts: Date.now(), data: mapped };
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {}

      setHolidays(mapped);
      setLoading(false);
      return;
    } catch (err: any) {
      setError("โหลดจาก API ไม่สำเร็จ");
    }

    // 2) ถ้า API พัง ลอง cache ที่ยังไม่หมดอายุ
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const cached: Cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL_MS) {
          setHolidays(cached.data);
          setFromCache(true);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 3) ถ้าไม่มี cache ใช้ Fallback เฉพาะของเดือนนี้
    const monthFallback = FALLBACK_HOLIDAYS.filter(
      (h) => h.date >= startISO && h.date <= endISO
    ).sort((a, b) => a.date.localeCompare(b.date));

    if (monthFallback.length > 0) {
      setHolidays(monthFallback);
      setFromFallback(true);
      setLoading(false);
      return;
    }

    // สุดท้าย ถ้าไม่มีอะไรเลย
    setHolidays([]);
    setLoading(false);
  }, [startISO, endISO]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const days = React.useMemo(() => daysOfMonth(year, month), [year, month]);

  const holidaysByDate = React.useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) {
      if (!m.has(h.date)) m.set(h.date, []);
      m.get(h.date)!.push(h);
    }
    return m;
  }, [holidays]);

  const prev = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const toYM = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const goPrev = () => router.push(`/?m=${toYM(prev)}`);
  const goNext = () => router.push(`/?m=${toYM(next)}`);

  const today = new Date().toISOString().slice(0, 10);
  const TH_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="min-h-screen text-gray-900 bg-white">


      <main className="px-4 py-6 mx-auto space-y-6 max-w-7xl">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
            >
              ← เดือนก่อนหน้า
            </button>
            <button
              onClick={goNext}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
            >
              เดือนถัดไป →
            </button>
          </div>

          <div className="text-sm text-gray-600">
            ปฏิทินเดือน{" "}
            <span className="text-gray-900">
              {year}-{String(month).padStart(2, "0")}
            </span>
          </div>

          <Link
            href="/leave-page"
            className="rounded-xl bg-[#4F8EF7] px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#4F8EF7]/60 transition"
          >
            + ยื่นใบลา
          </Link>
        </div>

        {/* Banner แจ้งสถานะแหล่งข้อมูล */}
        {(error || fromCache || fromFallback) && (
          <div
            className={cls(
              "rounded-xl border p-3 text-sm flex items-start gap-3",
              error
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : fromFallback
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            )}
          >
            <div className="mt-0.5">ℹ️</div>
            <div className="flex-1">
              {error && <div className="font-semibold mb-0.5">โหลดจาก API ไม่สำเร็จ</div>}
              {fromCache && <div>กำลังแสดงข้อมูลจากแคชเดือนนี้ (อาจไม่อัปเดตล่าสุด)</div>}
              {fromFallback && <div>กำลังแสดงข้อมูล Fallback ที่กำหนดไว้ในฝั่งหน้าเว็บ</div>}
              {!fromFallback && (
                <button
                  onClick={load}
                  className="inline-flex items-center px-2 py-1 mt-2 text-xs border border-current rounded-lg hover:opacity-80"
                >
                  ลองโหลดใหม่
                </button>
              )}
            </div>
          </div>
        )}

        {/* Calendar Card */}
        <section className="p-4 bg-white border border-gray-200 shadow-sm rounded-2xl">
          {/* Week headers */}
          <div className="grid grid-cols-7 mb-2 text-xs text-center text-gray-500">
            {TH_WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const isBlank = !d.inMonth;
              const isToday = d.date === today;
              const dayHolidays = d.date ? holidaysByDate.get(d.date) ?? [] : [];

              return (
                <div
                  key={i}
                  className={cls(
                    "relative min-h-[96px] rounded-xl border p-2 transition-colors",
                    isBlank ? "border-transparent" : "border-gray-200 bg-white",
                    !isBlank && "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cls(
                        "h-6 w-6 rounded-md text-center text-xs leading-6",
                        isToday ? "bg-blue-600 text-white" : "text-gray-900"
                      )}
                    >
                      {d.date ? Number(d.date.slice(8, 10)) : ""}
                    </div>
                    {/* จุดสถานะกำลังโหลด */}
                    {loading && !isBlank && (
                      <div className="h-1.5 w-8 rounded-full bg-gray-200 animate-pulse mt-1" />
                    )}
                  </div>

                  {/* รายการวันหยุด */}
                  {dayHolidays.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {dayHolidays.map((h, idx) => (
                        <div
                          key={idx}
                          title={h.name}
                          className={cls(
                            "w-full truncate rounded-md px-2 py-1 text-[10px] font-medium",
                            h.type === "ราชการ"
                              ? "bg-rose-500 text-white"
                              : "bg-emerald-500 text-white"
                          )}
                        >
                          {h.name}
                          <span className="ml-1 opacity-80">({h.type})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-rose-500" />
              <span>วันหยุดราชการ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-3 bg-gray-200 rounded-full" />
              <span>กำลังโหลดข้อมูล</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}