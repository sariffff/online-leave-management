"use client";

import { useState } from "react";
import Sidebar from "@/components/director/sidebar";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue, type StatusOption } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import LeaveDetailModal from "@/components/shared/LeaveDetailModal";
import type { LeaveItem } from "@/components/shared/types";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

const STATUS_OPTIONS: StatusOption[] = [
  { value: "approved,covered", label: "อนุมัติ" },
  { value: "rejected", label: "ไม่อนุมัติ" },
];

export default function ApprovedHistoryClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);

  const list = usePagedQuery<LeaveItem>("/api/director/approved-history", { ...filters }, 10, true, initial);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 p-6 space-y-4">
        <h1 className="text-xl font-semibold">ประวัติการอนุมัติใบลา</h1>

        <LeaveFilters value={filters} onApply={setFilters} showSearch statusOptions={STATUS_OPTIONS} loading={list.loading} />

        <LeaveTable
          title="ประวัติการอนุมัติใบลา"
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          onPageChange={list.setPage}
          showUser
          onOpen={setSelected}
        />
      </div>

      <LeaveDetailModal open={!!selected} item={selected} onClose={() => setSelected(null)} title="รายละเอียดใบลา (ประวัติการอนุมัติ)" />
    </div>
  );
}
