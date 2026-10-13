"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

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
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
      <div className="text-sm text-gray-700">
        หน้า {page} จาก {totalPages}
        {typeof total === "number" ? ` (ทั้งหมด ${total} รายการ)` : ""}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="หน้าก่อนหน้า"
          className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">{page}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="หน้าถัดไป"
          className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
