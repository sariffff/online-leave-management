"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import AddsubjectModal from "@/components/admin/Modals/subject/AddsubjectModal";
import EditsubjectModal from "@/components/admin/Modals/subject/EdditsubjectModal";
import DeletesubjectModal from "@/components/admin/Modals/subject/DeletesubjectModal";
import { FaEdit, FaTrashAlt, FaPlus, FaSearch } from "react-icons/fa";
import { Loader2 } from "lucide-react";

interface subject {
  subject_id: string;
  subject_name: string;
  subject_group: string;
  subject_level: string;
}

export default function subjectManagementPage() {
  const [subjects, setsubjects] = useState<subject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [loading, setLoading] = useState(false);

  // ✅ pagination (per page 10)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedsubject, setSelectedsubject] = useState<subject | null>(null);

  const fetchsubjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subjectmanagement/subject");
      if (!res.ok) throw new Error("Failed to fetch subjects.");
      const data = await res.json();
      setsubjects(Array.isArray(data?.subjects) ? data.subjects : []);
    } catch (err: any) {
      alert(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchsubjects();
  }, []);

  // ✅ filter ด้วย useMemo
  const filteredsubjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return subjects.filter((s) => {
      const searchMatch =
        s.subject_name.toLowerCase().includes(q) ||
        s.subject_id.toLowerCase().includes(q);
      const groupMatch = selectedGroup === "all" || s.subject_group === selectedGroup;
      return searchMatch && groupMatch;
    });
  }, [subjects, searchTerm, selectedGroup]);

  // ✅ reset หน้าเมื่อเปลี่ยน filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedGroup]);

  const uniqueGroups = useMemo(
    () => Array.from(new Set(subjects.map((c) => c.subject_group))),
    [subjects]
  );

  // ✅ pagination calc เหมือน usermanagement
  const totalPages = Math.max(1, Math.ceil(filteredsubjects.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filteredsubjects.slice(startIdx, endIdx);

  // ✅ ตั้งความกว้างคอลัมน์ (id / name / group / level / actions)
  // ใช้ .map เพื่อเลี่ยง whitespace text node ใน <colgroup>
  const colWidths = ["w-[14rem]", "w-[24rem]", "w-[16rem]", "w-[12rem]", "w-44"];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">จัดการรายวิชา</h1>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <FaPlus className="w-4 h-4" />
              เพิ่มรายวิชาใหม่
            </Button>
          </div>
          <p className="mt-1 text-gray-600">จัดการข้อมูลรายวิชาทั้งหมดในระบบ</p>
        </div>

        {/* Search and Filter Section */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <Input
                placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10"
              />
            </div>

            <div className="lg:w-64">
              <Select value={selectedGroup} onValueChange={(v) => setSelectedGroup(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="เลือกกลุ่มสาระ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="font-medium">ทุกกลุ่มสาระ</span>
                  </SelectItem>
                  {uniqueGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ✅ Table Section (compact + colgroup + pagination) */}
        <div className="overflow-hidden bg-white border rounded-lg shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-gray-500">
              <Loader2 className="w-12 h-12 mb-4 text-blue-500 animate-spin" />
              <p className="text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-[13px]">
                  <colgroup>
                    {colWidths.map((w) => (
                      <col key={w} className={w} />
                    ))}
                  </colgroup>

                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr className="text-gray-600 uppercase">
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">รหัสวิชา</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชื่อวิชา</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">กลุ่มสาระ</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ระดับชั้น</th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <p className="mb-2 text-lg font-medium">ไม่พบข้อมูลรายวิชา</p>
                            <p className="text-sm text-gray-400">
                              {searchTerm || selectedGroup !== "all"
                                ? "ลองเปลี่ยนเงื่อนไขการค้นหาดู"
                                : "เริ่มต้นด้วยการเพิ่มรายวิชาใหม่"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visible.map((subject) => (
                        <tr key={subject.subject_id} className="transition-colors border-b hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate">
                              {subject.subject_id}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-900 truncate">
                              {subject.subject_name}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-700 truncate">
                              {subject.subject_group}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-700 truncate">
                              {subject.subject_level}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700"
                                onClick={() => {
                                  setSelectedsubject(subject);
                                  setShowEditModal(true);
                                }}
                              >
                                <FaEdit className="w-3 h-3" />
                                แก้ไข
                              </Button>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-red-600 rounded hover:bg-red-700"
                                onClick={() => {
                                  setSelectedsubject(subject);
                                  setShowDeleteModal(true);
                                }}
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

              {/* ✅ Pagination แบบเดียวกับ usermanagement */}
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
                        {/* ใช้ SVG เพียว ๆ เพื่อไม่ต้องเพิ่มไอคอน */}
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
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddsubjectModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        fetchsubjects={fetchsubjects}
      />
      <EditsubjectModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        subject={selectedsubject}
        fetchsubjects={fetchsubjects}
      />
      <DeletesubjectModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        subjectId={selectedsubject?.subject_id}
        subjectName={selectedsubject?.subject_name}
        onDeleted={fetchsubjects}
      />
    </div>
  );
}
