"use client";

import type { ReactNode } from "react";
import { Eye, FileText } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import { StatusPill } from "@/components/shared/LeaveSummary";
import { leaveCode, type LeaveItem } from "@/components/shared/types";
import { thaiDate } from "@/lib/format";

type Props = {
  title: string;
  rows: LeaveItem[];
  loading?: boolean;
  error?: string | null;
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (p: number) => void;
  /** แสดงคอลัมน์ผู้ยื่น (ฝั่งธุรการ/ผอ./วิชาการ) แทนลำดับ */
  showUser?: boolean;
  showStatus?: boolean;
  /** ปุ่มจัดการ (ค่าเริ่มต้น: ปุ่มดูรายละเอียด) */
  actionLabel?: string;
  onOpen?: (row: LeaveItem) => void;
  renderActions?: (row: LeaveItem) => ReactNode;
  emptyText?: string;
  pageSize?: number;
};

const th = "px-6 py-3 text-xs font-medium tracking-wider text-gray-500 uppercase";

export default function LeaveTable({
  title,
  rows,
  loading,
  error,
  page,
  totalPages,
  total,
  onPageChange,
  showUser = false,
  showStatus = true,
  actionLabel = "ดูรายละเอียด",
  onOpen,
  renderActions,
  emptyText = "ไม่พบข้อมูลตามเงื่อนไข",
  pageSize = 10,
}: Props) {
  const cols = 6 + (showStatus ? 1 : 0) + (renderActions || onOpen ? 1 : 0);

  return (
    <div className="mb-8 overflow-hidden bg-white shadow-sm rounded-xl">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>{showUser ? "รหัสลา" : "ลำดับ"}</th>
              {showUser && <th className={`${th} text-left`}>ผู้ยื่น</th>}
              <th className={`${th} text-left`}>ประเภทการลา</th>
              <th className={`${th} text-left`}>วันที่เริ่มลา</th>
              <th className={`${th} text-left`}>วันที่สิ้นสุด</th>
              <th className={`${th} text-center`}>จำนวนวัน</th>
              {showStatus && <th className={`${th} text-center`}>สถานะ</th>}
              {(renderActions || onOpen) && <th className={`${th} text-center`}>การจัดการ</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={cols + (showUser ? 1 : 0)} className="px-6 py-4">
                    <div className="h-5 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={cols + (showUser ? 1 : 0)} className="px-6 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={cols + (showUser ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <FileText className="w-12 h-12 mb-3 text-gray-300" />
                    <p>{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    {showUser ? (
                      <span className="font-mono text-blue-600">{leaveCode(r.id)}</span>
                    ) : (
                      (page - 1) * pageSize + idx + 1
                    )}
                  </td>
                  {showUser && (
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {r.user.fullName || "-"}
                      {r.user.email ? <div className="text-xs text-gray-500">{r.user.email}</div> : null}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{r.leaveType}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{thaiDate(r.startDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{thaiDate(r.endDate)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-center text-gray-900 whitespace-nowrap">{r.totalDays}</td>
                  {showStatus && (
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <StatusPill code={r.status_code} />
                    </td>
                  )}
                  {(renderActions || onOpen) && (
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {renderActions ? (
                        renderActions(r)
                      ) : (
                        <button
                          onClick={() => onOpen?.(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 transition-colors border border-blue-300 rounded hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                          {actionLabel}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={onPageChange} total={total} />
    </div>
  );
}
