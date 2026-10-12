// app/admin/subjectgroup/page.tsx  (หรือไฟล์ที่คุณใช้อยู่)
"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FaEdit, FaTrashAlt, FaPlus, FaSearch } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import AddSubjectGroupModal from "@/components/admin/Modals/subjectgroup/AddSubjectGroupModal";
import EditSubjectGroupModal from "@/components/admin/Modals/subjectgroup/EditSubjectGroupModal";
import DeleteSubjectGroupModal from "@/components/admin/Modals/subjectgroup/DeleteSubjectGroupModal";

interface SubjectGroupForm {
  subject_group_id?: string;
  subject_group_name: string;
}

const PAGE_SIZE = 10;

export default function SubjectGroupManagementPage() {
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroupForm[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSubjectGroup, setSelectedSubjectGroup] =
    useState<SubjectGroupForm | null>(null);

  const fetchSubjectGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subjectmanagement/subject-group", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch subject groups.");
      const data = await res.json();
      setSubjectGroups(Array.isArray(data?.subjectGroups) ? data.subjectGroups : []);
    } catch (err: any) {
      alert(err?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjectGroups();
  }, []);

  // ค้นหา
  const filteredSubjectGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subjectGroups;
    return subjectGroups.filter((g) => {
      const hay = `${g.subject_group_id ?? ""} ${g.subject_group_name ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [subjectGroups, searchTerm]);

  // reset หน้าเมื่อค้นหาเปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // แบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredSubjectGroups.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filteredSubjectGroups.slice(startIdx, endIdx);

  // ความกว้างคอลัมน์ (3 คอลัมน์: รหัส / ชื่อ / การจัดการ)
  const colWidths = ["w-[10rem]", "w-[32rem]", "w-40"];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">จัดการกลุ่มสาระการเรียนรู้</h1>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <FaPlus className="w-4 h-4" />
              เพิ่มกลุ่มสาระใหม่
            </Button>
          </div>
          <p className="mt-1 text-gray-600">แสดงรายการกลุ่มสาระ (รหัส / ชื่อ)</p>
        </div>

        {/* Search */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="relative">
            <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <Input
              placeholder="ค้นหารหัสกลุ่มสาระ หรือชื่อกลุ่มสาระ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-10"
            />
          </div>
        </div>

        {/* Table (ไม่มีคอลัมน์ลำดับ) */}
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
                    {colWidths.map((c) => (
                      <col key={c} className={c} />
                    ))}
                  </colgroup>

                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr className="text-gray-600 uppercase">
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">รหัสกลุ่มสาระ</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชื่อกลุ่มสาระ</th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-gray-500">
                          ไม่พบข้อมูลกลุ่มสาระ
                        </td>
                      </tr>
                    ) : (
                      visible.map((group, idx) => (
                        <tr key={group.subject_group_id ?? `row-${startIdx + idx}`} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate">
                              {group.subject_group_id}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate">
                              {group.subject_group_name}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700"
                                onClick={() => {
                                  setSelectedSubjectGroup(group);
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
                                  setSelectedSubjectGroup(group);
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
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddSubjectGroupModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        fetchSubjectGroup={fetchSubjectGroups}
      />
      <EditSubjectGroupModal
        open={showEditModal}
        onOpenChange={(v) => {
          setShowEditModal(v);
          if (!v) setSelectedSubjectGroup(null);
        }}
        subjectGroup={selectedSubjectGroup}
        fetchSubjectGroup={fetchSubjectGroups}
      />
      <DeleteSubjectGroupModal
        open={showDeleteModal}
        onOpenChange={(v) => {
          setShowDeleteModal(v);
          if (!v) setSelectedSubjectGroup(null);
        }}
        subjectGroup={selectedSubjectGroup}
        fetchSubjectGroup={fetchSubjectGroups}
      />
    </div>
  );
}
