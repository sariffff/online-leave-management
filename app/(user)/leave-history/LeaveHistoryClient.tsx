"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue, type StatusOption } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import LeaveRequestModal from "@/components/user/leave-history/modals/LeaveRequestModal";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import type { LeaveItem } from "@/components/shared/types";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";
import { LEAVE_STATUS, STATUS_LABEL } from "@/lib/leave/status";

const STATUS_OPTIONS: StatusOption[] = LEAVE_STATUS.filter((s) => s !== "cancelled").map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export default function LeaveHistoryClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);

  const list = usePagedQuery<LeaveItem>("/api/user/leave-history", { ...filters }, 8, true, initial);

  return (
    <PageContainer>
      <PageHeader
        title="ประวัติการลา"
        description="ดู แก้ไข หรือลบใบลาที่ยังไม่ผ่านการพิจารณา และพิมพ์ใบลาเป็น PDF"
        actions={
          <Link href="/leave-page" className="inline-flex items-center justify-center h-10 gap-1 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4" /> ยื่นใบลา
          </Link>
        }
      />

      <LeaveFilters value={filters} onApply={setFilters} statusOptions={STATUS_OPTIONS} loading={list.loading} />

      <LeaveTable
        title={`รายการลาทั้งหมด (${list.total} รายการ)`}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        pageSize={8}
        onPageChange={list.setPage}
        actionLabel="ดู / แก้ไข"
        onOpen={setSelected}
        emptyText="ยังไม่มีประวัติการลา"
      />

      <LeaveRequestModal open={!!selected} item={selected} onClose={() => setSelected(null)} onChanged={list.reload} />
    </PageContainer>
  );
}
