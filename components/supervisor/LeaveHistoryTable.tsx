// components/supervisor/LeaveHistoryTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileText, Search } from "lucide-react";
import ReviewHistoryModal from "@/components/supervisor/modals/ReviewHistoryModal";
import type { InboxItem } from "@/components/supervisor/modals/ReviewHistoryModal";

type LeaveStatusEN =
  | "pending"
  | "reviewed"
  | "approved"
  | "rejected"
  | "failed"
  | "fail"
  | "cancelled"
  | string;

export type LeaveHistoryItem = {
  id: string | number;

  leaveType?: string | null;
  leave_type_name?: string | null;
  type_name?: string | null;

  dateStart?: string | null;
  dateEnd?: string | null;
  date_start?: string | null;
  date_end?: string | null;

  dateStartType?: string | null;
  dateEndType?: string | null;
  date_start_type?: string | null;
  date_end_type?: string | null;

  totalDay?: number | null;
  total_day?: number | null;

  reason?: string | null;
  comment?: string | null;

  files?: Array<{ name?: string; path?: string; url?: string } | string> | null;
  file?: Array<{ name?: string; path?: string; url?: string } | string> | null;

  user?: { name?: string; surname?: string; email?: string } | null;
  profile?: { name?: string; surname?: string; email?: string } | null;

  status?: LeaveStatusEN;
  status_code?: string | null;
  statusLabel?: string | null;

  year?: number | string | null;

  // ฟิลด์โชว์ตรง
  totalDays: number | null;
  startDate: string;
  endDate: string;

  [key: string]: any;
};

// ฟิลเตอร์ (รองรับ q เหมือนเดิม; ถ้าไม่ใช้ q ก็ปล่อยว่างได้)
export type LeaveHistorySearchFilters = {
  q?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: number | string; // พ.ศ.
  leaveType?: string;
  status?: string;       // ค่าไทย ("ผ่าน" | "ไม่ผ่าน" | "รอพิจารณา" | "")
  year?: number | string; // เผื่อของเดิม
};

interface LeaveHistoryTableProps {
  data?: LeaveHistoryItem[];
  rows?: LeaveHistoryItem[];
  items?: LeaveHistoryItem[];
  filters?: LeaveHistorySearchFilters;

  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;

  totalRecords?: number;
  totalPages?: number;
}

const monthsTH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

const formatDateTH = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(+d)) return "-";
  const buddhistYear = d.getFullYear() + 543;
  return `${d.getDate()} ${monthsTH[d.getMonth()]} ${buddhistYear}`;
};

// ← ใช้ “สถานะจริง” จาก DB โดยตรง
const STATUS_TH_SHORT: Record<string, "ผ่าน" | "ไม่ผ่าน" | "รอพิจารณา" | "อื่นๆ"> = {
  pending: "รอพิจารณา",
  reviewed: "ผ่าน",
  approved: "ผ่าน",
  rejected: "ไม่ผ่าน",
  failed: "ไม่ผ่าน",
  fail: "ไม่ผ่าน",
  cancelled: "อื่นๆ",
};
const toShortTHFromRaw = (raw?: string): "ผ่าน" | "ไม่ผ่าน" | "รอพิจารณา" | "อื่นๆ" => {
  const key = (raw || "").toLowerCase();
  return STATUS_TH_SHORT[key] ?? "อื่นๆ";
};
const toTHBadgeClass = (shortTH: ReturnType<typeof toShortTHFromRaw>) => {
  if (shortTH === "ผ่าน") return "bg-green-100 text-green-800 border-green-200";
  if (shortTH === "ไม่ผ่าน") return "bg-red-100 text-red-800 border-red-200";
  if (shortTH === "รอพิจารณา") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

const normalizeFilterStatus = (
  thai?: string
): "" | "ผ่าน" | "ไม่ผ่าน" | "รอพิจารณา" => {
  const t = (thai || "").trim();
  if (!t) return "";
  if (t === "ผ่าน") return "ผ่าน";
  if (t === "ไม่ผ่าน") return "ไม่ผ่าน";
  if (t === "รอพิจารณา") return "รอพิจารณา";
  return "";
};

const toHalfKey = (v?: string | null): "full" | "am" | "pm" | undefined => {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (["am", "เช้า", "ครึ่งเช้า"].includes(s)) return "am";
  if (["pm", "บ่าย", "ครึ่งบ่าย"].includes(s)) return "pm";
  if (["เต็มวัน", "full", "all"].includes(s)) return "full";
  return undefined;
};

// ปีงบ (พ.ศ.) จากวันที่ ISO: ต.ค.–ก.ย.
const fiscalYearBEFromDateString = (iso?: string): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(+d)) return null;
  const fyGregorian = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  return fyGregorian + 543;
};

