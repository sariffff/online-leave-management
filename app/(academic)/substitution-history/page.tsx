// app/academic/substitutions/history/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AcademicSidebar from "@/components/academic/sidebar";
/* ===================== Types ===================== */
type SubstitutionItem = {
  id: number;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  tsId: number | null;   // teaching_schedule_id (อาจ null ในฐานเก่า)
  period?: number | null;
  subject?: string;
  classroom?: string;
  leaver?: string;       // ผู้ลา/เจ้าของตาราง
  substitute?: string;   // ผู้สอนแทน
};

type ApiResponse = { items?: SubstitutionItem[]; error?: string };

/* ============ Search Filters (in-page component) ============ */
type SearchFilters = {
  leaveId: string;
  from: string;          // YYYY-MM-DD
  to: string;            // YYYY-MM-DD
  teacherUserId: string; // uuid (optional)
};

type SearchProps = {
  value: SearchFilters;
  onChange: (v: SearchFilters) => void;
  onSubmit: () => void;
  onReset: () => void;
  loading?: boolean;
};

function SubstitutionHistorySearch({ value, onChange, onSubmit, onReset, loading }: SearchProps) {
  const disabledRange = Boolean(value.leaveId);

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-white">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* โหมด A: ค้นหาตาม leaveId */}
        <div className="space-y-1">
          <label className="text-sm font-medium">ค้นหาตามใบลา (leaveId)</label>
          <input
            className="w-full h-10 rounded border px-3"
            placeholder="เช่น 48"
            value={value.leaveId}
            onChange={(e) => onChange({ ...value, leaveId: e.target.value })}
          />
          <div className="text-xs text-gray-500">ถ้าใส่ leaveId ระบบจะไม่ใช้ช่วงวันด้านล่าง</div>
        </div>

        {/* จำกัดครู (โหมด B เท่านั้น) */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Teacher User ID (จำกัดครูในช่วงวัน, ไม่บังคับ)</label>
          <input
            className="w-full h-10 rounded border px-3"
            placeholder="UUID ของครู (optional)"
            value={value.teacherUserId}
            onChange={(e) => onChange({ ...value, teacherUserId: e.target.value })}
            disabled={disabledRange}
          />
        </div>

        {/* ช่วงวัน: from */}
        <div className="space-y-1">
          <label className="text-sm font-medium">From</label>
          <input
            type="date"
            className="w-full h-10 rounded border px-3"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            disabled={disabledRange}
          />
        </div>

        {/* ช่วงวัน: to */}
        <div className="space-y-1">
          <label className="text-sm font-medium">To</label>
          <input
            type="date"
            className="w-full h-10 rounded border px-3"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            disabled={disabledRange}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          onClick={onSubmit}
          disabled={loading}
        >
          ค้นหา
        </button>
        <button
          className="rounded border px-4 py-2"
          onClick={onReset}
          disabled={loading}
        >
          ล้าง
        </button>
      </div>
    </div>
  );
}

/* ============ Table (in-page component) ============ */
type TableProps = {
  rows: SubstitutionItem[];
  loading?: boolean;
  error?: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

function SubstitutionHistoryTable({
  rows,
  loading,
  error,
  currentPage,
  totalPages,
  onPageChange,
}: TableProps) {
  return (
    <div className="rounded-lg border overflow-hidden bg-white">
      <div className="border-b bg-gray-50 px-3 py-2 font-medium">ผลการค้นหา</div>
      <div className="overflow-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 w-[110px]">วันที่</th>
              <th className="text-left px-3 py-2 w-[80px]">เวลา</th>
              <th className="text-left px-3 py-2 w-[90px]">คาบ</th>
              <th className="text-left px-3 py-2">วิชา</th>
              <th className="text-left px-3 py-2 w-[120px]">ห้อง</th>
              <th className="text-left px-3 py-2 w-[200px]">ผู้ลา (เจ้าของคาบ)</th>
              <th className="text-left px-3 py-2 w-[200px]">ผู้สอนแทน</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">กำลังโหลด...</td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-red-600">{error}</td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
            )}
            {!loading && !error && rows.map((it) => (
              <tr key={it.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{it.date}</td>
                <td className="px-3 py-2">{it.time}</td>
                <td className="px-3 py-2">{it.period ? `คาบ ${it.period}` : "-"}</td>
                <td className="px-3 py-2">{it.subject || "-"}</td>
                <td className="px-3 py-2">{it.classroom || "-"}</td>
                <td className="px-3 py-2">{it.leaver || "-"}</td>
                <td className="px-3 py-2">{it.substitute || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-sm">
        <div>หน้า {currentPage} / {totalPages}</div>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 disabled:opacity-50"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            ก่อนหน้า
          </button>
          <button
            className="rounded border px-3 py-1 disabled:opacity-50"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Main Page ===================== */
const CLIENT_PAGE_SIZE = 10;

export default function SubstitutionHistoryPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    leaveId: "",
    from: "",
    to: "",
    teacherUserId: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SubstitutionItem[]>([]);

  // client pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = CLIENT_PAGE_SIZE;

  // สร้าง URL สำหรับเรียก API
  const apiUrl = useMemo(() => {
    const u = new URL("/api/academic/substitutions/history", window.location.origin);
    if (filters.leaveId.trim()) {
      u.searchParams.set("leaveId", filters.leaveId.trim());
    } else {
      if (filters.from) u.searchParams.set("from", filters.from);
      if (filters.to) u.searchParams.set("to", filters.to);
      if (filters.teacherUserId.trim()) u.searchParams.set("teacherUserId", filters.teacherUserId.trim());
    }
    return u.toString();
  }, [filters.leaveId, filters.from, filters.to, filters.teacherUserId]);

  // โหลดข้อมูล
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      setRows([]);

      // guard ง่าย ๆ: ต้องมี leaveId หรือครบช่วง from/to
      if (!filters.leaveId && !(filters.from && filters.to)) {
        setLoading(false);
        setRows([]);
        return;
      }

      const res = await fetch(apiUrl, { cache: "no-store" });
      const j: ApiResponse = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "โหลดประวัติไม่สำเร็จ");

      setRows(Array.isArray(j.items) ? j.items : []);
      setCurrentPage(1); // รีเซ็ตหน้าเมื่อค้นหาใหม่
    } catch (e: any) {
      setErr(e?.message || "โหลดประวัติไม่สำเร็จ");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, filters.leaveId, filters.from, filters.to]);

  useEffect(() => {
    if (filters.leaveId || (filters.from && filters.to)) {
      load();
    }
  }, [apiUrl]);

  // client-side pagination
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / pageSize)),
    [rows.length, pageSize]
  );

  const paginated = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return rows.slice(startIdx, startIdx + pageSize);
  }, [rows, currentPage, pageSize]);

  // handlers
  const handleSubmit = useCallback(() => load(), [load]);
  const handleReset = useCallback(() => {
    setFilters({ leaveId: "", from: "", to: "", teacherUserId: "" });
    setRows([]);
    setErr(null);
    setCurrentPage(1);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AcademicSidebar />

      <main className="flex-1 p-4 space-y-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">ประวัติการสอนแทน</h1>
        </div>

        <SubstitutionHistorySearch
          value={filters}
          onChange={setFilters}
          onSubmit={handleSubmit}
          onReset={handleReset}
          loading={loading}
        />

        <SubstitutionHistoryTable
          rows={paginated}
          loading={loading}
          error={err}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </main>
    </div>
  );
}
