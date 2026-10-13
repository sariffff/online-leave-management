"use client";

import { useState } from "react";
import UserSidebar from "@/components/user/UserSidebar";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue, type StatusOption } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import LeaveRequestModal from "@/components/user/leave-history/modals/LeaveRequestModal";
import type { LeaveItem } from "@/components/shared/types";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";
import { LEAVE_STATUS, STATUS_LABEL } from "@/lib/leave/status";

const STATUS_OPTIONS: StatusOption[] = LEAVE_STATUS.filter((s) => s !== "cancelled").map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export default function LeaveHistoryClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);

  const list = usePagedQuery<LeaveItem>("/api/user/leave-history", { ...filters }, 8, true, initial);

  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 space-y-4 bg-gray-50">
          <h1 className="text-xl font-semibold">ประวัติการลา</h1>

          <LeaveFilters value={filters} onApply={setFilters} statusOptions={STATUS_OPTIONS} loading={list.loading} />

          <LeaveTable
            title="รายการลาทั้งหมด"
            rows={list.rows}
            loading={list.loading}
            error={list.error}
            page={list.page}
            totalPages={list.totalPages}
            total={list.total}
            pageSize={8}
            onPageChange={list.setPage}
            actionLabel="ดูหรือแก้ไข"
            onOpen={setSelected}
            emptyText="ไม่พบข้อมูลประวัติการลา"
          />
        </div>
      </div>

      <LeaveRequestModal open={!!selected} item={selected} onClose={() => setSelected(null)} onChanged={list.reload} />
    </div>
  );
}
