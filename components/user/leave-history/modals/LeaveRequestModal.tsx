"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Info, Loader2, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LeaveSummary, { FileList } from "@/components/shared/LeaveSummary";
import GeneratePdfButton from "@/components/user/leave-history/GeneratePdfButton";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { useHolidays } from "@/lib/client/useHolidays";
import { countLeaveDays, isNonWorkingISO } from "@/lib/leave/days";
import { HALF_OPTIONS, OWNER_EDITABLE, normalizeHalf, type HalfType } from "@/lib/leave/status";
import { thaiDate } from "@/lib/format";

const selectCls = "w-full h-10 px-3 bg-white border rounded-md text-sm";

/** ดูรายละเอียด / แก้ไข / ลบ ใบลาของตัวเอง (แก้ไขได้เฉพาะ pending และ failed) */
export default function LeaveRequestModal({
  open,
  item,
  onClose,
  onChanged,
}: {
  open: boolean;
  item: LeaveItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const editable = !!item && (OWNER_EDITABLE as readonly string[]).includes(item.status_code);
  const [tab, setTab] = useState<"detail" | "edit">("detail");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ reason: "", startDate: "", endDate: "", startType: "เต็มวัน" as HalfType, endType: "เต็มวัน" as HalfType });

  useEffect(() => {
    if (!item) return;
    setForm({
      reason: item.reason ?? "",
      startDate: item.startDate,
      endDate: item.endDate,
      startType: normalizeHalf(item.date_start_type),
      endType: normalizeHalf(item.date_end_type),
    });
    setFile(null);
    setTab("detail");
  }, [item, open]);

  const years = useMemo(() => [Number(form.startDate.slice(0, 4)), Number(form.endDate.slice(0, 4))].filter(Boolean), [form.startDate, form.endDate]);
  const { map: holidays, loading: loadingHolidays } = useHolidays(years);
  const { total, excluded } = useMemo(
    () => countLeaveDays({ start: form.startDate, end: form.endDate, startType: form.startType, endType: form.endType, holidays }),
    [form, holidays]
  );

  function pickDate(field: "startDate" | "endDate", raw: string, el: HTMLInputElement) {
    el.setCustomValidity("");
    if (!raw) return setForm((f) => ({ ...f, [field]: "" }));
    if (isNonWorkingISO(raw, holidays)) {
      el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
      el.reportValidity();
      return;
    }
    if (field === "endDate" && form.startDate && raw < form.startDate) {
      el.setCustomValidity("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา");
      el.reportValidity();
      return;
    }
    setForm((f) => ({ ...f, [field]: raw, endDate: field === "startDate" && f.endDate && f.endDate < raw ? "" : field === "endDate" ? raw : f.endDate }));
  }

  async function save() {
    if (!item) return;
    if (!form.startDate || !form.endDate) return toast.error("กรุณาเลือกช่วงวันลาให้ครบ");
    if (!form.reason.trim()) return toast.error("กรุณากรอกเหตุผลการลา");
    if (total <= 0) return toast.error("ช่วงวันที่เลือกไม่มีวันทำการ");
    if (file && (file.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
      return toast.error("ไฟล์ต้องเป็น PDF/JPG/PNG ขนาดไม่เกิน 5MB");
    }

    const fd = new FormData();
    fd.append("reason", form.reason.trim());
    fd.append("date_start", form.startDate);
    fd.append("date_end", form.endDate);
    fd.append("date_start_type", form.startType);
    fd.append("date_end_type", form.endType);
    fd.append("total_day", String(total));
    if (file) fd.append("file", file);

    setSaving(true);
    try {
      await apiFetch(`/api/user/leave-history/${item.id}`, { method: "PATCH", body: fd });
      toast.success("บันทึกการแก้ไขสำเร็จ");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm("ยืนยันการลบใบลานี้? ไฟล์แนบ (ถ้ามี) จะถูกลบด้วย")) return;
    setRemoving(true);
    try {
      await apiFetch(`/api/user/leave-history/${item.id}`, { method: "DELETE" });
      toast.success("ลบใบลาสำเร็จ");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && !removing && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รายละเอียดใบลา</DialogTitle>
          <DialogDescription>ดูรายละเอียด / สร้าง PDF / แก้ไข / ลบ</DialogDescription>
        </DialogHeader>

        {item && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "detail" | "edit")} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detail">รายละเอียด</TabsTrigger>
              <TabsTrigger value="edit" disabled={!editable}>
                แก้ไข
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="mt-4">
              <LeaveSummary item={item} />
            </TabsContent>

            <TabsContent value="edit" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label className="block mb-1">วันที่เริ่มลา</Label>
                      <Input type="date" className="h-10" value={form.startDate} onChange={(e) => pickDate("startDate", e.target.value, e.currentTarget)} />
                    </div>
                    <div>
                      <Label className="block mb-1">ช่วงเวลาเริ่ม</Label>
                      <select className={selectCls} value={form.startType} onChange={(e) => setForm((f) => ({ ...f, startType: e.target.value as HalfType }))}>
                        {HALF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="block mb-1">วันที่สิ้นสุด</Label>
                      <Input type="date" className="h-10" value={form.endDate} min={form.startDate || undefined} onChange={(e) => pickDate("endDate", e.target.value, e.currentTarget)} />
                    </div>
                    <div>
                      <Label className="block mb-1">ช่วงเวลาสิ้นสุด</Label>
                      <select className={selectCls} value={form.endType} disabled={form.startDate === form.endDate} onChange={(e) => setForm((f) => ({ ...f, endType: e.target.value as HalfType }))}>
                        {HALF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 text-sm border rounded-lg bg-blue-50">
                    <span className="text-slate-700">จำนวนวันลา (คำนวณอัตโนมัติ)</span>
                    <span className="font-bold text-blue-700">
                      {loadingHolidays ? <Loader2 className="inline-block w-4 h-4 animate-spin" /> : total} วัน
                    </span>
                  </div>

                  {excluded.length > 0 && (
                    <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                      <h5 className="flex items-center mb-2 text-sm font-semibold text-yellow-800">
                        <Info className="w-4 h-4 mr-2" />
                        วันที่ไม่นับ
                      </h5>
                      <ul className="space-y-1 text-sm text-yellow-700">
                        {excluded.map((d) => (
                          <li key={d.date}>
                            <span className="font-bold">{thaiDate(d.date, true)}</span> — {d.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <Label className="block mb-1">เหตุผล</Label>
                    <Textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label className="block mb-1">ไฟล์แนบเดิม</Label>
                    <FileList files={item.files} />
                    <Label className="block pt-2 mb-1">แทนที่ไฟล์แนบ (PDF/JPG/PNG ไม่เกิน 5MB)</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          {item && <GeneratePdfButton item={item} />}
          {editable && (
            <Button variant="destructive" disabled={removing || saving} onClick={remove}>
              {removing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              ลบใบลา
            </Button>
          )}
          {editable && tab === "edit" && (
            <Button onClick={save} disabled={saving || removing}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              บันทึกการแก้ไข
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving || removing}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
