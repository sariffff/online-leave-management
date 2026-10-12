"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ---------- Types ---------- */
type LeaveType = {
  leave_type_id: number;
  leave_type_name: string;
  max_leave_day: number | null;
  carry_over_max: number | null;
  note: string | null;
};

type Holiday = { start: string; summary: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

/* ---------- Utils ---------- */
const HALF_OPTIONS = ["เต็มวัน", "ครึ่งเช้า", "ครึ่งบ่าย"] as const;
type HalfOpt = (typeof HALF_OPTIONS)[number];

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

async function fetchHolidaysForRange(start: string, end: string): Promise<Holiday[]> {
  // สมมติว่ามี API /api/holidays?start=YYYY-01-01&end=YYYY-12-31
  const sYear = new Date(start || Date.now()).getFullYear();
  const eYear = new Date(end || Date.now()).getFullYear();
  const startOf = `${sYear}-01-01`;
  const endOf = `${eYear}-12-31`;
  const r = await fetch(`/api/holidays?start=${startOf}&end=${endOf}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "โหลดวันหยุดไม่สำเร็จ");
  return Array.isArray(j.holidays) ? j.holidays : [];
}

/* =================================================================== */

export default function CreateLeaveModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  // dropdown ประเภทลา
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // ฟอร์ม
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState<string>(""); // keep string for <Select>, parseInt ตอนส่ง
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startType, setStartType] = useState<HalfOpt>("เต็มวัน");
  const [endType, setEndType] = useState<HalfOpt>("เต็มวัน");
  const [reason, setReason] = useState("");

  // วันหยุด
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // โหลดประเภทลา
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open) return;
      try {
        setLoadingTypes(true);
        const res = await fetch("/api/director/leave-type", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok || j?.error) throw new Error(j?.error || "โหลดประเภทลาไม่สำเร็จ");
        if (!cancelled) setTypes(Array.isArray(j.items) ? j.items : []);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setTypes([]);
          toast.error(e?.message || "โหลดประเภทลาไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // โหลดวันหยุดตามช่วง
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!startDate && !endDate) return;
      try {
        const list = await fetchHolidaysForRange(startDate || today, endDate || today);
        if (!cancelled) setHolidays(list);
      } catch (e) {
        if (!cancelled) setHolidays([]);
      }
    })();
    return () => { cancelled = true; };
  }, [startDate, endDate, today]);

  // คำนวณวันลาอัตโนมัติ (ตัดเสาร์อาทิตย์ + วันหยุด + ครึ่งเช้า/ครึ่งบ่าย)
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;

    const s = new Date(startDate);
    const e = new Date(endDate);
    if (s > e) return 0;

    let working = 0;

    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dayISO = fmtISO(d);
      const weekend = isWeekend(d);
      const isHoliday = holidays.some((h) => h.start === dayISO);
      if (!weekend && !isHoliday) working += 1;
    }

    if (working > 0) {
      // ครึ่งวันเริ่ม
      const sISO = fmtISO(s);
      const sIsWeekend = isWeekend(s);
      const sIsHoliday = holidays.some((h) => h.start === sISO);
      if (!sIsWeekend && !sIsHoliday && startType !== "เต็มวัน") working -= 0.5;

      // วันเดียวกัน
      if (startDate === endDate) {
        if (startType === "ครึ่งเช้า" && endType === "ครึ่งบ่าย") {
          working = 1;
        } else if (startType !== "เต็มวัน" || endType !== "เต็มวัน") {
          working = 0.5;
        }
      } else {
        // ครึ่งวันจบ
        const eISO = fmtISO(e);
        const eIsWeekend = isWeekend(e);
        const eIsHoliday = holidays.some((h) => h.start === eISO);
        if (!eIsWeekend && !eIsHoliday && endType !== "เต็มวัน") working -= 0.5;
      }
    }

    return Math.max(0, Math.round(working * 2) / 2);
  }, [startDate, endDate, startType, endType, holidays]);

  const selectedType = useMemo(
    () => types.find((t) => String(t.leave_type_id) === leaveTypeId),
    [types, leaveTypeId]
  );

  const resetForm = () => {
    setEmployeeEmail("");
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setStartType("เต็มวัน");
    setEndType("เต็มวัน");
    setReason("");
    setHolidays([]);
  };

  const submit = async () => {
    if (!employeeEmail || !leaveTypeId || !startDate || !endDate) {
      toast.error("กรอกข้อมูลให้ครบ");
      return;
    }
    if (totalDays <= 0) {
      toast.error("ช่วงวันที่ไม่ถูกต้องหรือชนวันหยุด/เสาร์อาทิตย์ทั้งหมด");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/director/create-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeEmail: employeeEmail.trim(),
          leave_type_id: parseInt(leaveTypeId, 10),
          date_start: startDate,
          date_end: endDate,
          date_start_type: startType,
          date_end_type: endType,
          total_day: totalDays,
          reason: reason || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || "สร้างใบลาไม่สำเร็จ");

      toast.success("สร้างและอนุมัติสำเร็จ");
      resetForm();
      onSuccess();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>สร้างใบลา (อนุมัติทันที)</DialogTitle>
          <DialogDescription>
            เลือกประเภทลาและช่วงวัน ระบบจะคำนวณจำนวนวันลาให้อัตโนมัติ (ตัดเสาร์–อาทิตย์และวันหยุด)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* อีเมลพนักงาน */}
          <div className="grid gap-2">
            <Label htmlFor="email">อีเมลพนักงาน</Label>
            <Input
              id="email"
              placeholder="user@example.com"
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
            />
          </div>

          {/* ประเภทลา (Dropdown) */}
          <div className="grid gap-2">
            <Label>ประเภทการลา</Label>
            <Select
              value={leaveTypeId}
              onValueChange={setLeaveTypeId}
              disabled={loadingTypes}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingTypes ? "กำลังโหลด..." : "— เลือกประเภทลา —"} />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.leave_type_id} value={String(t.leave_type_id)}>
                    {t.leave_type_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!!selectedType && (
              <p className="text-xs text-slate-600">
                {selectedType.note || "—"}
                {typeof selectedType.max_leave_day === "number"
                  ? ` • ค่าสูงสุด/ปี: ${selectedType.max_leave_day} วัน`
                  : ""}
                {typeof selectedType.carry_over_max === "number"
                  ? ` • สะสมได้สูงสุด: ${selectedType.carry_over_max} วัน`
                  : ""}
              </p>
            )}
          </div>

          {/* วันที่ + ช่วงวัน */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>วันที่เริ่ม</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>วันที่สิ้นสุด</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>ช่วงวันเริ่ม</Label>
              <select
                className="border rounded-md p-2"
                value={startType}
                onChange={(e) => setStartType(e.target.value as HalfOpt)}
              >
                {HALF_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>ช่วงวันสิ้นสุด</Label>
              <select
                className="border rounded-md p-2"
                value={endType}
                onChange={(e) => setEndType(e.target.value as HalfOpt)}
                disabled={startDate === endDate} // วันเดียวกันคุมด้วย logic ด้านล่างอยู่แล้ว
              >
                {HALF_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* แสดงผลรวมวันลา */}
          <div className="p-3 text-sm border rounded-lg bg-blue-50 flex items-center justify-between">
            <span className="text-slate-700">จำนวนวันลา (คำนวณอัตโนมัติ)</span>
            <span className="font-bold text-blue-700">{totalDays} วัน</span>
          </div>

          {/* เหตุผล */}
          <div className="grid gap-2">
            <Label htmlFor="reason">เหตุผล (ไม่บังคับ)</Label>
            <Input
              id="reason"
              placeholder="เหตุผลการลา"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={loading || !leaveTypeId || !employeeEmail || !startDate || !endDate}>
            {loading ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
