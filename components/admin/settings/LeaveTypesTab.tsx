"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";
import { describeRule } from "@/lib/leave/rules";
import { LEAVE_COLORS, type LeaveColor, type LeaveTypeRule } from "@/lib/settings-schema";
import type { LeaveTypeWithRule } from "@/types/db";

type Item = LeaveTypeWithRule & { usage: number };

/** ค่าในฟอร์ม: ตัวเลขเก็บเป็นข้อความ ("" = ไม่จำกัด) */
type Form = {
  leave_type_name: string;
  max_leave_day: string;
  carry_over_max: string;
  note: string;
  description: string;
  color: LeaveColor;
  isActive: boolean;
  maxDaysPerRequest: string;
  docRequiredAfterDays: string;
  minNoticeDays: string;
  maxBackdateDays: string;
  allowHalfDay: boolean;
  countMode: LeaveTypeRule["countMode"];
};

const s = (n: number | null) => (n === null || n === undefined ? "" : String(n));
const n = (v: string) => (v.trim() === "" ? null : Number(v));

const EMPTY: Form = {
  leave_type_name: "",
  max_leave_day: "",
  carry_over_max: "",
  note: "",
  description: "",
  color: "gray",
  isActive: true,
  maxDaysPerRequest: "",
  docRequiredAfterDays: "",
  minNoticeDays: "",
  maxBackdateDays: "",
  allowHalfDay: true,
  countMode: "working",
};

const toForm = (t: Item): Form => ({
  leave_type_name: t.leave_type_name,
  max_leave_day: s(t.max_leave_day),
  carry_over_max: s(t.carry_over_max),
  note: t.note ?? "",
  description: t.rule.description,
  color: (t.rule.color as LeaveColor) in LEAVE_COLORS ? (t.rule.color as LeaveColor) : "gray",
  isActive: t.rule.isActive,
  maxDaysPerRequest: s(t.rule.maxDaysPerRequest),
  docRequiredAfterDays: s(t.rule.docRequiredAfterDays),
  minNoticeDays: s(t.rule.minNoticeDays),
  maxBackdateDays: s(t.rule.maxBackdateDays),
  allowHalfDay: t.rule.allowHalfDay,
  countMode: t.rule.countMode,
});

const toBody = (f: Form) => ({
  leave_type_name: f.leave_type_name.trim(),
  max_leave_day: n(f.max_leave_day),
  carry_over_max: n(f.carry_over_max),
  note: f.note.trim() || null,
  description: f.description.trim(),
  color: f.color,
  isActive: f.isActive,
  maxDaysPerRequest: n(f.maxDaysPerRequest),
  docRequiredAfterDays: n(f.docRequiredAfterDays),
  minNoticeDays: n(f.minNoticeDays),
  maxBackdateDays: n(f.maxBackdateDays),
  allowHalfDay: f.allowHalfDay,
  countMode: f.countMode,
});

