"use client";

import type { ReactNode } from "react";
import { CalendarDays, Eye, FileText } from "lucide-react";
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

const th = "px-4 py-3 text-xs font-medium tracking-wide text-gray-500 lg:px-6";
const td = "px-4 py-3 text-sm text-gray-900 lg:px-6";

/** ช่วงวันที่แบบสั้น: "16 พ.ย. 2569" หรือ "16 พ.ย. 2569 – 18 พ.ย. 2569" */
const dateRange = (r: LeaveItem) =>
  r.startDate === r.endDate ? thaiDate(r.startDate, true) : `${thaiDate(r.startDate, true)} – ${thaiDate(r.endDate, true)}`;

/**
 * ตารางใบลาที่ใช้ร่วมกันทุกบทบาท
 *  - จอ ≥ xl (1280px): ตาราง
 *  - เล็กกว่านั้น: การ์ดทีละใบลา (2 คอลัมน์ตั้งแต่ sm) ปุ่มกว้างเต็ม กดง่าย
 */
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
  const hasActions = !!(renderActions || onOpen);
  const cols = 5 + (showUser ? 1 : 0) + (showStatus ? 1 : 0) + (hasActions ? 1 : 0);

  const actions = (r: LeaveItem, mobile = false) =>
    renderActions ? (
      renderActions(r)
    ) : (
      <button
        onClick={() => onOpen?.(r)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 px-3 text-sm text-blue-700 transition-colors hover:bg-blue-50 ${mobile ? "h-10 w-full" : "h-8"}`}
      >
        <Eye className="w-4 h-4" />
        {actionLabel}
      </button>
    );

  const state = loading ? "loading" : error ? "error" : rows.length === 0 ? "empty" : "rows";

  const emptyBox = (
    <div className="flex flex-col items-center px-6 py-12 text-center text-gray-500">
      <FileText className="w-12 h-12 mb-3 text-gray-300" />
      <p>{emptyText}</p>
    </div>
  );

  return (
    <section className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
      <div className="px-4 py-3 border-b border-gray-200 sm:px-6 sm:py-4">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
      </div>

      {/* จอเล็กกว่า xl (มือถือ/แท็บเล็ต/โน้ตบุ๊กที่มีเมนูด้านข้าง): การ์ด — แท็บเล็ตขึ้นไปเรียง 2 คอลัมน์ */}
      <div className="xl:hidden">
        {state === "loading" && (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}
        {state === "error" && <div className="px-4 py-10 text-center text-red-600">{error}</div>}
        {state === "empty" && emptyBox}
        {state === "rows" && (
          <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
            {rows.map((r, idx) => (
              <li key={r.id} className="flex flex-col p-4 space-y-2 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                      {showUser ? <span className="font-mono text-blue-600">{leaveCode(r.id)}</span> : `#${(page - 1) * pageSize + idx + 1}`}
                    </div>
                    {showUser && (
                      <>
                        <div className="font-medium text-gray-900 truncate">{r.user.fullName || "-"}</div>
                        {r.user.email && <div className="text-xs text-gray-500 truncate">{r.user.email}</div>}
                      </>
                    )}
                    <div className={showUser ? "text-sm text-gray-700" : "font-medium text-gray-900"}>{r.leaveType}</div>
                  </div>
                  {showStatus && <StatusPill code={r.status_code} />}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{dateRange(r)}</span>
                  <span className="ml-auto font-semibold text-gray-900 whitespace-nowrap">{r.totalDays} วัน</span>
                </div>
                {/* ปุ่มกว้างเต็มการ์ด สูง 40px — ถ้ามีหลายปุ่มแบ่งความกว้างเท่ากัน */}
                {hasActions && <div className="pt-1 mt-auto *:w-full [&_button]:h-10 [&_button]:flex-1">{actions(r, true)}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* จอ xl ขึ้นไป: ตาราง */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>{showUser ? "รหัสลา" : "ลำดับ"}</th>
              {showUser && <th className={`${th} text-left`}>ผู้ยื่น</th>}
              <th className={`${th} text-left`}>ประเภทการลา</th>
              <th className={`${th} text-left whitespace-nowrap`}>วันที่เริ่มลา</th>
              <th className={`${th} text-left whitespace-nowrap`}>วันที่สิ้นสุด</th>
              <th className={`${th} text-center whitespace-nowrap`}>จำนวนวัน</th>
              {showStatus && <th className={`${th} text-center`}>สถานะ</th>}
              {hasActions && <th className={`${th} text-center`}>การจัดการ</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {state === "loading" &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={cols} className="px-6 py-4">
                    <div className="h-5 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            {state === "error" && (
              <tr>
                <td colSpan={cols} className="px-6 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {state === "empty" && (
              <tr>
                <td colSpan={cols}>{emptyBox}</td>
              </tr>
            )}
            {state === "rows" &&
              rows.map((r, idx) => (
                <tr key={r.id} className="transition-colors hover:bg-gray-50">
                  <td className={`${td} font-medium whitespace-nowrap`}>
                    {showUser ? <span className="font-mono text-blue-600">{leaveCode(r.id)}</span> : (page - 1) * pageSize + idx + 1}
                  </td>
                  {showUser && (
                    <td className={`${td} min-w-44`}>
                      <div>{r.user.fullName || "-"}</div>
                      {r.user.email ? <div className="text-xs text-gray-500 break-all">{r.user.email}</div> : null}
                    </td>
                  )}
                  <td className={`${td} min-w-28`}>{r.leaveType}</td>
                  <td className={`${td} whitespace-nowrap`}>{thaiDate(r.startDate, true)}</td>
                  <td className={`${td} whitespace-nowrap`}>{thaiDate(r.endDate, true)}</td>
                  <td className={`${td} font-semibold text-center whitespace-nowrap`}>{r.totalDays}</td>
                  {showStatus && (
                    <td className={`${td} text-center whitespace-nowrap`}>
                      <StatusPill code={r.status_code} />
                    </td>
                  )}
                  {hasActions && <td className={`${td} text-center whitespace-nowrap`}>{actions(r)}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={onPageChange} total={total} />
    </section>
  );
}
