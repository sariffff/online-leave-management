"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** เลขหน้าที่จะแสดง: 1 … 4 5 6 … 20 (ใช้ null เป็นตัวคั่น) */
function pageList(page: number, totalPages: number): (number | null)[] {
  const set = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  total,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  total?: number;
}) {
  if (totalPages <= 1) return null;
  const btn = "inline-flex items-center justify-center h-9 min-w-9 px-2 text-sm rounded-md transition-colors";
  return (
    <nav
      aria-label="แบ่งหน้า"
      className="flex flex-col items-center gap-2 px-4 py-3 border-t border-gray-200 sm:flex-row sm:justify-between sm:px-6 bg-gray-50"
    >
      <div className="text-sm text-gray-600">
        หน้า {page} จาก {totalPages}
        {typeof total === "number" ? ` · ทั้งหมด ${total} รายการ` : ""}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="หน้าก่อนหน้า"
          className={`${btn} text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${p === page ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-white"}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="หน้าถัดไป"
          className={`${btn} text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
