// app/user/leave-history/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import UserSidebar from "@/components/user/UserSidebar";
import LeaveHistoryTable, {
  LeaveHistoryItem,
} from "@/components/user/leave-history/LeaveHistoryTable";
import LeaveHistorySearch, {
  LeaveHistorySearchFilters,
} from "@/components/user/leave-history/LeaveHistorySearch";

type ApiListResponse = {
  items?: any[];
  data?: any[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
};

const CLIENT_PAGE_SIZE = 8;

/** map record จาก API → LeaveHistoryItem (รองรับหลาย key) */
function mapApiRowToItem(r: any): LeaveHistoryItem {
  // ✅ NORMALIZE FILES: ให้มี url เสมอ รองรับทั้งรูปแบบเดิมและ signedUrl
  const rawFiles = (r.files ?? r.file ?? []) as any[];
  const files = Array.isArray(rawFiles)
    ? rawFiles.map((f) => {
        // รองรับทั้งกรณี f เป็น string หรือ object
        const path = typeof f === "string" ? f : (f.path ?? "");
        const base = (String(path).split("?")[0] || "");
        const name =
          typeof f === "string"
            ? base.split("/").pop() || "file"
            : (f.name ?? base.split("/").pop() ?? "file");
        const url = (typeof f === "object" ? (f.url ?? f.signedUrl) : undefined) ?? path;
        return { name, path, url };
      })
    : [];

  return {
    id: r.id ?? r.leave_request_id ?? r.leaveId ?? crypto.randomUUID(),
    leave_type_name: r.leave_type_name ?? r.leaveType ?? null,
    leaveType: r.leaveType ?? r.leave_type_name ?? null,
    date_start: r.date_start ?? r.startDate ?? "",
    date_end: r.date_end ?? r.endDate ?? "",
    date_start_type: r.date_start_type ?? r.dateStartType ?? "เต็มวัน",
    date_end_type: r.date_end_type ?? r.dateEndType ?? "เต็มวัน",
    total_day: Number(r.total_day ?? r.totalDays ?? 0),
    totalDays: Number(r.total_day ?? r.totalDays ?? 0),
    startDate: r.date_start ?? r.startDate ?? "",
    endDate: r.date_end ?? r.endDate ?? "",
    reason: r.reason ?? "",
    file: files,
    files, // ✅ ใช้ไฟล์ที่ normalize แล้ว
    status: r.status ?? r.status_code ?? "pending",
    status_th: r.status_th ?? undefined,
    status_code:
      r.status_code ??
      (["pending", "approved", "rejected", "failed", "cancelled"].includes(
        String(r.status || "")
      )
        ? (r.status as any)
        : "unknown"),
    comment: r.comment ?? "",
    timestamp: r.timestamp ?? r.submittedAt ?? null,
    submittedAt: r.submittedAt ?? null,
    reviewed_at: r.reviewed_at ?? null,
    approved_at: r.approved_at ?? null,
    reviewed_by: r.reviewed_by ?? null,
    approved_by: r.approved_by ?? null,
    year: r.year ?? null,
  };
}

/** พ.ศ. → ค.ศ. (ถ้า >= 2400 ถือว่าเป็นปีไทย) */
function thaiYearToAD(y: number) {
  return y >= 2400 ? y - 543 : y;
}

/** แปลงปีงบประมาณแบบ พ.ศ. → ช่วงวันที่แบบ ค.ศ. (ISO yyyy-MM-dd)
 *  เช่น 2569 => 1 ต.ค. 2568 — 30 ก.ย. 2569
 */
function fiscalYearToRangeBE(fyStr?: string | null) {
  if (!fyStr) return null;
  const be = Number(fyStr);
  if (!Number.isFinite(be)) return null;
  const ad = thaiYearToAD(be);
  const start = new Date(ad - 1, 9, 1); // Oct 1
  const end = new Date(ad, 8, 30);      // Sep 30
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { startDate: toISO(start), endDate: toISO(end) };
}

/** เปรียบเทียบวันที่ในรูปแบบ yyyy-MM-dd (string) */
function isDateInRange(dateISO: string, startISO: string, endISO: string) {
  if (!dateISO) return false;
  return dateISO >= startISO && dateISO <= endISO;
}

/** แปลงโค้ดอังกฤษ → ภาษาไทย */
function thStatus(code: string | null | undefined): string {
  const k = String(code || "").toLowerCase();
  if (k === "pending" || k === "" || k === "unknown") return "รอพิจารณา";
  if (k === "approved") return "อนุมัติ";
  if (k === "rejected") return "ไม่อนุมัติ";
  if (k === "cancelled") return "ยกเลิก";
  if (k === "failed") return "ไม่ผ่านตรวจสอบ";
  return "รอพิจารณา"; // default
}

/** ดึง code อังกฤษที่น่าจะใช่ที่สุดจากแถว */
function statusCodeOf(row: LeaveHistoryItem): string {
  const s = String(row.status || "").toLowerCase();
  const c = String(row.status_code || "").toLowerCase();
  // ถ้า status เป็นคำไทย ให้พยายาม map กลับเป็น code
  const mapThToEn: Record<string, string> = {
    "รอพิจารณา": "pending",
    "อนุมัติ": "approved",
    "ไม่อนุมัติ": "rejected",
    "ยกเลิก": "cancelled",
    "ไม่ผ่านตรวจสอบ": "failed",
  };
  if (mapThToEn[s]) return mapThToEn[s];
  if (["pending","approved","rejected","cancelled","failed"].includes(s)) return s;
  if (["pending","approved","rejected","cancelled","failed"].includes(c)) return c;
  return "pending";
}

export default function LeaveHistoryPage() {
  // ====== ดิบจาก API (โหลดครั้งเดียว) ======
  const [rawRows, setRawRows] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ====== ฟิลเตอร์ + เพจจิเนชันฝั่ง client ======
  const [filters, setFilters] = useState<LeaveHistorySearchFilters>({
    startDate: "",
    endDate: "",
    fiscalYear: "",
    leaveType: "",
    status: "", // ตอนนี้คือตัวหนังสือ "ไทย" จาก Select
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = CLIENT_PAGE_SIZE;

  // ====== โหลดข้อมูลครั้งเดียว ======
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // ดึง page ใหญ่ๆ เพื่อเก็บมาทำ client-side
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "1000");

      const res = await fetch(`/api/user/leave-history?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`FETCH_FAILED_${res.status}`);

      const json: ApiListResponse = await res.json();
      const arr = (json.items ?? json.data ?? []) as any[];
      const mapped = arr.map(mapApiRowToItem);

      setRawRows(mapped);
    } catch (e: any) {
      console.error(e);
      setRawRows([]);
      setFetchError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ====== กรองข้อมูลบน client ======
  const filteredRows = useMemo(() => {
    const hasUserRange = Boolean(filters.startDate && filters.endDate);
    const fyRange = !hasUserRange && filters.fiscalYear
      ? fiscalYearToRangeBE(filters.fiscalYear)
      : null;

    // ค่าที่ผู้ใช้เลือก (ไทย) และโค้ดอังกฤษที่ยอมรับ
    const wantedTh = (filters.status || "").trim();
    const wantedEn = (() => {
      const m: Record<string, string> = {
        "รอพิจารณา": "pending",
        "อนุมัติ": "approved",
        "ไม่อนุมัติ": "rejected",
        "ยกเลิก": "cancelled",
        "ไม่ผ่านตรวจสอบ": "failed",
      };
      return m[wantedTh] || wantedTh.toLowerCase(); // ถ้าเผลอส่งอังกฤษมาก็รองรับ
    })();

    return rawRows.filter((r) => {
      // 1) กรองช่วงวัน
      if (hasUserRange) {
        if (!isDateInRange(r.date_start || r.startDate || "", filters.startDate!, filters.endDate!)) {
          return false;
        }
      } else if (fyRange) {
        if (!isDateInRange(r.date_start || r.startDate || "", fyRange.startDate, fyRange.endDate)) {
          return false;
        }
      }

      // 2) ประเภทการลา
      if (filters.leaveType && (r.leaveType ?? r.leave_type_name) !== filters.leaveType) {
        return false;
      }

      // 3) สถานะ: ให้แมทช์ได้ทั้งไทย/อังกฤษ
      if (filters.status) {
        const rowCode = statusCodeOf(r);      // en code จากแถว
        const rowTh = thStatus(rowCode);      // th จาก code
        const wantedThLower = wantedTh.toLowerCase();
        if (
          rowCode !== wantedEn &&                // เทียบอังกฤษกับอังกฤษ
          rowTh.toLowerCase() !== wantedThLower  // เทียบไทยกับไทย
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rawRows, filters]);

  // ====== แบ่งหน้า (client-side) ======
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / pageSize)),
    [filteredRows.length, pageSize]
  );

  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIdx, startIdx + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // ====== callback จาก Table ======
  async function handleReload() {
    await loadAll();
  }

  const handleUpdate = useCallback(
  async (
    id: string,
    payload: {
      reason?: string;
      startDate?: string;
      endDate?: string;
      date_start_type?: string;
      date_end_type?: string;
      total_day: number;
      __file?: File; // ✅ รองรับไฟล์จาก modal
    }
  ) => {
    const hasFile = !!payload.__file;

    if (hasFile) {
      // ✅ ส่งแบบ multipart/form-data เพื่อให้ API เข้าสาขาลบไฟล์เก่า + อัปโหลดไฟล์ใหม่
      const fd = new FormData();
      if (payload.reason !== undefined) fd.append("reason", payload.reason);
      if (payload.startDate) fd.append("date_start", payload.startDate);
      if (payload.endDate) fd.append("date_end", payload.endDate);
      if (payload.date_start_type) fd.append("date_start_type", payload.date_start_type);
      if (payload.date_end_type) fd.append("date_end_type", payload.date_end_type);
      fd.append("total_day", String(payload.total_day));
      fd.append("file", payload.__file as File);

      const res = await fetch(`/api/user/leave-history/${id}`, {
        method: "PATCH",
        body: fd, // ⛔️ อย่าตั้ง Content-Type เอง ให้ browser ใส่ boundary ให้
      });
      if (!res.ok) throw new Error("Update (multipart) failed");
    } else {
      // เดิม: อัปเดตเฉพาะฟิลด์ข้อความ
      const res = await fetch(`/api/user/leave-history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: payload.reason,
          date_start: payload.startDate,
          date_end: payload.endDate,
          date_start_type: payload.date_start_type,
          date_end_type: payload.date_end_type,
          total_day: payload.total_day,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
    }

    await handleReload();
  },
  [handleReload]
);


  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/user/leave-history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await handleReload();
    },
    [handleReload]
  );

  // ====== ปุ่มค้นหา/ล้าง (client-side) ======
  const handleSubmitSearch = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleResetSearch = useCallback(() => {
    setFilters({
      startDate: "",
      endDate: "",
      fiscalYear: "",
      leaveType: "",
      status: "",
    });
    setCurrentPage(1);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
          <UserSidebar />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">ประวัติการลา</h1>
        </div>

        {/* 🔎 แถบค้นหา/กรอง (ทำงาน client-side) */}
        <LeaveHistorySearch
          value={filters}
          onChange={setFilters}
          onSubmit={handleSubmitSearch}
          onReset={handleResetSearch}
          loading={loading}
        />

        
        {fetchError && (
          <div className="p-3 text-sm border rounded-md border-destructive/40 bg-destructive/10">
            เกิดข้อผิดพลาดในการโหลดข้อมูล: {fetchError}{" "}
            <button
              className="ml-2 underline"
              onClick={loadAll}
              disabled={loading}
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}
        <br />
        <LeaveHistoryTable
          rows={paginatedRows}
          loading={loading}
          onReload={handleReload}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
      </div>
    </div>
  );
}
