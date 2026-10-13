"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { FaEdit, FaTrashAlt, FaPlus, FaSearch } from "react-icons/fa";

/* ---------- Mock Types & Data ---------- */
type Level = "K" | "P"; // K = อนุบาล, P = ประถม
type GradeRow = {
  id: string;
  level: Level;
  grade: string;      // K1..K3, P1..P6
  section: string;    // ห้อง เช่น 1/1
  homeroom?: string;  // ครูประจำชั้น
  capacity?: number;
  enrolled?: number;
  status: "active" | "inactive";
};

const mock: GradeRow[] = [
  { id: "k1-1", level: "K", grade: "K1", section: "1/1", homeroom: "ครูแอน", capacity: 30, enrolled: 28, status: "active" },
  { id: "k2-1", level: "K", grade: "K2", section: "2/1", homeroom: "ครูมุก", capacity: 30, enrolled: 29, status: "active" },
  { id: "k3-1", level: "K", grade: "K3", section: "3/1", homeroom: "ครูริน", capacity: 30, enrolled: 30, status: "active" },
  { id: "p1-1", level: "P", grade: "P1", section: "1/1", homeroom: "ครูสมชาย", capacity: 35, enrolled: 32, status: "active" },
  { id: "p4-2", level: "P", grade: "P4", section: "4/2", homeroom: "ครูดวงใจ", capacity: 35, status: "inactive" },
  { id: "p6-1", level: "P", grade: "P6", section: "6/1", homeroom: "ครูสุนีย์", capacity: 35, status: "active" },
];

/* ---------- Page ---------- */
const PAGE_SIZE = 10;

export default function GradeManagementPage() {
  const [level, setLevel] = useState<Level | "ALL">("ALL");
  const [grade, setGrade] = useState<string | "ALL">("ALL");
  const [q, setQ] = useState("");

  // pagination
  const [currentPage, setCurrentPage] = useState(1);

  // reset page เมื่อ filter/search เปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [level, grade, q]);

  // เลือกตัวเลือกชั้นปีตามระดับ
  const gradeOptions = useMemo(() => {
    if (level === "K") return ["K1", "K2", "K3"];
    if (level === "P") return ["P1", "P2", "P3", "P4", "P5", "P6"];
    return ["K1", "K2", "K3", "P1", "P2", "P3", "P4", "P5", "P6"];
  }, [level]);

  // กรองข้อมูล
  const filtered = useMemo(() => {
    return mock
      .filter(r => (level === "ALL" ? true : r.level === level))
      .filter(r => (grade === "ALL" ? true : r.grade === grade))
      .filter(r => {
        const s = `${r.grade} ${r.section} ${r.homeroom ?? ""}`.toLowerCase();
        return s.includes(q.trim().toLowerCase());
      });
  }, [level, grade, q]);

  // คำนวณหน้า
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filtered.slice(startIdx, endIdx);

  // ความกว้างคอลัมน์ (compact แบบ usermanagement)
  const colWidths = ["w-28", "w-24", "w-24", "w-[16rem]", "w-24", "w-40"];

  return (
    <div className="w-full p-4 mx-auto max-w-screen-2xl sm:p-6">
        <div role="note" className="px-4 py-3 mb-4 text-sm border rounded-lg border-amber-300 bg-amber-50 text-amber-900">
          หน้านี้ยังเป็น<strong>ข้อมูลตัวอย่าง</strong> — การเพิ่ม/แก้ไข/ลบยังไม่บันทึกลงระบบ
        </div>
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                จัดการชั้นปี การศึกษา
              </h1>
              <p className="mt-1 text-gray-600">
                เลือกระดับ/ชั้นปี เพื่อดูและจัดการห้องเรียน ครูประจำชั้น และจำนวนนักเรียน
              </p>
            </div>
            <Button className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <FaPlus className="w-4 h-4" />
              เพิ่มชั้นปี
            </Button>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <Input
                placeholder="ค้นหา: ครู/ห้อง/ชั้นปี..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            
            <Select value={level} onValueChange={(v) => setLevel(v as Level | "ALL")}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="ระดับ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกระดับ</SelectItem>
                <SelectItem value="K">อนุบาล</SelectItem>
                <SelectItem value="P">ประถม</SelectItem>
              </SelectContent>
            </Select>

            <Select value={grade} onValueChange={(v) => setGrade(v as string | "ALL")}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="ชั้นปี" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกชั้นปี</SelectItem>
                {gradeOptions.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Section (COMPACT + per page = 10) */}
        <div className="mb-8 overflow-hidden bg-white border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              รายการชั้นปีทั้งหมด ({filtered.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[13px]">
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={`col-${i}`} className={w} />
                ))}
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr className="text-gray-600 uppercase">
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ระดับ</th>
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชั้นปี</th>
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ห้อง</th>
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ครูประจำชั้น</th>
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">สถานะ</th>
                  <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      ไม่พบข้อมูลตามเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            r.level === "K"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {r.level === "K" ? "อนุบาล" : "ประถม"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-gray-900">{r.grade}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-gray-900">{r.section}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-gray-700 truncate">{r.homeroom ?? "-"}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            r.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {r.status === "active" ? "เปิดสอน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            <FaEdit className="w-3 h-3" />
                            แก้ไข
                          </Button>
                          <Button
                            size="sm"
                            className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-red-600 rounded hover:bg-red-700"
                          >
                            <FaTrashAlt className="w-3 h-3" />
                            ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  หน้า {safePage} จาก {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(safePage - 1)}
                    disabled={safePage === 1}
                    className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">
                    {safePage}
                  </span>
                  <button
                    onClick={() => setCurrentPage(safePage + 1)}
                    disabled={safePage === totalPages}
                    className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
