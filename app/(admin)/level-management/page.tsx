"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { FaSearch, FaPlus, FaEdit, FaTrashAlt } from "react-icons/fa";

type Level = { level_id: string; level_name: string };

export default function LevelPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // pagination (per page = 10)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Level | null>(null);

  // form state
  const [formAdd, setFormAdd] = useState<{ level_id?: string; level_name: string }>({ level_id: "", level_name: "" });
  const [formEdit, setFormEdit] = useState<{ level_id?: string; level_name: string }>({ level_id: "", level_name: "" });

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/levelmanagement", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "โหลดระดับชั้นไม่สำเร็จ");
      setLevels(Array.isArray(json?.levels) ? json.levels : []);
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาด");
      setLevels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  // filter + memo
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return levels;
    return levels.filter((lv) => `${lv.level_id} ${lv.level_name}`.toLowerCase().includes(term));
  }, [levels, search]);

  // reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // pagination calc
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filtered.slice(startIdx, endIdx);

  // col widths (รหัส / ชื่อ / การจัดการ)
  const colWidths = ["w-[16rem]", "w-[28rem]", "w-40"];

  const onSaveAdd = async () => {
    if (!formAdd.level_name.trim()) {
      alert("กรุณากรอกชื่อระดับชั้น");
      return;
    }
    try {
      const res = await fetch("/api/admin/levelmanagement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          level_id: formAdd.level_id || undefined,
          level_name: formAdd.level_name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "เพิ่มไม่สำเร็จ");
      setOpenAdd(false);
      setFormAdd({ level_id: "", level_name: "" });
      fetchLevels();
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาด");
    }
  };

  const openEditModal = (row: Level) => {
    setEditing(row);
    setFormEdit({ level_id: row.level_id, level_name: row.level_name });
    setOpenEdit(true);
  };

  const onSaveEdit = async () => {
    if (!formEdit.level_id) return alert("ไม่พบรหัส");
    if (!formEdit.level_name.trim()) return alert("กรุณากรอกชื่อระดับชั้น");
    try {
      const res = await fetch(`/api/admin/levelmanagement/${formEdit.level_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ level_name: formEdit.level_name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "แก้ไขไม่สำเร็จ");
      setOpenEdit(false);
      setEditing(null);
      fetchLevels();
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาด");
    }
  };

  const onDelete = async (row: Level) => {
    if (!confirm(`ยืนยันลบระดับชั้น "${row.level_name}" ?`)) return;
    try {
      const res = await fetch(`/api/admin/levelmanagement/${row.level_id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "ลบไม่สำเร็จ");
      }
      fetchLevels();
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาด");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">จัดการระดับชั้น</h1>
            <Button onClick={() => setOpenAdd(true)} className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <FaPlus className="w-4 h-4" />
              เพิ่มระดับชั้น
            </Button>
          </div>
          <p className="mt-1 text-gray-600">แสดงรายการระดับชั้น (เช่น ป.1, ป.2, …)</p>
        </div>

        {/* Search */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="relative">
            <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <Input
              placeholder="ค้นหา (รหัส/ชื่อระดับชั้น)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-10"
            />
          </div>
        </div>

        {/* Table (compact + colgroup + pagination) */}
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
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">รหัส</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชื่อระดับชั้น</th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-gray-500">
                          ไม่พบข้อมูลระดับชั้น
                        </td>
                      </tr>
                    ) : (
                      visible.map((lv) => (
                        <tr key={lv.level_id} className="transition-colors border-b hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate">{lv.level_id}</div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-900 truncate">{lv.level_name}</div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700"
                                onClick={() => openEditModal(lv)}
                              >
                                <FaEdit className="w-3 h-3" />
                                แก้ไข
                              </Button>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-red-600 rounded hover:bg-red-700"
                                onClick={() => onDelete(lv)}
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

      {/* Add Modal */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มระดับชั้น</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="add_level_name">ชื่อระดับชั้น *</Label>
              <Input
                id="add_level_name"
                value={formAdd.level_name}
                onChange={(e) => setFormAdd((p) => ({ ...p, level_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenAdd(false)}>ยกเลิก</Button>
            <Button onClick={onSaveAdd}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>แก้ไขระดับชั้น</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>รหัส</Label>
              <Input value={formEdit.level_id ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="edit_level_name">ชื่อระดับชั้น *</Label>
              <Input
                id="edit_level_name"
                value={formEdit.level_name}
                onChange={(e) => setFormEdit((p) => ({ ...p, level_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenEdit(false)}>ยกเลิก</Button>
            <Button onClick={onSaveEdit}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
