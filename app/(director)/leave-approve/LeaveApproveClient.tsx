"use client";

import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import Sidebar from "@/components/director/sidebar";
import { Button } from "@/components/ui/button";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import ReviewModal from "@/components/shared/ReviewModal";
import CreateLeaveModal from "@/components/director/Modals/DirectorCreateLeaveModal";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

/** คิวใบลาที่ธุรการตรวจแล้ว รอ ผอ. อนุมัติ */
export default function LeaveApproveClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = usePagedQuery<LeaveItem>("/api/director/leave-approve", { ...filters, status: "reviewed" }, 10, true, initial);

  async function submit({ action, id, note }: { action: string; id: number; note?: string }) {
    await apiFetch("/api/director/leave-approve", { method: "POST", json: { action, payload: { id, note } } });
    list.reload();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar pendingCount={list.total} />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-800">รายการรออนุมัติการลา</h1>
            <p className="text-gray-600">รายการที่ผ่านการตรวจสอบแล้วและรออนุมัติ/ไม่อนุมัติ</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            สร้างใบลา
          </Button>
        </div>

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
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setSelected(row)}>
              <Eye className="w-3 h-3" />
              อนุมัติ / ไม่อนุมัติ
            </Button>
          )}
        />
      </div>

      <ReviewModal mode="approve" open={!!selected} item={selected} onClose={() => setSelected(null)} onSubmit={submit} />

      <CreateLeaveModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          list.reload();
        }}
      />
    </div>
  );
}
