"use client";

import { useState } from "react";
import { CheckCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import ReviewModal from "@/components/shared/ReviewModal";
import CreateLeaveModal from "@/components/director/Modals/DirectorCreateLeaveModal";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import { useNav } from "@/components/shell/NavContext";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

/** คิวใบลาที่ธุรการตรวจแล้ว รอ ผอ. อนุมัติ */
export default function LeaveApproveClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { refreshCounts } = useNav();

  const list = usePagedQuery<LeaveItem>("/api/director/leave-approve", { ...filters, status: "reviewed" }, 10, true, initial);

  async function submit({ action, id, note }: { action: string; id: number; note?: string }) {
    await apiFetch("/api/director/leave-approve", { method: "POST", json: { action, payload: { id, note } } });
    list.reload();
    refreshCounts();
  }

  return (
    <PageContainer>
      <PageHeader
        title="รายการรออนุมัติการลา"
        description="ใบลาที่ผ่านการตรวจสอบแล้ว รออนุมัติ / ไม่อนุมัติ"
        actions={
          <Button onClick={() => setCreateOpen(true)} className="h-10 text-white bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            สร้างใบลาแทนบุคลากร
          </Button>
        }
      />

      <LeaveFilters value={filters} onApply={setFilters} showSearch loading={list.loading} />

      <LeaveTable
        title={`รออนุมัติ (${list.total} รายการ)`}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        onPageChange={list.setPage}
        showUser
        showStatus={false}
        emptyText="ไม่มีรายการรออนุมัติ"
        renderActions={(row) => (
          <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => setSelected(row)}>
            <CheckCircle className="w-4 h-4" />
            พิจารณา
          </Button>
        )}
      />

      <ReviewModal mode="approve" open={!!selected} item={selected} onClose={() => setSelected(null)} onSubmit={submit} />

      <CreateLeaveModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          list.reload();
        }}
      />
    </PageContainer>
  );
}