// รหัสลา Lxxx
const formatId = (id: string | number) => {
  const s = String(id);
  const n = Number(s);
  if (!Number.isNaN(n) && Number.isFinite(n)) return `L${String(n).padStart(3, "0")}`;
  return s;
};

// ใช้สถานะจริงจาก DB (ไม่ normalize ตัด approved/failed ทิ้ง)
const getRawStatus = (row: LeaveHistoryItem) =>
  String(row.status ?? row.status_code ?? "").toLowerCase();

// map → InboxItem (เปิดโมดัลอ่านอย่างเดียว)
const toInboxItem = (row: LeaveHistoryItem): InboxItem => {
  const leave_type_name = row.leaveType ?? row.leave_type_name ?? row.type_name ?? null;

  const date_start = row.date_start ?? row.dateStart ?? row.startDate ?? undefined;
  const date_end   = row.date_end   ?? row.dateEnd   ?? row.endDate   ?? undefined;
  const date_start_type = toHalfKey(row.date_start_type ?? row.dateStartType) ?? undefined;
  const date_end_type   = toHalfKey(row.date_end_type   ?? row.dateEndType)   ?? undefined;

  const total_day = Number(row.total_day ?? row.totalDay ?? row.totalDays ?? 0) || undefined;

  const raw = getRawStatus(row);
  const status: "pending" | "reviewed" | "fail" | undefined =
    raw === "pending" ? "pending" :
    raw === "reviewed" || raw === "approved" ? "reviewed" :
    raw === "rejected" || raw === "failed" || raw === "fail" ? "fail" :
    raw ? "reviewed" : undefined;

  const rawFiles = Array.isArray(row.files) ? row.files : Array.isArray(row.file) ? row.file : [];
  const files: InboxItem["files"] =
    rawFiles?.map((f: any, i: number) => {
      const name = typeof f === "string" ? f : f?.name ?? f?.path ?? `file_${i + 1}`;
      const url  = typeof f === "string" ? undefined : f?.url ?? undefined;
      const key  = (typeof f === "string" ? f : f?.path ?? f?.name) ?? name;
      return { key: String(key), url: url && String(url).startsWith("http") ? String(url) : null };
    }) ?? [];

  const user =
    row.user ??
    (row.profile ? { name: row.profile?.name, surname: row.profile?.surname, email: row.profile?.email } : undefined);

  return {
    leave_request_id: Number(row.id),
    status,
    reason: row.reason ?? undefined,
    date_start,
    date_end,
    date_start_type,
    date_end_type,
    total_day,
    leave_type_name,
    user,
    files,
  };
};