export default function LeaveTypesTab({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: Item | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await apiFetch<{ items: Item[] }>("/api/admin/leave-types")).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const done = (msg: string) => {
    toast.success(msg);
    load();
    onChanged();
  };

  async function save() {
    if (!editing) return;
    const f = editing.form;
    if (!f.leave_type_name.trim()) return toast.error("กรุณากรอกชื่อประเภทการลา");
    setSaving(true);
    try {
      if (editing.item) await apiFetch(`/api/admin/leave-types/${editing.item.leave_type_id}`, { method: "PATCH", json: toBody(f) });
      else await apiFetch("/api/admin/leave-types", { method: "POST", json: toBody(f) });
      setEditing(null);
      done(editing.item ? "บันทึกการแก้ไขแล้ว" : "เพิ่มประเภทการลาแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: Item) {
    setBusyId(t.leave_type_id);
    try {
      await apiFetch(`/api/admin/leave-types/${t.leave_type_id}`, { method: "PATCH", json: { isActive: !t.rule.isActive } });
      done(t.rule.isActive ? `ปิดใช้งาน "${t.leave_type_name}" แล้ว` : `เปิดใช้งาน "${t.leave_type_name}" แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const next = [...items];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next); // แสดงทันที
    try {
      await apiFetch("/api/admin/leave-types/order", { method: "PUT", json: { ids: next.map((t) => t.leave_type_id) } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เรียงลำดับไม่สำเร็จ");
      load();
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyId(deleting.leave_type_id);
    try {
      await apiFetch(`/api/admin/leave-types/${deleting.leave_type_id}`, { method: "DELETE" });
      setDeleting(null);
      done("ลบประเภทการลาแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const f = editing?.form;
  const setF = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const numField = (key: keyof Form, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`lt-${key}`}>{label}</Label>
      <Input
        id={`lt-${key}`}
        className="h-10"
        inputMode="numeric"
        placeholder="ไม่จำกัด"
        value={f ? (f[key] as string) : ""}
        onChange={(e) => setF({ [key]: e.target.value.replace(/[^\d]/g, "").slice(0, 4) } as Partial<Form>)}
      />
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );

  return (
    <section className="overflow-hidden bg-white border shadow-sm rounded-xl">
      <div className="flex flex-col gap-3 px-4 py-3 border-b sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-semibold text-gray-900">ประเภทการลา ({items.length})</h2>
          <p className="text-sm text-gray-500">ลำดับในรายการนี้ = ลำดับที่บุคลากรเห็นในหน้ายื่นลา · ประเภทที่มีใบลาแล้วลบไม่ได้ ให้ปิดใช้งานแทน</p>
        </div>
        <Button className="h-10 text-white bg-(--brand) hover:opacity-90" onClick={() => setEditing({ item: null, form: EMPTY })}>
          <Plus className="w-4 h-4" /> เพิ่มประเภทการลา
        </Button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : error ? (
        <p className="px-4 py-10 text-center text-red-600">{error}</p>
      ) : (
        <ul className="divide-y">
          {items.map((t, i) => {
            const c = LEAVE_COLORS[t.rule.color as LeaveColor] ?? LEAVE_COLORS.gray;
            const rules = describeRule(t.rule);
            const busy = busyId === t.leave_type_id;
            return (
              <li key={t.leave_type_id} className={`flex gap-3 p-4 sm:px-6 ${t.rule.isActive ? "" : "bg-gray-50"}`}>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อน ${t.leave_type_name} ขึ้น`} className="p-1.5 rounded-md border text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`เลื่อน ${t.leave_type_name} ลง`} className="p-1.5 rounded-md border text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${c.chip}`}>{t.leave_type_name}</span>
                    {!t.rule.isActive && <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">ปิดใช้งาน</span>}
                  </div>
                  <div className="text-sm text-gray-700">
                    {t.max_leave_day === null ? "ไม่จำกัดโควตา" : `${t.max_leave_day} วัน/ปี`}
                    {t.carry_over_max ? ` · สะสมได้ ${t.carry_over_max} วัน` : ""} · ใช้แล้ว {t.usage} ใบ
                  </div>
                  {rules.length > 0 && <div className="text-xs text-gray-500">{rules.join(" · ")}</div>}
                  {t.rule.description && <div className="text-xs text-gray-400 truncate">{t.rule.description}</div>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 sm:flex-row sm:items-start">
                  <Button size="sm" variant="outline" className="h-9" aria-label={`แก้ไข ${t.leave_type_name}`} onClick={() => setEditing({ item: t, form: toForm(t) })}>
                    <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">แก้ไข</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => toggle(t)} aria-label={t.rule.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    <span className="hidden sm:inline">{t.rule.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</span>
                  </Button>
                  {t.usage === 0 && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 h-9 hover:bg-red-50" onClick={() => setDeleting(t)} aria-label="ลบ">
                      <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">ลบ</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* เพิ่ม / แก้ไข */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.item ? `แก้ไข "${editing.item.leave_type_name}"` : "เพิ่มประเภทการลา"}</DialogTitle>
            <DialogDescription>เว้นว่างช่องตัวเลข = ไม่จำกัด</DialogDescription>
          </DialogHeader>
          {f && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lt-name">ชื่อประเภทการลา *</Label>
                  <Input id="lt-name" className="h-10" maxLength={100} value={f.leave_type_name} onChange={(e) => setF({ leave_type_name: e.target.value })} />
                </div>
                {numField("max_leave_day", "จำนวนวันลาต่อปี", "ว่าง = ไม่จำกัดโควตา")}
                {numField("carry_over_max", "สะสมได้สูงสุด (วัน)", "วันที่เหลือจากปีก่อนยกมาได้ไม่เกินเท่านี้")}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lt-desc">คำอธิบาย (แสดงในหน้ายื่นลา)</Label>
                  <Input id="lt-desc" className="h-10" maxLength={300} value={f.description} onChange={(e) => setF({ description: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lt-note">หมายเหตุตามระเบียบ</Label>
                  <Textarea id="lt-note" rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ note: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>สี</Label>
                <div role="radiogroup" aria-label="สีของประเภทการลา" className="flex flex-wrap gap-2">
                  {(Object.keys(LEAVE_COLORS) as LeaveColor[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={f.color === k}
                      onClick={() => setF({ color: k })}
                      className={`rounded-full px-3 py-1 text-sm ${LEAVE_COLORS[k].chip} ${f.color === k ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                    >
                      {LEAVE_COLORS[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 space-y-4 border rounded-lg bg-gray-50">
                <h3 className="font-medium text-gray-900">กฎการลา</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {numField("maxDaysPerRequest", "ลาได้ครั้งละไม่เกิน (วัน)", "ว่าง = ไม่จำกัด")}
                  {numField("docRequiredAfterDays", "ต้องแนบเอกสารเมื่อลาเกิน (วัน)", "0 = ต้องแนบทุกครั้ง · ว่าง = ไม่บังคับ")}
                  {numField("minNoticeDays", "ต้องยื่นล่วงหน้าอย่างน้อย (วัน)", "ว่างหรือ 0 = ยื่นวันเดียวกันได้")}
                  {numField("maxBackdateDays", "ยื่นย้อนหลังได้ไม่เกิน (วัน)", "0 = ยื่นย้อนหลังไม่ได้ · ว่าง = ไม่จำกัด")}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="w-4 h-4" checked={f.allowHalfDay} onChange={(e) => setF({ allowHalfDay: e.target.checked })} />
                  ลาครึ่งวันได้
                </label>
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">วิธีนับจำนวนวันลา</legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="countMode" className="mt-1" checked={f.countMode === "working"} onChange={() => setF({ countMode: "working" })} />
                    <span>นับเฉพาะวันทำการ <span className="text-gray-500">(ตัดเสาร์-อาทิตย์และวันหยุด)</span></span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="countMode" className="mt-1" checked={f.countMode === "calendar"} onChange={() => setF({ countMode: "calendar" })} />
                    <span>นับรวมวันหยุด <span className="text-gray-500">(เช่น ลาคลอดบุตร 90 วันนับต่อเนื่อง)</span></span>
                  </label>
                </fieldset>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="w-4 h-4" checked={f.isActive} onChange={(e) => setF({ isActive: e.target.checked })} />
                  เปิดใช้งาน (บุคลากรเลือกประเภทนี้ได้)
                </label>
              </div>
              <p className="text-xs text-gray-500">ใบลาที่ยื่นไปแล้วไม่ถูกคำนวณใหม่ — กฎใหม่ใช้กับใบลาที่ยื่น/แก้ไขหลังบันทึก</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving} className="text-white bg-(--brand) hover:opacity-90">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันลบ */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && busyId === null && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ลบประเภทการลา?</DialogTitle>
            <DialogDescription>ลบ &ldquo;{deleting?.leave_type_name}&rdquo; ออกจากระบบ (ย้อนกลับได้จากประวัติการแก้ไข)</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busyId !== null}>ยกเลิก</Button>
            <Button variant="destructive" onClick={remove} disabled={busyId !== null}>
              {busyId !== null && <Loader2 className="w-4 h-4 animate-spin" />} ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
