"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import ReviewModal from "@/components/shared/ReviewModal";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import { useNav } from "@/components/shell/NavContext";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

/** คิวใบลาที่รอธุรการตรวจสอบ */
export default function ReviewQueueClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);
  const { refreshCounts } = useNav();

  const list = usePagedQuery<LeaveItem>("/api/supervisor/leave-review", { ...filters, status: "pending" }, 10, true, initial);

  async function submit({ action, id, note }: { action: string; id: number; note?: string }) {
    await apiFetch("/api/supervisor/leave-review", { method: "POST", json: { action, payload: { id, note } } });
    list.reload();
    refreshCounts();
  }

  return (
    <PageContainer>
      <PageHeader title="รายการรอตรวจสอบการลา" description="ใบลาที่รอการตรวจสอบ (ผ่าน / ไม่ผ่าน)" />

      <LeaveFilters value={filters} onApply={setFilters} showSearch loading={list.loading} />

      <LeaveTable
        title={`ใบลาที่รอตรวจสอบ (${list.total} รายการ)`}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        onPageChange={list.setPage}
        showUser
        showStatus={false}
        emptyText="ไม่มีรายการรอตรวจสอบ"
        renderActions={(row) => (
          <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => setSelected(row)}>
            <Eye className="w-4 h-4" />
            ตรวจสอบ
          </Button>
        )}
      />

      <ReviewModal mode="review" open={!!selected} item={selected} onClose={() => setSelected(null)} onSubmit={submit} />
    </PageContainer>
  );
}
