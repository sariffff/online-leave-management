// components/user/leave-history/LeaveRequestModal.tsx
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar, User, Clock, CheckCircle, AlertCircle, Download, Pencil, Trash2, FileDown, FileText, Loader2, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

type Holiday = { start: string; summary: string };
async function fetchHolidaysForYear(year: number): Promise<Holiday[]> {
  const r = await fetch(`/api/holidays?start=${year}-01-01&end=${year}-12-31`, { cache: "no-store" });
  const j = await r.json().catch(() => ({ holidays: [] }));
  if (!r.ok) {
    console.error("Failed to fetch holidays:", j.error);
    return [];
  }
  return Array.isArray(j.holidays) ? j.holidays : [];
}

const HALF_OPTIONS: Array<"เต็มวัน" | "ครึ่งเช้า" | "ครึ่งบ่าย"> = ["เต็มวัน", "ครึ่งเช้า", "ครึ่งบ่าย"];

export type LeaveFile = { name: string; path: string; url?: string | null; signedUrl?: string | null };

export type LeaveDetail = {
  id: string;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  date_start_type: (typeof HALF_OPTIONS)[number] | string;
  date_end_type: (typeof HALF_OPTIONS)[number] | string;
  totalDays: number;
  reason: string;
  files: LeaveFile[];
  status: string;
  status_code: "pending" | "reviewed" | "approved" | "rejected" | "failed" | "cancelled" | string;
  comment: string | null;
  submittedAt: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
  year?: string | null;
};

type UpdatePayload = {
  reason?: string;
  startDate?: string;
  endDate?: string;
  date_start_type?: string;
  date_end_type?: string;
};

export type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: LeaveDetail | null;
  initialMode: "detail" | "edit";
  onUpdate?: (id: string, payload: (UpdatePayload & { total_day: number; __file?: File })) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** ไม่ใช้ล็อคการแก้ไขในเวอร์ชันนี้แล้ว — โฟกัสจากสถานะอย่างเดียว */
  canEditDelete?: boolean;
  profile?: {
    prename?: string;
    name?: string;
    surname?: string;
    position?: string;
    department?: string;
  };
};

function StatusBadge({ code }: { code: LeaveDetail["status_code"] }) {
  const c = String(code).toLowerCase();
  if (c === "approved") return <Badge className="bg-green-600">อนุมัติ</Badge>;
  if (c === "pending") return <Badge className="bg-amber-500">รอพิจารณา</Badge>;
  if (c === "failed" || c === "rejected") return <Badge className="bg-red-600">ไม่อนุมัติ</Badge>;
  if (c === "cancelled") return <Badge className="bg-red-500">ยกเลิก</Badge>;
  if (c === "reviewed") return <Badge className="bg-blue-600">ตรวจแล้วรออนุมัติ</Badge>;
  return <Badge variant="secondary">ไม่ทราบสถานะ</Badge>;
}

