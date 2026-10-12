// app/admin/classroommanagement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FaEdit, FaTrashAlt, FaPlus, FaSearch } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// ===== Types =====
type Level = {
  level_id: string;
  level_name: string;
};

type ClassroomRow = {
  classroom_id: string;
  classroom_name: string;
  classroom_level: string | null; // FK (nullable)
  level_name: string | null;      // joined from level
};

type UIClassroom = ClassroomRow & { display_level: string };

// ===== Utils =====
const mapDisplayLevel = (level_name: string | null) => level_name ?? "ส่วนรวม";

export default function ClassroomManagementPage() {
  // data states
  const [levels, setLevels] = useState<Level[]>([]);
  const [classrooms, setClassrooms] = useState<UIClassroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // search
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ pagination (per page = 10)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLevel, setAddLevel] = useState<string>("null");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState<string>("null");

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");

  // ===== Fetchers =====
  async function loadLevels() {
    const res = await fetch("/api/admin/levelmanagement", { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "โหลดระดับชั้นไม่สำเร็จ");
    const arr: Level[] = (j.level || j.levels || []).map((x: any) => ({
      level_id: String(x.level_id),
      level_name: x.level_name,
    }));
    setLevels(arr);
  }

  async function loadClassrooms() {
    const res = await fetch("/api/admin/classroommanagement", { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "โหลดห้องเรียนไม่สำเร็จ");
    const items: ClassroomRow[] = Array.isArray(j.classroom) ? j.classroom : [];
    setClassrooms(
      items.map((x) => ({
        ...x,
        display_level: mapDisplayLevel(x.level_name),
      }))
    );
  }

  async function reloadAll() {
    setErrorMsg(null);
    setLoading(true);
    try {
      await Promise.all([loadLevels(), loadClassrooms()]);
    } catch (e: any) {
      setErrorMsg(e?.message || "เกิดข้อผิดพลาด");
      setClassrooms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Derived =====
  const levelOptions = useMemo<Level[]>(() => {
    return [{ level_id: "null", level_name: "ส่วนรวม" }, ...levels];
  }, [levels]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return classrooms;
    return classrooms.filter((c) =>
      `${c.classroom_id} ${c.classroom_name} ${c.display_level}`
        .toLowerCase()
        .includes(term)
    );
  }, [classrooms, searchTerm]);

  // ✅ reset หน้าเมื่อค้นหาเปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ✅ pagination calc เหมือน usermanagement
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filtered.slice(startIdx, endIdx);

  // ✅ col widths (รหัส/ชื่อ/ระดับ/การจัดการ) — ใช้ map กัน whitespace ใน <colgroup>
  const colWidths = ["w-[14rem]", "w-[22rem]", "w-[18rem]", "w-44"];

  // ===== Actions: Create / Edit / Delete =====
  async function onCreateClassroom() {
    setErrorMsg(null);
    if (!addName.trim()) {
      setErrorMsg("กรุณากรอกชื่อห้องเรียน");
      return;
    }
    const payload = {
      classroom_name: addName.trim(),
      classroom_level: addLevel === "null" ? null : addLevel,
    };
    const res = await fetch("/api/admin/classroommanagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(j?.error || "เพิ่มห้องเรียนไม่สำเร็จ");
      return;
    }
    // reset form
    setAddName("");
    setAddLevel("null");
    setAddOpen(false);
    await loadClassrooms();
  }

  function openEdit(row: UIClassroom) {
    setEditId(row.classroom_id);
    setEditName(row.classroom_name);
    setEditLevel(row.classroom_level ?? "null");
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editId) return;
    setErrorMsg(null);
    if (!editName.trim()) {
      setErrorMsg("กรุณากรอกชื่อห้องเรียน");
      return;
    }
    const payload = {
      classroom_name: editName.trim(),
      classroom_level: editLevel === "null" ? null : editLevel,
    };
    const res = await fetch(`/api/admin/classroommanagement/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(j?.error || "แก้ไขห้องเรียนไม่สำเร็จ");
      return;
    }
    setEditOpen(false);
    setEditId(null);
    await loadClassrooms();
  }

  function openDelete(row: UIClassroom) {
    setDeleteId(row.classroom_id);
    setDeleteName(row.classroom_name);
    setDeleteOpen(true);
  }

  async function onConfirmDelete() {
    if (!deleteId) return;
    setErrorMsg(null);
    const res = await fetch(`/api/admin/classroommanagement/${deleteId}`, {
      method: "DELETE",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(j?.error || "ลบห้องเรียนไม่สำเร็จ");
      return;
    }
    setDeleteOpen(false);
    setDeleteId(null);
    await loadClassrooms();
  }

  // ===== Render =====
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">จัดการห้องเรียน</h1>
            <Button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              <FaPlus className="w-4 h-4" />
              เพิ่มห้อง
            </Button>
          </div>
          <p className="mt-1 text-gray-600">แสดงรายการห้องเรียนทั้งหมด</p>
        </div>

        {/* Search */}
        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="relative">
            <FaSearch className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <Input
              placeholder="ค้นหา (รหัส/ชื่อห้อง/ระดับชั้น)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-10"
            />
          </div>
          {errorMsg && (
            <div className="mt-3 text-sm text-red-600">{errorMsg}</div>
          )}
        </div>

        {/* ✅ Table: compact + colgroup + pagination */}
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
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">รหัสห้อง</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชื่อห้อง</th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">ระดับชั้น</th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-gray-500">
                          ไม่พบข้อมูลห้องเรียน
                        </td>
                      </tr>
                    ) : (
                      visible.map((room) => (
                        <tr
                          key={room.classroom_id}
                          className="transition-colors border-b hover:bg-gray-50"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate">
                              {room.classroom_id}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-900 truncate">
                              {room.classroom_name}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-gray-700 truncate">
                              {room.display_level}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700"
                                onClick={() => openEdit(room)}
                              >
                                <FaEdit className="w-3 h-3" />
                                แก้ไข
                              </Button>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-red-600 rounded hover:bg-red-700"
                                onClick={() => openDelete(room)}
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

              {/* ✅ Pagination แบบ usermanagement */}
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

      {/* ===== Add Modal ===== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มห้องเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="add_classroom_name">ชื่อห้องเรียน *</Label>
              <Input
                id="add_classroom_name"
                placeholder="เช่น ห้อง ป.1/1"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div>
              <Label>ระดับชั้น</Label>
              <Select value={addLevel} onValueChange={setAddLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกระดับชั้น" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((lv) => (
                    <SelectItem key={lv.level_id} value={lv.level_id}>
                      {lv.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                ถ้าไม่เลือกระดับ ให้ใช้ “ส่วนรวม”
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={onCreateClassroom}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Modal ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>แก้ไขห้องเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>รหัส</Label>
              <Input value={editId ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="edit_classroom_name">ชื่อห้องเรียน *</Label>
              <Input
                id="edit_classroom_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label>ระดับชั้น</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกระดับชั้น" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((lv) => (
                    <SelectItem key={lv.level_id} value={lv.level_id}>
                      {lv.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={onSaveEdit}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Modal ===== */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ลบห้องเรียน</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            ต้องการลบห้อง <span className="font-medium">{deleteName}</span> ใช่หรือไม่?
          </p>
          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete}>
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
