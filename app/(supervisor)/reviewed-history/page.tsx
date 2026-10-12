// app/supervisor/reviewed-history/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import UserSidebar from "@/components/supervisor/sidebar";
import LeaveHistorySearch from "@/components/supervisor/LeaveHistorySearch";
import LeaveHistoryTable, { LeaveHistoryItem } from "@/components/supervisor/LeaveHistoryTable";

// ดึง “ข้อมูลทั้งหมด” จาก reviewed-history (ไล่ทุกหน้า)
async function fetchAllReviewed(): Promise<LeaveHistoryItem[]> {
  const pageSize = 50;
  let page = 1;
  let acc: LeaveHistoryItem[] = [];

  const firstUrl = new URL("/api/supervisor/reviewed-history", window.location.origin);
  firstUrl.searchParams.set("page", String(page));
  firstUrl.searchParams.set("pageSize", String(pageSize));
  const firstRes = await fetch(firstUrl.toString(), { cache: "no-store" });
  if (!firstRes.ok) throw new Error(`Fetch failed: ${firstRes.status}`);
  const first = await firstRes.json();
  const totalPages = Number(first?.totalPages ?? 1);
  acc = Array.isArray(first?.data) ? first.data : [];

  for (page = 2; page <= totalPages; page++) {
    const u = new URL("/api/supervisor/reviewed-history", window.location.origin);
    u.searchParams.set("page", String(page));
    u.searchParams.set("pageSize", String(pageSize));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) break;
    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];
    acc = acc.concat(items as LeaveHistoryItem[]);
  }

  return acc;
}

// ดึงไฟล์แนบ (มี signed URL) จาก leave-review แล้วคืน map: id -> files[]
type ReviewFile = { key: string; url: string | null };
type ReviewItem = { leave_request_id: number; files?: ReviewFile[] | null };
async function fetchAllReviewFiles(): Promise<Map<number, ReviewFile[]>> {
  const url = new URL("/api/supervisor/leave-review", window.location.origin);
  url.searchParams.set("status", "all");
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

// รวมข้อมูล reviewed-history + ไฟล์แนบจาก leave-review
async function fetchAllWithFiles(): Promise<LeaveHistoryItem[]> {
  const [rows, fileMap] = await Promise.all([fetchAllReviewed(), fetchAllReviewFiles()]);
  if (fileMap.size === 0) return rows;
  return rows.map((r) => {
    const idNum = Number(r.id);
    const files = fileMap.get(idNum);
    if (files && files.length > 0) {
      return {
        ...r,
        files: files.map((f) => ({ name: f.key.split("/").pop() ?? f.key, path: f.key, url: f.url ?? undefined })),
      };
    }
    return r;
  });
}

type SearchState = {
  q?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: string; // พ.ศ.
  leaveType?: string;
  status?: string;     // ไทย
};

export default function ReviewedHistoryPage() {
  const [allRows, setAllRows] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // pagination ฝั่ง client
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // state ของฟอร์มค้นหา (controlled)
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
    loadAll();
  }, [loadAll]);

  const submitSearch = () => {
    setFilters(search); // ✅ กรองในตาราง
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
      <UserSidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          <div className="mb-4 text-xl font-semibold">ประวัติใบลาที่ “ตรวจสอบแล้ว”</div>

          <LeaveHistorySearch
            value={search}
            onChange={setSearch}
            onSubmit={submitSearch}
            onReset={resetSearch}
            loading={loading}
          />
          <br />
          <LeaveHistoryTable
            data={allRows}
            filters={filters}              // ✅ client-side filtering (รวม q)
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
          />
        </div>
      </div>
    </div>
  );
}