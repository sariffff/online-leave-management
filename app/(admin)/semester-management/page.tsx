"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { FaEdit, FaTrashAlt, FaPlus, FaSearch } from "react-icons/fa";

// ---------- Mock Types & Data ----------
type Semester = {
  id: string;
  semester_code: string;    // รหัสภาคเรียน เช่น 2567/1
  semester_name: string;    // ชื่อภาคเรียน เช่น ภาคเรียนที่ 1 ปีการศึกษา 2567
  academic_year: string;    // ปีการศึกษา เช่น 2567
  semester_number: number;  // ภาคเรียนที่ 1 หรือ 2
  start_date: string;       // วันเปิดเรียน
  end_date: string;         // วันปิดเรียน
  status: "preparing" | "active" | "completed";  // เตรียมเปิด / กำลังเรียน / สิ้นสุดแล้ว
  is_current: boolean;      // ภาคเรียนปัจจุบัน
  notes?: string;           // หมายเหตุ
  created_at: string;       // สำหรับ sorting ล่าสุดขึ้นก่อน
};

const mock: Semester[] = [
  {
    id: "sem-2567-2",
    semester_code: "2567/2",
    semester_name: "ภาคเรียนที่ 2 ปีการศึกษา 2567",
    academic_year: "2567",
    semester_number: 2,
    start_date: "2024-11-01",
    end_date: "2025-03-31",
    status: "active",
    is_current: true,
    notes: "ภาคเรียนปัจจุบัน",
    created_at: "2024-10-15"
  },
  {
    id: "sem-2567-1",
    semester_code: "2567/1",
    semester_name: "ภาคเรียนที่ 1 ปีการศึกษา 2567",
    academic_year: "2567",
    semester_number: 1,
    start_date: "2024-05-01",
    end_date: "2024-10-31",
    status: "completed",
    is_current: false,
    notes: "",
    created_at: "2024-04-15"
  },
  {
    id: "sem-2566-2",
    semester_code: "2566/2",
    semester_name: "ภาคเรียนที่ 2 ปีการศึกษา 2566",
    academic_year: "2566",
    semester_number: 2,
    start_date: "2023-11-01",
    end_date: "2024-03-31",
    status: "completed",
    is_current: false,
    notes: "",
    created_at: "2023-10-15"
  }
];

// ---------- Page ----------
export default function SemesterManagementPage() {
  const [academicYear, setAcademicYear] = useState<string | "ALL">("ALL");
  const [status, setStatus] = useState<string | "ALL">("ALL");
  const [q, setQ] = useState("");

  // เรียงภาคเรียนล่าสุดขึ้นก่อน (เรียงตาม created_at DESC)
  const sortedSemesters = useMemo(() => {
    return [...mock].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, []);

  const rows = useMemo(() => {
    return sortedSemesters
      .filter(s => (academicYear === "ALL" ? true : s.academic_year === academicYear))
      .filter(s => (status === "ALL" ? true : s.status === status))
      .filter(s => {
        const searchStr = `${s.semester_code} ${s.semester_name} ${s.notes ?? ""}`.toLowerCase();
        return searchStr.includes(q.trim().toLowerCase());
      });
  }, [sortedSemesters, academicYear, status, q]);

  // ตัวเลือกปีการศึกษา
  const academicYearOptions = useMemo(() => {
    return Array.from(new Set(mock.map(s => s.academic_year))).sort((a, b) => b.localeCompare(a));
  }, []);

  const getStatusText = (status: string) => {
    switch (status) {
      case "preparing": return "เตรียมเปิด";
      case "active": return "กำลังเรียน";
      case "completed": return "สิ้นสุดแล้ว";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "preparing": return "bg-yellow-100 text-yellow-800";
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

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
                จัดการภาคเรียน
              </h1>
            </div>
            
            <Button className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <FaPlus className="w-4 h-4" />
              เพิ่มภาคเรียน
            </Button>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <Input
                placeholder="ค้นหา: รหัสภาคเรียน หรือ ชื่อภาคเรียน..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            
            <Select value={academicYear} onValueChange={(v) => setAcademicYear(v as string | "ALL")}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="ปีการศึกษา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกปีการศึกษา</SelectItem>
                {academicYearOptions.map(year => (
                  <SelectItem key={year} value={year}>ปีการศึกษา {year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as string | "ALL")}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                <SelectItem value="preparing">เตรียมเปิด</SelectItem>
                <SelectItem value="active">กำลังเรียน</SelectItem>
                <SelectItem value="completed">สิ้นสุดแล้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-hidden bg-white border rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                    รหัสภาคเรียน
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                    ชื่อภาคเรียน
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                    วันเปิด-ปิดเรียน
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                    สถานะ
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-center text-gray-700">
                    ภาคปัจจุบัน
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-center text-gray-700">
                    การจัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <p className="mb-2 text-lg font-medium">ไม่พบข้อมูลตามตัวกรอง</p>
                        <p className="text-sm text-gray-400">
                          ลองเปลี่ยนเงื่อนไขการค้นหาดู
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((s, index) => (
                    <tr
                      key={s.id}
                      className={`border-b hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      } ${s.is_current ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{s.semester_code}</span>
                        {s.is_current && (
                          <span className="inline-flex px-2 py-1 ml-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                            ปัจจุบัน
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-900">{s.semester_name}</span>
                        {s.notes && (
                          <p className="mt-1 text-sm text-gray-500">{s.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          <div>{formatDate(s.start_date)}</div>
                          <div className="text-gray-500">ถึง {formatDate(s.end_date)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(s.status)}`}>
                          {getStatusText(s.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          s.is_current ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.is_current ? 'ใช่' : 'ไม่ใช่'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            <FaEdit className="w-3 h-3" />
                            แก้ไข
                          </Button>
                          
                          <Button
                            size="sm"
                            className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
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
        </div>
    </div>
  );
}
