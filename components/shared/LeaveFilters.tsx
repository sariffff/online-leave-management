"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLeaveTypes } from "@/lib/client/useLeaveTypes";

export type LeaveFilterValue = {
  q: string;
  startDate: string;
  endDate: string;
  fiscalYear: string; // พ.ศ. หรือ ค.ศ. (server แปลงให้)
  leaveTypeId: string;
  status: string; // สถานะ (code) คั่นด้วย , ได้
};

export const EMPTY_FILTERS: LeaveFilterValue = { q: "", startDate: "", endDate: "", fiscalYear: "", leaveTypeId: "", status: "" };

export type StatusOption = { value: string; label: string };

const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** แถบค้นหา/กรอง — ใช้ค่าเมื่อกด "ค้นหา" (ไม่ยิง request ทุกตัวอักษรที่พิมพ์) */
export default function LeaveFilters({
  value,
  onApply,
  statusOptions,
  showSearch = false,
  loading = false,
}: {
  value: LeaveFilterValue;
  onApply: (v: LeaveFilterValue) => void;
  statusOptions?: StatusOption[];
  showSearch?: boolean;
  loading?: boolean;
}) {
  const [draft, setDraft] = useState<LeaveFilterValue>(value);
  const types = useLeaveTypes();
  const set = (patch: Partial<LeaveFilterValue>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
      className="w-full p-3 bg-white border shadow-sm rounded-xl md:p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter size={18} />
        <h2 className="text-sm font-semibold md:text-base">ค้นหา/กรอง</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {showSearch && (
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs text-muted-foreground">ชื่อ / นามสกุล / อีเมล</label>
            <Input value={draft.q} onChange={(e) => set({ q: e.target.value })} placeholder="ค้นหา..." />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label>
          <Input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ถึงวันที่</label>
          <Input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ปีงบประมาณ (พ.ศ.)</label>
          <Input
            placeholder="เช่น 2569"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.fiscalYear}
            onChange={(e) => set({ fiscalYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ประเภทการลา</label>
          <select className={selectCls} value={draft.leaveTypeId} onChange={(e) => set({ leaveTypeId: e.target.value })}>
            <option value="">— ทุกประเภท —</option>
            {types.map((t) => (
              <option key={t.leave_type_id} value={t.leave_type_id}>
                {t.leave_type_name}
              </option>
            ))}
          </select>
        </div>
        {statusOptions && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">สถานะ</label>
            <select className={selectCls} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">— ทุกสถานะ —</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Button type="submit" disabled={loading} className="h-9">
          ค้นหา
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={loading}
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            onApply(EMPTY_FILTERS);
          }}
        >
          <X className="w-4 h-4 mr-1" />
          ล้างตัวกรอง
        </Button>
      </div>
    </form>
  );
}
