"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";

export type LeaveHistorySearchFilters = {
  q?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: string;
  leaveType?: string;
  status?: string;
};

type Props = {
  value: LeaveHistorySearchFilters;
  onChange: (next: LeaveHistorySearchFilters) => void;
  onSubmit?: () => void;
  onReset?: () => void;
  loading?: boolean;
  leaveTypeOptions?: { value: string; label: string }[];
};

const DEFAULT_LEAVE_TYPES = [
  { value: "__ALL__", label: "— ทุกประเภท —" },
  { value: "ลาป่วย", label: "ลาป่วย" },
  { value: "ลากิจส่วนตัว", label: "ลากิจส่วนตัว" },
  { value: "ลาพักผ่อน", label: "ลาพักผ่อน" },
  { value: "ลาอื่นๆ", label: "ลาอื่นๆ" },
];

const STATUS_OPTIONS = [
  { value: "__ALL__", label: "— ทุกสถานะ —" },
  { value: "อนุมัติ", label: "อนุมัติ" },
  { value: "ไม่อนุมัติ", label: "ไม่อนุมัติ" },
];

export default function LeaveHistorySearch({
  value,
  onChange,
  onSubmit,
  onReset,
  loading = false,
  leaveTypeOptions,
}: Props) {
  const types = useMemo(() => leaveTypeOptions ?? DEFAULT_LEAVE_TYPES, [leaveTypeOptions]);
  const mapEmptyToAll = (v?: string) => (v && v.length > 0 ? v : "__ALL__");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(); // ✅ หน้าเพจจะ setCurrentPage(1) และ reload ด้วย pageSize=10
  };

  const preventEnterSubmit: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      action={undefined}
      noValidate
      autoComplete="off"
      className="w-full p-3 bg-white border shadow-sm rounded-xl md:p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter size={18} />
        <h2 className="text-sm font-semibold md:text-base">ค้นหา/กรอง</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label>
          <Input
            type="date"
            value={value.startDate ?? ""}
            onKeyDown={preventEnterSubmit}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ถึงวันที่</label>
          <Input
            type="date"
            value={value.endDate ?? ""}
            onKeyDown={preventEnterSubmit}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ปีงบประมาณ (พ.ศ.)</label>
          <Input
            placeholder="เช่น 2569"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.fiscalYear ?? ""}
            onKeyDown={preventEnterSubmit}
            onChange={(e) => onChange({ ...value, fiscalYear: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ประเภทการลา</label>
          <Select
            value={mapEmptyToAll(value.leaveType)}
            onValueChange={(v) => onChange({ ...value, leaveType: v === "__ALL__" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="— ทุกประเภท —" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">สถานะ</label>
          <Select
            value={mapEmptyToAll(value.status)}
            onValueChange={(v) => onChange({ ...value, status: v === "__ALL__" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="— ทุกสถานะ —" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Button type="submit" disabled={loading} className="h-9">
          ค้นหา
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={loading}
          className="h-9"
        >
          ล้างตัวกรอง
        </Button>
      </div>
    </form>
  );
}
