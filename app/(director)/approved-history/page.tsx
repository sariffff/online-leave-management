// app/(director)/approved-history/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/director/sidebar";
import LeaveHistorySearch from "@/components/director/LeaveHistorySearch";
import LeaveHistoryTable, {
  LeaveHistoryItem,
} from "@/components/director/LeaveHistoryTable";

// ---------- Helpers: โหลดทุกหน้าให้ครบ ----------
async function fetchAllApproved(): Promise<LeaveHistoryItem[]> {
  // ดึงจาก /api/director/approved-history แบบไล่ page จนหมด
  const pageSize = 50; // ขอทีละเยอะ ๆ เพื่อลดรอบโหลด
  let page = 1;
  let acc: LeaveHistoryItem[] = [];

  const first = new URL("/api/director/approved-history", window.location.origin);
  first.searchParams.set("page", String(page));
  first.searchParams.set("pageSize", String(pageSize));
  const firstRes = await fetch(first.toString(), { cache: "no-store" });
  if (!firstRes.ok) throw new Error(`Fetch failed: ${firstRes.status}`);
  const firstJson = await firstRes.json();
  const totalPages = Number(firstJson?.totalPages ?? 1);
  acc = Array.isArray(firstJson?.data) ? (firstJson.data as LeaveHistoryItem[]) : [];

  for (page = 2; page <= totalPages; page++) {
    const u = new URL("/api/director/approved-history", window.location.origin);
    u.searchParams.set("page", String(page));
    u.searchParams.set("pageSize", String(pageSize));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) break;
    const json = await res.json();
    const items = Array.isArray(json?.data) ? (json.data as LeaveHistoryItem[]) : [];
    acc = acc.concat(items);
  }

  return acc;
}

// ดึงไฟล์แนบทั้งหมดจาก leave-review (คืน map: request_id -> files[])
type ReviewFile = { key: string; url: string | null };
type ReviewItem = { leave_request_id: number; files?: ReviewFile[] | null };
async function fetchAllReviewFiles(): Promise<Map<number, ReviewFile[]>> {
  const url = new URL("/api/director/leave-review", window.location.origin);
  // ถ้า API รองรับกรองสถานะ ใส่ได้ เช่น url.searchParams.set("status", "all");
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return new Map();
  const json = await res.json();
  const items: ReviewItem[] = Array.isArray(json?.items) ? json.items : [];
  const map = new Map<number, ReviewFile[]>();
  for (const it of items) {
    if (it?.leave_request_id != null && Array.isArray(it.files) && it.files.length > 0) {
      map.set(Number(it.leave_request_id), it.files.filter(Boolean) as ReviewFile[]);
    }
  }
  return map;
}

// รวม approved-history + signed URLs จาก leave-review
async function fetchAllWithFiles(): Promise<LeaveHistoryItem[]> {
  const [rows, fileMap] = await Promise.all([fetchAllApproved(), fetchAllReviewFiles()]);
  if (fileMap.size === 0) return rows;
  return rows.map((r) => {
    const idNum = Number(r.id);
    const files = fileMap.get(idNum);
    if (files && files.length > 0) {
      return {
        ...r,
        files: files.map((f) => ({
          name: f.key.split("/").pop() ?? f.key,
          path: f.key,
          url: f.url ?? undefined,
        })),
      };
    }
    return r;
  });
}

// ---------- Page ----------
type SearchState = {
  q?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: string; // พ.ศ.
  leaveType?: string;
  status?: string;     // ไทย: อนุมัติ/ไม่อนุมัติ/รอพิจารณา (หรือ ผ่าน/ไม่ผ่าน/รอพิจารณา ตามระบบคุณ)
};

const PAGE_SIZE = 10; // ✅ 10 แถวต่อหน้า (client-side)

export default function ApprovedHistoryPage() {
  const [allRows, setAllRows] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // client-side pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ฟอร์มค้นหา (controlled)
  const [search, setSearch] = useState<SearchState>({
    q: "",
    startDate: "",
    endDate: "",
    fiscalYear: "",
    leaveType: "",
    status: "",
  });

  // ฟิลเตอร์จริงที่ส่งให้ตาราง (คัดลอกจาก search เมื่อกดค้นหา)
  const [filters, setFilters] = useState<SearchState>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchAllWithFiles();
      setAllRows(items);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // โหลดครั้งแรก
    loadAll();
  }, [loadAll]);

  const submitSearch = () => {
    setFilters(search); // ✅ ให้ตารางกรองเอง (รวม q/start/end/fiscalYear/leaveType/status)
    setCurrentPage(1);
  };

  const resetSearch = () => {
    const empty: SearchState = { q: "", startDate: "", endDate: "", fiscalYear: "", leaveType: "", status: "" };
    setSearch(empty);
    setFilters({});
    setCurrentPage(1);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          <div className="mb-4 text-xl font-semibold">ประวัติการอนุมัติใบลา</div>

          {/* ใช้คอมโพเนนต์ค้นหาเวอร์ชัน director ที่คุณมีอยู่ */}
          <LeaveHistorySearch
            value={search}
            onChange={setSearch}
            onSubmit={submitSearch}
            onReset={resetSearch}
            loading={loading}
          />

          <br />

          {/* ตารางจะ slice ทีละ 10 เอง (ไม่ต้องแก้ API เวลาเปลี่ยนหน้า) */}
          <LeaveHistoryTable
            data={allRows}
            filters={filters}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={PAGE_SIZE}
          />

          {loading && <div className="mt-4 text-sm text-gray-500">กำลังโหลดข้อมูล…</div>}
        </div>
      </div>
    </div>
  );
}