export default function LeaveRequestModal({
  open,
  onOpenChange,
  detail,
  initialMode,
  onUpdate,
  onDelete,
  profile,
}: Props) {
  const [tab, setTab] = useState<"detail" | "edit">(initialMode);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [nonWorking, setNonWorking] = useState<{ date: string; isHoliday: boolean; name: string }[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [files, setFiles] = useState<LeaveFile[]>(detail?.files ?? []);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ✅ อนุญาตแก้ไข: pending หรือ failed เท่านั้น (ตามที่ขอ)
  const isEditable = useMemo(() => {
    const sc = String(detail?.status_code || "").toLowerCase();
    return sc === "pending" || sc === "failed";
  }, [detail?.status_code]);

  const [form, setForm] = useState<
    UpdatePayload & {
      date_start_type: LeaveDetail["date_start_type"];
      date_end_type: LeaveDetail["date_end_type"];
    }
  >({
    reason: "",
    startDate: "",
    endDate: "",
    date_start_type: "เต็มวัน",
    date_end_type: "เต็มวัน",
  });

  const updateForm = useCallback(
    <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v })),
    []
  );

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const canSubmitEdit = !!detail && isEditable && !saving;

  const clearValidity = (e: React.FormEvent<HTMLInputElement>) => {
    e.currentTarget.setCustomValidity("");
  };
  const isHolidayStr = useCallback(
    (dateStr: string) => holidays.some((h) => h.start === dateStr),
    [holidays]
  );
  const isNonWorkingISO = useCallback(
    (iso: string) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return false;
      return isWeekend(d) || isHolidayStr(fmtISO(d));
    },
    [isHolidayStr]
  );

  useEffect(() => {
    if (!detail) return;
    setForm({
      reason: detail.reason ?? "",
      startDate: detail.startDate ?? "",
      endDate: detail.endDate ?? "",
      date_start_type: (detail.date_start_type ?? "เต็มวัน") as LeaveDetail["date_start_type"],
      date_end_type: (detail.date_end_type ?? "เต็มวัน") as LeaveDetail["date_end_type"],
    });
    const nextFiles = (detail.files ?? []).map((f) => ({
      ...f,
      url: f.url ?? f.signedUrl ?? f.path,
    }));
    setFiles(nextFiles);
    setTab(initialMode);
  }, [detail, open, initialMode]);

  // โหลดวันหยุดปีปัจจุบัน
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingHolidays(true);
        const y = new Date().getFullYear();
        const list = await fetchHolidaysForYear(y);
        if (!cancelled) setHolidays(list);
      } catch {
        if (!cancelled) setHolidays([]);
      } finally {
        if (!cancelled) setLoadingHolidays(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ถ้าช่วงวันที่ข้ามปี ให้ดึงวันหยุดของปีอื่นเพิ่ม
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ys = new Set<number>();
      if (form.startDate) ys.add(new Date(form.startDate).getFullYear());
      if (form.endDate) ys.add(new Date(form.endDate).getFullYear());
      if (ys.size === 0) return;

      const needYears = Array.from(ys).filter(
        (y) => !holidays.some((h) => String(h.start).startsWith(`${y}-`))
      );
      if (needYears.length === 0) return;

      try {
        setLoadingHolidays(true);
        const batches = await Promise.all(needYears.map((y) => fetchHolidaysForYear(y)));
        const merged = [...holidays, ...batches.flat()];
        if (!cancelled) setHolidays(merged);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingHolidays(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate]);

  // คำนวณวันทำงาน + ลิสต์วันถูกตัดออก
  const totalDays = useMemo(() => {
    const { startDate, endDate, date_start_type, date_end_type } = form;
    setNonWorking([]);

    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (s > e) return 0;

    const nonWork: { date: string; isHoliday: boolean; name: string }[] = [];
    let working = 0;

    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dayISO = fmtISO(d);
      const weekend = isWeekend(d);
      const holiday = holidays.find((h) => h.start === dayISO);

      if (weekend) {
        nonWork.push({ date: dayISO, isHoliday: false, name: "วันหยุดสุดสัปดาห์" });
        continue;
      }
      if (holiday) {
        nonWork.push({ date: dayISO, isHoliday: true, name: holiday.summary || "วันหยุดราชการ" });
        continue;
      }
      working += 1;
    }

    if (working > 0) {
      const sISO = fmtISO(s);
      const eISO = fmtISO(e);
      if (!isWeekend(s) && !holidays.find((h) => h.start === sISO)) {
        if (date_start_type !== "เต็มวัน") working -= 0.5;
      }
      if (sISO === eISO) {
        if (date_start_type === "ครึ่งเช้า" && date_end_type === "ครึ่งบ่าย") {
          working = 1;
        } else if (date_start_type !== "เต็มวัน" || date_end_type !== "เต็มวัน") {
          working = 0.5;
        }
      } else {
        const endIsWeekend = isWeekend(e);
        const endIsHoliday = holidays.find((h) => h.start === eISO);
        if (!endIsWeekend && !endIsHoliday) {
          if (date_end_type !== "เต็มวัน") working -= 0.5;
        }
      }
    }

    setNonWorking(nonWork);
    return Math.max(0, Math.round(working * 2) / 2);
  }, [form.startDate, form.endDate, form.date_start_type, form.date_end_type, holidays]);

  const dateRange = useMemo(() => {
    if (!detail) return "";
    return `${detail.startDate} (${detail.date_start_type}) → ${detail.endDate} (${detail.date_end_type}) • รวม ${
      detail.totalDays ?? 0
    } วัน`;
  }, [detail]);

  const refreshDetailFiles = useCallback(
    async (id: string) => {
      try {
        setLoadingFiles(true);
        const res = await fetch(`/api/user/leave-history/${id}`, { cache: "no-store" });
        if (!res.ok) {
          console.warn(`refresh failed ${res.status}`);
          return;
        }
        const j = await res.json();
        const freshFiles: LeaveFile[] = Array.isArray(j.files)
          ? j.files.map((f: any) => ({
              name: f.name ?? (String(f.path || "").split("?")[0].split("/").pop() || "file"),
              path: f.path ?? "",
              url: f.url ?? f.signedUrl ?? f.path,
              signedUrl: f.signedUrl ?? f.url ?? null,
            }))
          : [];
        setFiles(freshFiles);
      } catch (e) {
        console.warn("[LeaveRequestModal] refreshDetailFiles error:", e);
      } finally {
        setLoadingFiles(false);
      }
    },
    []
  );

  // Handlers: ล็อควันเสาร์-อาทิตย์/วันหยุดราชการตอนเลือกวันที่
  const handleChangeStartDate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isEditable) return;
      const raw = e.target.value;
      const el = e.currentTarget;
      el.setCustomValidity("");

      if (!raw) {
        updateForm("startDate", "");
        return;
      }
      if (isNonWorkingISO(raw)) {
        el.focus();
        el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
        el.reportValidity();
        return;
      }

      if (form.endDate && new Date(form.endDate) < new Date(raw)) {
        updateForm("endDate", "");
      }
      updateForm("startDate", raw);
    },
    [isEditable, isNonWorkingISO, form.endDate, updateForm]
  );

  const handleChangeEndDate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isEditable) return;

      const raw = e.target.value;
      const el = e.currentTarget;
      el.setCustomValidity("");

      if (!raw) {
        updateForm("endDate", "");
        return;
      }
      if (isNonWorkingISO(raw)) {
        el.focus();
        el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
        el.reportValidity();
        return;
      }
      if (form.startDate && new Date(raw) < new Date(form.startDate)) {
        el.focus();
        el.setCustomValidity("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา");
        el.reportValidity();
        return;
      }

      updateForm("endDate", raw);
    },
    [isEditable, isNonWorkingISO, form.startDate, updateForm]
  );

  async function handleSave() {
    if (!canSubmitEdit || !onUpdate || !detail) return;

    // double-check
    if (!form.startDate || !form.endDate) {
      toast.error("กรุณาเลือกช่วงวันลาให้ครบ");
      return;
    }
    if (isNonWorkingISO(form.startDate)) {
      toast.error("วันเริ่มลาเป็นวันหยุด ไม่สามารถบันทึกได้");
      return;
    }
    if (isNonWorkingISO(form.endDate)) {
      toast.error("วันสิ้นสุดเป็นวันหยุด ไม่สามารถบันทึกได้");
      return;
    }
    if (new Date(form.startDate) > new Date(form.endDate)) {
      toast.error("วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มลา");
      return;
    }

    try {
      setSaving(true);
      await onUpdate(detail.id, {
        ...form,
        total_day: totalDays,
        __file: selectedFile || undefined,
      });
      await refreshDetailFiles(detail.id);
      toast.success("บันทึกการแก้ไขสำเร็จ");
      setTab("detail");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail || !onDelete) return;
    const ok = window.confirm("ยืนยันการลบใบลานี้? ไฟล์แนบ (ถ้ามี) จะถูกลบด้วย");
    if (!ok) return;
    try {
      setRemoving(true);
      await onDelete(detail.id);
      toast.success("ลบใบลาสำเร็จ");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            รายละเอียดใบลา
          </DialogTitle>
          <DialogDescription>ดูรายละเอียด / สร้าง PDF / แก้ไข / ลบ จากที่นี่</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detail">รายละเอียด</TabsTrigger>
            {/* ✅ เปิดแท็บแก้ไขถ้าสถานะอนุญาต (ไม่เอา canEditDelete มาล็อค) */}
            <TabsTrigger value="edit" disabled={!isEditable}>แก้ไข</TabsTrigger>
          </TabsList>

          {/* รายละเอียด */}
          <TabsContent value="detail" className="mt-4">
            {!detail ? (
              <div className="text-sm text-muted-foreground">ไม่พบข้อมูล</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge code={detail.status_code} />
                  <div className="text-sm text-muted-foreground">ปีงบประมาณ: {detail.year ?? "-"}</div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">ช่วงวันลา</span>
                    </div>
                    <div className="text-sm">{dateRange}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="font-medium">ประเภทการลา</span>
                    </div>
                    <div className="text-sm">{detail.leaveType ?? "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">เวลาส่ง</span>
                    </div>
                    <div className="text-xs text-muted-foreground">ส่ง: {detail.submittedAt ?? "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">ผู้ตรวจ/ผู้อนุมัติ</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ตรวจโดย: {detail.reviewedBy ?? "-"} / อนุมัติโดย: {detail.approvedBy ?? "-"}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="font-medium">เหตุผล</div>
                  <div className="text-sm whitespace-pre-wrap">{detail.reason || "-"}</div>
                </div>

                {(detail.status_code === "failed" || detail.status_code === "rejected") && (
                  <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      ความเห็นผู้ตรวจ/เหตุผลที่ไม่ผ่าน
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{detail.comment || "-"}</div>
                  </div>
                )}

                {!!files?.length && (
                  <div className="space-y-2">
                    <div className="font-medium">ไฟล์แนบ</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {loadingFiles && <Loader2 className="w-4 h-4 animate-spin" />}
                      {files.map((f) => {
                        const href = f.url ?? f.signedUrl ?? f.path;
                        return (
                          <a
                            key={f.path}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm underline"
                          >
                            <Download className="w-4 h-4" />
                            {f.name}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* แก้ไข */}
          <TabsContent value="edit" className="mt-4">
            {!detail ? null : (
              <div className="space-y-4">
                {!isEditable ? (
                  <div className="text-sm text-muted-foreground">ไม่สามารถแก้ไขได้ในสถานะปัจจุบัน</div>
                ) : null}

                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {/* วันที่เริ่ม / ช่วงเวลาเริ่ม */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="block mb-1">วันที่เริ่มลา</Label>
                        <Input
                          type="date"
                          value={form.startDate}
                          min={today}
                          onInput={clearValidity}
                          onChange={handleChangeStartDate}
                          disabled={!isEditable}
                        />
                      </div>
                      <div>
                        <Label className="block mb-1">ช่วงเวลาเริ่ม</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={form.date_start_type}
                          onChange={(e) => updateForm("date_start_type", e.target.value as typeof form.date_start_type)}
                          disabled={!isEditable}
                        >
                          {HALF_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o === "เต็มวัน" ? "เต็มวัน" : o === "ครึ่งเช้า" ? "ครึ่งวันเช้า" : "ครึ่งวันบ่าย"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* วันที่สิ้นสุด / ช่วงเวลาสิ้นสุด */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="block mb-1">วันที่สิ้นสุด</Label>
                        <Input
                          type="date"
                          value={form.endDate}
                          min={form.startDate || today}
                          onInput={clearValidity}
                          onChange={handleChangeEndDate}
                          disabled={!isEditable}
                        />
                      </div>
                      <div>
                        <Label className="block mb-1">ช่วงเวลาสิ้นสุด</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={form.date_end_type}
                          onChange={(e) => updateForm("date_end_type", e.target.value as typeof form.date_end_type)}
                          disabled={!isEditable || form.startDate === form.endDate}
                        >
                          {HALF_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o === "เต็มวัน" ? "เต็มวัน" : o === "ครึ่งเช้า" ? "ครึ่งวันเช้า" : "ครึ่งวันบ่าย"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* total days */}
                    <div className="p-3 text-sm border rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700">จำนวนวันลา (คำนวณอัตโนมัติ)</span>
                        <span className="font-bold text-blue-700">
                          {loadingHolidays ? <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" /> : totalDays} วัน
                        </span>
                      </div>
                    </div>

                    {/* หมายเหตุวันตัดออก */}
                    {nonWorking.length > 0 && (
                      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                        <h5 className="flex items-center mb-2 text-sm font-semibold text-yellow-800">
                          <Info className="w-4 h-4 mr-2" />
                          หมายเหตุ (วันถูกตัดออก)
                        </h5>
                        <ul className="space-y-1 text-sm text-yellow-700">
                          {nonWorking.map((n) => (
                            <li key={n.date}>
                              <span className="font-bold">{n.date}</span>{" "}
                              เป็น {n.isHoliday ? "วันหยุดราชการ" : "วันหยุดสุดสัปดาห์"}
                              {n.name ? ` (${n.name})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* reason */}
                    <div>
                      <Label className="block mb-1">เหตุผล</Label>
                      <Textarea
                        rows={3}
                        value={form.reason}
                        onChange={(e) => updateForm("reason", e.target.value)}
                        disabled={!isEditable}
                      />
                    </div>

                    {/* files (display only) */}
                    <div className="space-y-2">
                      <Label className="block mb-1">ไฟล์แนบเดิม</Label>
                      {files.length === 0 ? (
                        <div className="p-3 text-sm border rounded-md bg-muted/30 text-muted-foreground">ไม่มีไฟล์แนบ</div>
                      ) : (
                        <ul className="space-y-2" aria-label="ไฟล์แนบ">
                          {files.map((f) => {
                            const href = f.url ?? f.signedUrl ?? f.path;
                            return (
                              <li key={f.path} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center min-w-0 gap-2">
                                  <span className="text-sm font-medium truncate" title={f.name}>{f.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => href && window.open(href, "_blank", "noopener")}
                                  >
                                    เปิดไฟล์
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* upload (replace) */}
                    <div className="pt-2">
                      <Label className="block mb-1">แทนที่ไฟล์แนบ (PDF/JPG/PNG)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={!isEditable}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedFile ? <>ไฟล์ที่เลือก: <span className="font-medium">{selectedFile.name}</span></> : <> (เลือกไฟล์ใหม่เฉพาะกรณีต้องการแทนที่)</>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="secondary" onClick={() => toast.success("PDF (จำลอง) ถูกสร้างและเปิดแล้ว")}>
            <FileDown className="w-4 h-4 mr-2" />
            สร้าง/เปิด PDF
          </Button>

          {/* อนุญาตลบเมื่อสถานะแก้ไขได้ */}
          {isEditable && (
            <Button variant="destructive" disabled={removing} onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : "ลบใบลา"}
            </Button>
          )}

          <Button onClick={handleSave} disabled={!canSubmitEdit || saving || tab !== "edit"}>
            <Pencil className="w-4 h-4 mr-2" />
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "บันทึกการแก้ไข"}
          </Button>

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || removing}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
