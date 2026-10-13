"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client/api";
import { SaveBar, useUnsavedWarning } from "@/components/admin/settings/GeneralTab";
import { SettingsError, periodPartOf, validatePeriods, type PeriodSettings } from "@/lib/settings-schema";

type Props = {
  value: PeriodSettings;
  defaults: PeriodSettings;
  onDirty: (dirty: boolean) => void;
  onSaved: (value: PeriodSettings) => void;
};

const MAX_PERIODS = 12;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** ตรวจด้วยกฎเดียวกับระบบหลังบ้าน — คืนข้อความผิดพลาด (null = ใช้ได้) */
function problemOf(form: PeriodSettings): string | null {
  try {
    validatePeriods(form, form);
    return null;
  } catch (e) {
    return e instanceof SettingsError ? e.message : "ข้อมูลไม่ถูกต้อง";
  }
}

export default function PeriodsTab({ value, defaults, onDirty, onSaved }: Props) {
  const [form, setForm] = useState<PeriodSettings>(value);
  const [sync, setSync] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(value), [form, value]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useUnsavedWarning(dirty);
  const problem = useMemo(() => problemOf(form), [form]);
  const timesChanged = useMemo(
    () => form.periods.some((p) => {
      const old = value.periods.find((x) => x.period_number === p.period_number);
      return old && (old.start_time !== p.start_time || old.end_time !== p.end_time);
    }),
    [form, value]
  );

  const setPeriod = (i: number, patch: Partial<{ start_time: string; end_time: string }>) =>
    setForm((f) => ({ ...f, periods: f.periods.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  /** เพิ่มคาบต่อท้าย: เริ่มเมื่อคาบสุดท้ายจบ ยาวเท่าคาบสุดท้าย */
  function addPeriod() {
    setForm((f) => {
      const last = f.periods.at(-1);
      const len = last ? Math.max(10, toMin(last.end_time) - toMin(last.start_time)) : 50;
      const start = last ? toMin(last.end_time) : 8 * 60;
      return { ...f, periods: [...f.periods, { period_number: f.periods.length + 1, start_time: fromMin(start), end_time: fromMin(start + len) }] };
    });
  }

  function removePeriod(i: number) {
    setForm((f) => ({ ...f, periods: f.periods.filter((_, j) => j !== i).map((p, j) => ({ ...p, period_number: j + 1 })) }));
  }

  async function save() {
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const r = await apiFetch<{ value: PeriodSettings; updatedRows: number; rowsBeyond: number }>("/api/admin/settings/periods", {
        method: "PUT",
        json: { ...form, syncSchedule: sync && timesChanged },
      });
      setForm(r.value);
      setSync(false);
      onSaved(r.value);
      toast.success(r.updatedRows > 0 ? `บันทึกแล้ว · ปรับเวลาในตารางสอน ${r.updatedRows} แถว` : "บันทึกคาบเรียนแล้ว");
      if (r.rowsBeyond > 0) {
        toast(`มีตารางสอน ${r.rowsBeyond} แถวอยู่ในคาบที่เกิน ${r.value.periods.length} คาบ — ตรวจที่หน้า "จัดการตารางสอน"`, { icon: "⚠️", duration: 8000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="p-4 space-y-4 bg-white border shadow-sm sm:p-6 rounded-xl">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">คาบเรียน ({form.periods.length} คาบ)</h2>
            <p className="text-sm text-gray-600">ใช้ในหน้าจัดการตารางสอนและการจัดสอนแทน</p>
          </div>
          <Button type="button" variant="outline" className="h-10" onClick={addPeriod} disabled={form.periods.length >= MAX_PERIODS}>
            <Plus className="w-4 h-4" /> เพิ่มคาบ
          </Button>
        </div>

        <ul className="space-y-2">
          {form.periods.map((p, i) => {
            const part = periodPartOf(form, p.period_number, p.start_time);
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 p-3 border rounded-lg sm:flex-nowrap">
                <span className="w-16 font-medium text-gray-900 shrink-0">คาบ {i + 1}</span>
                {/* มือถือ: เวลาอยู่บรรทัดที่สอง เต็มความกว้าง */}
                <div className="flex items-center order-last w-full gap-2 sm:order-none sm:w-auto">
                  <Input type="time" aria-label={`คาบ ${i + 1} เวลาเริ่ม`} className="flex-1 h-10 sm:w-32 sm:flex-none" value={p.start_time} onChange={(e) => setPeriod(i, { start_time: e.target.value })} />
                  <span className="text-gray-400">–</span>
                  <Input type="time" aria-label={`คาบ ${i + 1} เวลาสิ้นสุด`} className="flex-1 h-10 sm:w-32 sm:flex-none" value={p.end_time} onChange={(e) => setPeriod(i, { end_time: e.target.value })} />
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${part === "am" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                  {part === "am" ? "ช่วงเช้า" : "ช่วงบ่าย"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 ml-auto text-red-600 hover:bg-red-50"
                  aria-label={`ลบคาบ ${i + 1}`}
                  onClick={() => removePeriod(i)}
                  disabled={form.periods.length <= 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            );
          })}
        </ul>
        {problem && <p className="text-sm text-red-600" role="alert">{problem}</p>}
        <p className="text-xs text-gray-500">ลบคาบกลางรายการแล้ว คาบถัดไปจะเลื่อนเลขขึ้นมา — ตารางสอนเดิมผูกกับ &ldquo;เลขคาบ&rdquo; จึงควรตรวจตารางสอนหลังเปลี่ยนจำนวนคาบ</p>
      </section>

      <section className="p-4 space-y-3 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">ช่วงเช้า / ช่วงบ่าย</h2>
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="afternoonStartsAt">ช่วงบ่ายเริ่มเวลา</Label>
          <Input id="afternoonStartsAt" type="time" className="h-10" value={form.afternoonStartsAt} onChange={(e) => setForm((f) => ({ ...f, afternoonStartsAt: e.target.value }))} />
        </div>
        <p className="text-sm text-gray-600">คาบที่เริ่มก่อนเวลานี้ = ช่วงเช้า · ใช้ตัดสินว่าผู้ที่ลาครึ่งเช้า/ครึ่งบ่ายต้องมีคนสอนแทนคาบไหนบ้าง</p>
      </section>

      {timesChanged && (
        <label className="flex items-start gap-3 p-4 border border-amber-200 rounded-xl bg-amber-50">
          <input type="checkbox" className="w-4 h-4 mt-0.5 shrink-0" checked={sync} onChange={(e) => setSync(e.target.checked)} />
          <span className="text-sm text-amber-900">
            <span className="block font-medium">ปรับเวลาในตารางสอนเดิมตามเวลาใหม่ด้วย</span>
            ไม่เลือก = ตารางสอนที่บันทึกไว้แล้วยังใช้เวลาเดิม (เฉพาะตารางที่เพิ่มใหม่ใช้เวลาใหม่)
          </span>
        </label>
      )}

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setForm(defaults)} />
    </div>
  );
}
