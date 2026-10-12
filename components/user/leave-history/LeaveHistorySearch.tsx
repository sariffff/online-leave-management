"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";

export type LeaveHistorySearchFilters = {
  startDate?: string;   // yyyy-MM-dd (ISO, ค.ศ.)
  endDate?: string;     // yyyy-MM-dd (ISO, ค.ศ.)
  fiscalYear?: string;  // ปีงบประมาณ "พ.ศ." เช่น 2569
  leaveType?: string;   // ค่าว่าง = ทุกประเภท
  status?: string;      // ค่าว่าง = ทุกสถานะ (ตอนนี้ใช้ "ไทย" เป็นค่า)
};

type Props = {
  value: LeaveHistorySearchFilters;
  onChange: (next: LeaveHistorySearchFilters) => void;
  onSubmit?: () => void;         // เรียกเมื่อกดค้นหา/กด Enter
  onReset?: () => void;          // ล้างตัวกรอง
  loading?: boolean;
  leaveTypeOptions?: { value: string; label: string }[];
};

// ใช้ค่า non-empty ใน SelectItem (Radix ห้าม value="")
const DEFAULT_LEAVE_TYPES: { value: string; label: string }[] = [
  { value: "__ALL__", label: "— ทุกประเภท —" },
  { value: "ลาป่วย", label: "ลาป่วย" },
  { value: "ลากิจส่วนตัว", label: "ลากิจส่วนตัว" },
  { value: "ลาพักผ่อน", label: "ลาพักผ่อน" },
  { value: "ลาอื่นๆ", label: "ลาอื่นๆ" },
];

/** ใช้ "ค่าเป็นภาษาไทย" เพื่อให้ฟิลเตอร์ชัดเจนฝั่ง UI */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "__ALL__", label: "— ทุกสถานะ —" },
  { value: "รอพิจารณา", label: "รอพิจารณา" },       // pending
  { value: "อนุมัติ", label: "อนุมัติ" },             // approved
  { value: "ไม่อนุมัติ", label: "ไม่อนุมัติ" },       // rejected
  { value: "ไม่ผ่านตรวจสอบ", label: "ไม่ผ่านตรวจสอบ" }, // failed
];

export default function LeaveHistorySearch({
  value,
  onChange,
  onSubmit,
  onReset,
  loading = false,
  leaveTypeOptions,
}: Props) {
  const types = useMemo(
    () => leaveTypeOptions ?? DEFAULT_LEAVE_TYPES,
    [leaveTypeOptions]
  );

  // หลีกเลี่ยงการใช้ value="" กับ Radix <SelectItem />
  const mapEmptyToAll = (v?: string) => (v && v.length > 0 ? v : "__ALL__");

  // ทำให้กด Enter แล้วค้นหาได้
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="w-full p-3 bg-white border shadow-sm rounded-xl md:p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter size={18} />
        <h2 className="text-sm font-semibold md:text-base">ค้นหา/กรอง</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {/* ตั้งแต่วันที่ (ISO, ค.ศ.) */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label>
          <Input
            type="date"
            value={value.startDate ?? ""}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
        </div>

        {/* ถึงวันที่ (ISO, ค.ศ.) */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ถึงวันที่</label>
          <Input
            type="date"
            value={value.endDate ?? ""}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>

        {/* ปีงบประมาณ (พ.ศ.) */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ปีงบประมาณ (พ.ศ.)</label>
          <Input
            placeholder="เช่น 2569"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.fiscalYear ?? ""}
            onChange={(e) => onChange({ ...value, fiscalYear: e.target.value })}
          />
        </div>

        {/* ประเภทการลา */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ประเภทการลา</label>
          <Select
            value={mapEmptyToAll(value.leaveType)}
            onValueChange={(v) =>
              onChange({ ...value, leaveType: v === "__ALL__" ? "" : v })
            }
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

        {/* สถานะ (ค่าเป็น “ไทย”) */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">สถานะ</label>
          <Select
            value={mapEmptyToAll(value.status)}
            onValueChange={(v) =>
              onChange({ ...value, status: v === "__ALL__" ? "" : v })
            }
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
          <X className="w-4 h-4 mr-1" />
          ล้างตัวกรอง
        </Button>
      </div>
    </form>
  );
}
