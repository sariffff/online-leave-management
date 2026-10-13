"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";
import { useHolidays } from "@/lib/client/useHolidays";
import { useLeaveTypes } from "@/lib/client/useLeaveTypes";
import { countLeaveDays } from "@/lib/leave/days";
import { HALF_OPTIONS, type HalfType } from "@/lib/leave/status";

type Employee = { user_id: string; fullName: string; email: string };

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** ผอ.สร้างใบลาแทนบุคลากร (อนุมัติทันที) — จำนวนวันคำนวณอัตโนมัติ และ server คำนวณซ้ำอีกครั้ง */
export default function CreateLeaveModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const types = useLeaveTypes();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startType, setStartType] = useState<HalfType>("เต็มวัน");
  const [endType, setEndType] = useState<HalfType>("เต็มวัน");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || employees.length) return;
    apiFetch<{ items: Employee[] }>("/api/director/employees")
      .then((r) => setEmployees(r.items))
      .catch((e: Error) => toast.error(e.message));
  }, [open, employees.length]);

  const years = useMemo(() => [Number(startDate.slice(0, 4)), Number(endDate.slice(0, 4))].filter(Boolean), [startDate, endDate]);
  const { map: holidays } = useHolidays(years);
  const typeRule = types.find((t) => String(t.leave_type_id) === leaveTypeId)?.rule;
  const noHalf = typeRule ? !typeRule.allowHalfDay : false;
  // ประเภทที่ลาครึ่งวันไม่ได้ → บังคับเต็มวัน (ส่งค่าเต็มวันจริง ไม่ใช่แค่แสดง)
  useEffect(() => {
    if (!noHalf) return;
    setStartType("เต็มวัน");
    setEndType("เต็มวัน");
  }, [noHalf]);

  const { total, excluded } = useMemo(
    () => countLeaveDays({ start: startDate, end: endDate, startType, endType, holidays, mode: typeRule?.countMode }),
    [startDate, endDate, startType, endType, holidays, typeRule?.countMode]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? employees.filter((e) => `${e.fullName} ${e.email}`.toLowerCase().includes(q)) : employees;
  }, [employees, search]);

  const selectedType = types.find((t) => String(t.leave_type_id) === leaveTypeId);
  const canSubmit = !!userId && !!leaveTypeId && !!startDate && !!endDate && total > 0 && !saving;

  function reset() {
    setUserId("");
    setSearch("");
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setStartType("เต็มวัน");
    setEndType("เต็มวัน");
    setReason("");
  }

  async function submit() {
    setSaving(true);
    try {
      await apiFetch("/api/director/create-leave", {
        method: "POST",
        json: {
          user_id: userId,
          leave_type_id: Number(leaveTypeId),
          date_start: startDate,
          date_end: endDate,
          date_start_type: startType,
          date_end_type: endType,
          total_day: total,
          reason: reason || null,
        },
      });
      toast.success("สร้างและอนุมัติสำเร็จ");
      reset();
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างใบลาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้างใบลา (อนุมัติทันที)</DialogTitle>
          <DialogDescription>เลือกบุคลากร ประเภทลา และช่วงวัน ระบบจะคำนวณจำนวนวันลาให้อัตโนมัติ (ตัดเสาร์–อาทิตย์และวันหยุด)</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>บุคลากร</Label>
            <Input placeholder="ค้นหาชื่อหรืออีเมล..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={selectCls} value={userId} onChange={(e) => setUserId(e.target.value)} size={Math.min(5, Math.max(2, filtered.length))}>
              {filtered.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {e.fullName}
                  {e.email ? ` (${e.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>ประเภทการลา</Label>
            <select className={selectCls} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">— เลือกประเภทลา —</option>
              {types.map((t) => (
                <option key={t.leave_type_id} value={t.leave_type_id}>
                  {t.leave_type_name}
                </option>
              ))}
            </select>
            {selectedType && (
              <p className="text-xs text-slate-600">
                {selectedType.note || "—"}
                {selectedType.max_leave_day !== null ? ` • สิทธิ์/ปี: ${selectedType.max_leave_day} วัน` : " • ไม่จำกัดจำนวนวัน"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>วันที่เริ่ม</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>วันที่สิ้นสุด</Label>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>ช่วงวันเริ่ม</Label>
              <select className={selectCls} value={startType} disabled={noHalf} onChange={(e) => setStartType(e.target.value as HalfType)}>
                {HALF_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>ช่วงวันสิ้นสุด</Label>
              <select className={selectCls} value={endType} onChange={(e) => setEndType(e.target.value as HalfType)} disabled={noHalf || (!!startDate && startDate === endDate)}>
                {HALF_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 text-sm border rounded-lg bg-blue-50">
            <span className="text-slate-700">จำนวนวันลา (คำนวณอัตโนมัติ)</span>
            <span className="font-bold text-blue-700">{total} วัน</span>
          </div>
          {excluded.length > 0 && (
            <ul className="p-3 space-y-1 text-xs text-yellow-800 border border-yellow-200 rounded-lg bg-yellow-50">
              {excluded.map((d) => (
                <li key={d.date}>
                  {d.date} — {d.name}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reason">เหตุผล (ไม่บังคับ)</Label>
            <Input id="reason" placeholder="เหตุผลการลา" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