const LeaveHistoryTable: React.FC<LeaveHistoryTableProps> = ({
  data,
  rows,
  items,
  filters,
  currentPage,
  onPageChange,
  pageSize = 10,
}) => {
  const safeList: LeaveHistoryItem[] = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(rows)) return rows;
    if (Array.isArray(items)) return items;
    return [];
  }, [data, rows, items]);

  // ✅ กรองทั้งหมดฝั่ง client (สถานะใช้ค่าจริงจาก DB)
  const filtered = useMemo(() => {
    const f = filters ?? {};
    const qtext = (f.q || "").trim().toLowerCase();
    const start = f.startDate ? new Date(f.startDate) : null;
    const endDt = f.endDate   ? new Date(f.endDate)   : null;

    // รองรับ fiscalYear (ใหม่) และ year (เดิม)
    const fyParam = ((): number | undefined => {
      const val = f.fiscalYear ?? f.year;
      if (val === undefined || val === null || val === "") return undefined;
      const n = typeof val === "string" ? Number(val) : val;
      return Number.isFinite(n as number) ? (n as number) : undefined;
    })();

    const statusFilterShort = normalizeFilterStatus(f.status);

    return safeList.filter((row) => {
      // คำค้น: ชื่อ-สกุล, ประเภทลา, รหัสลา
      if (qtext) {
        const fullName = `${row.user?.name ?? ""} ${row.user?.surname ?? ""}`.trim().toLowerCase();
        const typeName = (row.leaveType ?? row.leave_type_name ?? row.type_name ?? "").trim().toLowerCase();
        const idStr    = `l${String(row.id ?? "").padStart(3, "0")}`;
        if (!fullName.includes(qtext) && !typeName.includes(qtext) && !idStr.includes(qtext)) {
          return false;
        }
      }

      // ประเภทลา
      if (f.leaveType) {
        const t = row.leaveType ?? row.leave_type_name ?? row.type_name ?? "";
        if (t !== f.leaveType) return false;
      }

      // สถานะ (ไทย) จากสถานะจริง DB
      if (statusFilterShort) {
        const short = toShortTHFromRaw(getRawStatus(row));
        if (short !== statusFilterShort) return false;
      }

      // ช่วงวันที่ (ยึดวันที่เริ่มลา)
      const sDateStr = row.startDate ?? row.dateStart ?? row.date_start ?? "";
      const s = new Date(sDateStr);
      if (!isNaN(+s)) {
        if (start && s < start) return false;
        if (endDt && s > endDt) return false;
      }

      // ปีงบประมาณ (พ.ศ.)
      if (fyParam) {
        const rowYear = row.year != null ? (typeof row.year === "string" ? Number(row.year) : row.year) : null;
        if (rowYear && !Number.isNaN(rowYear)) {
          if (rowYear !== fyParam) return false;
        } else {
          const fyBE = fiscalYearBEFromDateString(sDateStr);
          if (fyBE && fyBE !== fyParam) return false;
        }
      }

      return true;
    });
  }, [safeList, filters]);

  // แบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const visible = filtered.slice(startIdx, endIdx);

  // โมดัล
  const [selected, setSelected] = useState<LeaveHistoryItem | null>(null);
  const [open, setOpen] = useState(false);
  const selectedInbox: InboxItem | null = useMemo(() => (selected ? toInboxItem(selected) : null), [selected]);
  const handleOpen = (row: LeaveHistoryItem) => { setSelected(row); setOpen(true); };
  const handleClose = () => { setOpen(false); setSelected(null); };

  return (
    <>
      <div className="mb-8 overflow-hidden bg-white shadow-sm rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">ประวัติการตรวจสอบใบลา</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">รหัสลา</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">ประเภทการลา</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">วันที่เริ่มลา</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">วันที่สิ้นสุดการลา</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">จำนวนวัน</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">การจัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-12 h-12 mb-3 text-gray-300" />
                      <p>ไม่พบข้อมูลตามเงื่อนไข</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const leaveName = row.leaveType ?? row.leave_type_name ?? row.type_name ?? "-";
                  const start = row.startDate ?? row.dateStart ?? row.date_start;
                  const end   = row.endDate   ?? row.dateEnd   ?? row.date_end;
                  const total = row.totalDays ?? row.total_day ?? row.totalDay ?? "-";

                  const shortTH  = toShortTHFromRaw(getRawStatus(row)); // ← ใช้สถานะจริงจาก DB
                  const badgeCls = toTHBadgeClass(shortTH);

                  return (
                    <tr key={row.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-blue-600">{formatId(row.id)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{leaveName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{formatDateTH(start || "")}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{formatDateTH(end || "")}</span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">{total}</span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeCls}`}>
                          {shortTH}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpen(row)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 transition-colors border border-blue-300 rounded hover:text-blue-700 hover:bg-blue-50"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">หน้า {safePage} จาก {totalPages}</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPageChange(safePage - 1)}
                  disabled={safePage === 1}
                  className="p-2 text-gray-500 transition-colors rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">{safePage}</span>
                <button
                  onClick={() => onPageChange(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="p-2 text-gray-500 transition-colors rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedInbox && (
        <ReviewHistoryModal open={open} item={selectedInbox} onClose={handleClose} />
      )}
    </>
  );
};

export default LeaveHistoryTable;
