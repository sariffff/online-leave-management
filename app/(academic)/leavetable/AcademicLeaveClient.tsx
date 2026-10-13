"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { CalendarCog, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeaveFilters, { EMPTY_FILTERS, type LeaveFilterValue, type StatusOption } from "@/components/shared/LeaveFilters";
import LeaveTable from "@/components/shared/LeaveTable";
import LeaveDetailModal from "@/components/shared/LeaveDetailModal";
import PlanSubstituteModal from "@/components/academic/modals/PlanSubstituteModal";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import { useNav } from "@/components/shell/NavContext";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery, type InitialPage } from "@/lib/client/usePagedQuery";

const STATUS_OPTIONS: StatusOption[] = [
  { value: "approved", label: "รอจัดสอนแทน" },
  { value: "covered", label: "จัดสอนแทนแล้ว" },
];

export default function AcademicLeaveClient({ initial }: { initial?: InitialPage<LeaveItem> }) {
  const [filters, setFilters] = useState<LeaveFilterValue>(EMPTY_FILTERS);
  const [viewing, setViewing] = useState<LeaveItem | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const { refreshCounts } = useNav();

  const list = usePagedQuery<LeaveItem>("/api/academic/leaves", { ...filters }, 10, true, initial);

  // รายการในตารางไม่แนบไฟล์ — โหลดรายละเอียดเต็ม (พร้อม signed URL) เมื่อกดดู
  async function openDetail(row: LeaveItem) {
    try {
      const d = await apiFetch<{ leave: LeaveItem }>(`/api/academic/leaves/${row.id}`);
      setViewing(d.leave);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลดรายละเอียดใบลาไม่สำเร็จ");
    }
  }

  return (
    <PageContainer>
      <PageHeader title="รายการลา (ฝ่ายวิชาการ)" description="ใบลาของครูที่อนุมัติแล้ว — จัดครูสอนแทนให้ครบทุกคาบ" />

      <LeaveFilters value={filters} onApply={setFilters} showSearch statusOptions={STATUS_OPTIONS} loading={list.loading} />

      <LeaveTable
        title={`รายการลาของครู (${list.total} รายการ)`}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        onPageChange={list.setPage}
        showUser
        renderActions={(row) => (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openDetail(row)}>
              <Eye className="w-4 h-4" />
              ดูใบลา
            </Button>
            <Button size="sm" className="text-white bg-blue-600 hover:bg-blue-700" onClick={() => setPlanId(row.id)}>
              <CalendarCog className="w-4 h-4" />
              จัดสอนแทน
            </Button>
          </div>
        )}
      />

      <LeaveDetailModal open={!!viewing} item={viewing} onClose={() => setViewing(null)} />
      {planId && (
        <PlanSubstituteModal
          open
          onOpenChange={(v) => !v && setPlanId(null)}
          leaveId={planId}
          onChanged={() => {
            list.reload();
            refreshCounts();
          }}
        />
      )}
    </PageContainer>
  );
}
