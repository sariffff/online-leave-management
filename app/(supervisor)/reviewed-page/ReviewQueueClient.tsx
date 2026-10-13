"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import Sidebar from "@/components/supervisor/sidebar";
import { Button } from "@/components/ui/button";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import ReviewModal from "@/components/shared/ReviewModal";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

/** คิวใบลาที่รอธุรการตรวจสอบ */
export default function ReviewQueueClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LeaveItem | null>(null);

  const list = usePagedQuery<LeaveItem>("/api/supervisor/leave-review", { ...filters, status: "pending" }, 10, true, initial);

  async function submit({ action, id, note }: { action: string; id: number; note?: string }) {
    await apiFetch("/api/supervisor/leave-review", { method: "POST", json: { action, payload: { id, note } } });
    list.reload();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar pendingCount={list.total} />

      <div className="flex-1 p-6 space-y-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-gray-800">รายการรอตรวจสอบการลา</h1>
          <p className="text-gray-600">รายการขอลาที่รอการตรวจสอบ (ผ่าน/ไม่ผ่าน)</p>
        </div>

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
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setSelected(row)}>
              <Eye className="w-3 h-3" />
              ดูใบลา
            </Button>
          )}
        />
      </div>

      <ReviewModal mode="review" open={!!selected} item={selected} onClose={() => setSelected(null)} onSubmit={submit} />
    </div>
  );
}
