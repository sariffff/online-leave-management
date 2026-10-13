"use client";

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUserGraduate } from "react-icons/fa";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/api";
import { PageContainer, PageHeader } from "@/components/shell/Page";

type Teacher = { teacher_id: number; user_id: string; name: string; subject_group_name: string | null };
type Slot = {
  teaching_schedule_id: number;
  day_of_week: number;
  period_number: number;
  start_time: string | null;
  end_time: string | null;
  subject_name: string;
  classroom_name: string;
  level_name: string;
};

const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];

/** ตารางสอนรายครู (ข้อมูลจริงจากฐานข้อมูล แทนข้อมูลจำลองเดิม) */
export default function TeachingSchedulePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Teacher[] }>("/api/admin/schedule/teacher")
      .then((r) => setTeachers(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    apiFetch<{ schedules: Slot[] }>(`/api/admin/schedule/table/${selected.user_id}`, { signal: ac.signal })
      .then((r) => setSlots(r.schedules))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSlots([]);
        setError(e instanceof Error ? e.message : "โหลดตารางสอนไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [selected]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? teachers.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [teachers, search]);

  // คอลัมน์คาบ = คาบที่มีอยู่จริงในตาราง (เรียงตามเลขคาบ) พร้อมช่วงเวลา
  const periods = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of slots) if (!m.has(s.period_number)) m.set(s.period_number, s.start_time && s.end_time ? `${s.start_time}-${s.end_time}` : "");
    return [...m].sort((a, b) => a[0] - b[0]);
  }, [slots]);

  const cell = (day: number, period: number) => slots.filter((s) => s.day_of_week === day && s.period_number === period);

  return (
    <PageContainer>
      <PageHeader title="ตารางสอน" description="ค้นหาอาจารย์เพื่อดูตารางสอนรายสัปดาห์" />
        <div className="p-4 bg-white border rounded-xl shadow-sm">
          <label htmlFor="teacher-search" className="block mb-2 text-sm font-medium text-gray-800">ค้นหาอาจารย์</label>
          <div className="relative w-full sm:max-w-md">
            <FaSearch className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
            <Input id="teacher-search" placeholder="พิมพ์ชื่ออาจารย์..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-10" />
            {matches.length > 0 && (
              <div className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg max-h-72">
                {matches.map((t) => (
                  <button
                    key={t.teacher_id}
                    onClick={() => {
                      setSelected(t);
                      setSearch(t.name);
                    }}
                    className="block w-full px-4 py-2.5 text-left hover:bg-gray-50"
                  >
                    {t.name}
                    {t.subject_group_name ? <span className="ml-2 text-xs text-gray-500">{t.subject_group_name}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden bg-white border rounded-xl shadow-sm">
          <div className="p-3 border-b bg-gray-50 sm:p-4">
            <h3 className="text-base font-medium text-gray-800 sm:text-lg">
              {selected ? `ตารางสอนของ ${selected.name}` : "ตารางสอน - กรุณาเลือกอาจารย์"}
            </h3>
          </div>

          {error && <div className="p-4 text-sm text-red-600">{error}</div>}

          {!selected ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <FaUserGraduate className="w-12 h-12 mb-4 text-gray-400" />
              <p>ค้นหาและเลือกอาจารย์เพื่อดูตารางสอน</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-gray-500">กำลังโหลดข้อมูล...</div>
          ) : slots.length === 0 ? (
            <div className="p-12 text-center text-gray-500">ยังไม่มีตารางสอน</div>
          ) : (
            <>
            {/* มือถือ: รายการตามวัน */}
            <div className="divide-y md:hidden">
              {DAYS.map((day, i) => {
                const items = slots.filter((s) => s.day_of_week === i + 1).sort((a, b) => a.period_number - b.period_number);
                return (
                  <div key={day} className="p-3">
                    <div className="mb-2 text-sm font-semibold text-gray-900">วัน{day}</div>
                    {items.length === 0 ? (
                      <div className="text-sm text-gray-400">ไม่มีคาบสอน</div>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((s) => (
                          <li key={s.teaching_schedule_id} className="flex gap-3 p-2 text-sm border border-blue-200 rounded-lg bg-blue-50">
                            <div className="w-14 shrink-0">
                              <div className="font-semibold">คาบ {s.period_number}</div>
                              {s.start_time && <div className="text-xs text-gray-500">{s.start_time}</div>}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{s.subject_name || "-"}</div>
                              <div className="text-gray-600">{s.classroom_name || "-"}{s.level_name ? ` · ${s.level_name}` : ""}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse" style={{ minWidth: 800 }}>
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-3 text-xs font-semibold text-center text-gray-700 border-r">วัน / คาบ</th>
                    {periods.map(([p, time]) => (
                      <th key={p} className="px-2 py-3 text-xs font-semibold text-center text-gray-700 border-r">
                        คาบ {p}
                        {time && <div className="font-normal text-gray-500">{time}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, i) => (
                    <tr key={day} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-4 font-medium text-gray-900 border-r bg-gray-50">{day}</td>
                      {periods.map(([p]) => {
                        const items = cell(i + 1, p);
                        const clash = items.length > 1;
                        return (
                          <td key={p} className="px-1 py-2 border-r">
                            {items.length === 0 ? (
                              <div className="p-2 text-xs text-center text-gray-400 border border-dashed rounded-lg">ว่าง</div>
                            ) : (
                              items.map((s) => (
                                <div key={s.teaching_schedule_id} className={`p-2 mb-1 text-xs border rounded-lg ${clash ? "bg-red-100 border-red-300" : "bg-blue-100 border-blue-200"}`}>
                                  <div className="font-semibold">{s.subject_name || "-"}</div>
                                  <div>{s.classroom_name || "-"}</div>
                                  {s.level_name && <div className="text-gray-600">{s.level_name}</div>}
                                </div>
                              ))
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
    </PageContainer>
  );
}
