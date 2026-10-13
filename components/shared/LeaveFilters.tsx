"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
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
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * แถบค้นหา/กรอง — ใช้ค่าเมื่อกด "ค้นหา" (ไม่ยิง request ทุกตัวอักษรที่พิมพ์)
 * มือถือ: พับเก็บไว้ แสดงจำนวนตัวกรองที่ใช้อยู่ (ช่องค้นหาชื่อยังแสดงตลอด)
 */
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
  const [expanded, setExpanded] = useState(false);
  const types = useLeaveTypes();
  const set = (patch: Partial<LeaveFilterValue>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => setDraft(value), [value]);

  const activeCount = (["startDate", "endDate", "fiscalYear", "leaveTypeId", "status"] as const).filter((k) => value[k]).length;

  const label = (text: string, htmlFor: string) => (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {text}
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
        setExpanded(false);
      }}
      className="w-full p-3 bg-white border border-gray-200 shadow-sm rounded-xl sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <h2 className="text-sm font-semibold sm:text-base">ค้นหา / กรอง</h2>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">{activeCount} ตัวกรอง</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-blue-700 rounded-md hover:bg-blue-50 md:hidden"
          aria-expanded={expanded}
          aria-controls="leave-filter-fields"
        >
          {expanded ? "ซ่อน" : "ตัวกรอง"}
          <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {showSearch && (
        <div className="mt-3 space-y-1 md:hidden">
          <Input
            aria-label="ค้นหาชื่อ / นามสกุล / อีเมล"
            className="h-10"
            value={draft.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="ค้นหาชื่อ / นามสกุล / อีเมล"
            enterKeyHint="search"
          />
        </div>
      )}

      <div id="leave-filter-fields" className={`${expanded ? "grid" : "hidden"} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid md:grid-cols-3 lg:grid-cols-6`}>
        {showSearch && (
          <div className="hidden space-y-1 md:block lg:col-span-2">
            {label("ชื่อ / นามสกุล / อีเมล", "f-q")}
            <Input id="f-q" className="h-10" value={draft.q} onChange={(e) => set({ q: e.target.value })} placeholder="ค้นหา..." />
          </div>
        )}
        <div className="space-y-1">
          {label("ตั้งแต่วันที่", "f-start")}
          <Input id="f-start" className="h-10" type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          {label("ถึงวันที่", "f-end")}
          <Input id="f-end" className="h-10" type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          {label("ปีงบประมาณ (พ.ศ.)", "f-fy")}
          <Input
            id="f-fy"
            className="h-10"
            placeholder="เช่น 2569"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.fiscalYear}
            onChange={(e) => set({ fiscalYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </div>
        <div className="space-y-1">
          {label("ประเภทการลา", "f-type")}
          <select id="f-type" className={selectCls} value={draft.leaveTypeId} onChange={(e) => set({ leaveTypeId: e.target.value })}>
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
            {label("สถานะ", "f-status")}
            <select id="f-status" className={selectCls} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
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

      <div className={`${showSearch || expanded ? "flex" : "hidden"} md:flex items-center gap-2 mt-3`}>
        <Button type="submit" disabled={loading} className="flex-1 h-10 sm:flex-none">
          ค้นหา
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-10 sm:flex-none"
          disabled={loading}
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            onApply(EMPTY_FILTERS);
            setExpanded(false);
          }}
        >
          <X className="w-4 h-4" />
          ล้างตัวกรอง
        </Button>
      </div>
    </form>
  );
}
