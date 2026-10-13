"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, ImagePlus, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client/api";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { THEMES, type GeneralSettings, type ThemeKey } from "@/lib/settings-schema";

type Props = {
  value: GeneralSettings;
  defaults: GeneralSettings;
  onDirty: (dirty: boolean) => void;
  onSaved: (value: GeneralSettings) => void;
};

/** เตือนเมื่อปิด/รีเฟรชหน้าโดยยังไม่บันทึก */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

/** แถบบันทึก — ติดล่างจอบนมือถือ */
export function SaveBar({ dirty, saving, onSave, onReset, resetLabel = "คืนค่าเริ่มต้น" }: { dirty: boolean; saving: boolean; onSave: () => void; onReset?: () => void; resetLabel?: string }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 p-3 -mx-4 bg-white border-t sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
      {onReset && (
        <Button type="button" variant="outline" className="h-10" onClick={onReset} disabled={saving}>
          <RotateCcw className="w-4 h-4" /> {resetLabel}
        </Button>
      )}
      <Button type="button" className="h-10 text-white bg-(--brand) hover:opacity-90" onClick={onSave} disabled={!dirty || saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "กำลังบันทึก..." : dirty ? "บันทึก" : "บันทึกแล้ว"}
      </Button>
    </div>
  );
}

const FIELDS: { key: "systemName" | "systemShortName" | "schoolName" | "approverTitle" | "footerText"; label: string; hint: string; max: number }[] = [
  { key: "systemName", label: "ชื่อระบบ", hint: "แสดงที่หัวเว็บ (จอคอมพิวเตอร์), ชื่อแท็บเบราว์เซอร์ และหน้าเข้าสู่ระบบ", max: 120 },
  { key: "systemShortName", label: "ชื่อระบบแบบย่อ", hint: "แสดงที่หัวเว็บบนมือถือ", max: 40 },
  { key: "schoolName", label: "ชื่อโรงเรียน", hint: "หัวใบลาที่พิมพ์", max: 120 },
  { key: "approverTitle", label: "ตำแหน่งผู้อนุมัติ", hint: "บรรทัด \"เรียน …\" และตำแหน่งใต้ลายเซ็นในใบลาที่พิมพ์", max: 120 },
  { key: "footerText", label: "ข้อความท้ายเมนู", hint: "แสดงใต้เมนูด้านข้าง (เว้นว่างได้)", max: 80 },
];

export default function GeneralTab({ value, defaults, onDirty, onSaved }: Props) {
  const [form, setForm] = useState<GeneralSettings>(value);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  // โลโก้บันทึกแยกทันทีที่อัปโหลด จึงไม่นับเป็น "ยังไม่บันทึก"
  const dirty = useMemo(() => JSON.stringify({ ...form, logoUrl: null }) !== JSON.stringify({ ...value, logoUrl: null }), [form, value]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useUnsavedWarning(dirty);

  const theme = THEMES[form.theme];
  const set = (patch: Partial<GeneralSettings>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    for (const f of FIELDS) {
      if (f.key !== "footerText" && !form[f.key].trim()) return toast.error(`กรุณากรอก${f.label}`);
    }
    setSaving(true);
    try {
      const r = await apiFetch<{ value: GeneralSettings }>("/api/admin/settings/general", { method: "PUT", json: { ...form, logoUrl: undefined } });
      setForm(r.value);
      onSaved(r.value);
      toast.success("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) return toast.error("ไฟล์โลโก้ต้องไม่เกิน 1MB");
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const r = await apiFetch<{ logoUrl: string }>("/api/admin/settings/logo", { method: "POST", body: fd });
      set({ logoUrl: r.logoUrl });
      onSaved({ ...value, logoUrl: r.logoUrl });
      toast.success("อัปโหลดโลโก้แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    if (!(await confirm({ title: "เอาโลโก้ออก?", description: "ย้อนกลับได้จากประวัติการแก้ไข", confirmLabel: "เอาออก", danger: true }))) return;
    setUploading(true);
    try {
      await apiFetch("/api/admin/settings/logo", { method: "DELETE" });
      set({ logoUrl: null });
      onSaved({ ...value, logoUrl: null });
      toast.success("เอาโลโก้ออกแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ตัวอย่างหัวเว็บ */}
      <section className="overflow-hidden bg-white border shadow-sm rounded-xl" aria-label="ตัวอย่างหัวเว็บ">
        <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b">ตัวอย่าง</div>
        <div className="flex items-center gap-2 px-4 text-white h-14" style={{ background: theme.from }}>
          {form.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="object-contain w-8 h-8 bg-white rounded-full" />
          )}
          <span className="hidden font-bold truncate sm:inline">{form.systemName || "ชื่อระบบ"}</span>
          <span className="font-bold truncate sm:hidden">{form.systemShortName || "ชื่อย่อ"}</span>
        </div>
        <div className="flex">
          <div className="w-40 p-3 text-white sm:w-56" style={{ background: `linear-gradient(to right, ${theme.from}, ${theme.to})` }}>
            <div className="font-bold">เมนูด้านข้าง</div>
            <div className="text-xs text-white/80">ทุกบทบาทใช้สีนี้</div>
          </div>
          <div className="flex items-end flex-1 p-3 text-xs text-gray-500 bg-gray-50">{form.footerText || "(ไม่มีข้อความท้ายเมนู)"}</div>
        </div>
      </section>

      <section className="p-4 space-y-4 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">ชื่อและข้อความ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.key === "systemName" || f.key === "approverTitle" ? "md:col-span-2" : ""}`}>
              <Label htmlFor={`g-${f.key}`}>
                {f.label}
                {f.key !== "footerText" && <span className="text-red-500"> *</span>}
              </Label>
              <Input id={`g-${f.key}`} className="h-10" maxLength={f.max} value={form[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} />
              <p className="text-xs text-gray-500">{f.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="p-4 space-y-3 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">สีของระบบ</h2>
        <p className="text-sm text-gray-600">ใช้กับแถบหัวเว็บและแถบเมนูของทุกบทบาท</p>
        <div role="radiogroup" aria-label="สีของระบบ" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
            const t = THEMES[k];
            const active = form.theme === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ theme: k })}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${active ? "border-gray-900 ring-2 ring-gray-900/10" : "border-gray-200 hover:border-gray-400"}`}
              >
                <span className="w-8 h-8 rounded-full shrink-0" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
                <span className="flex-1">{t.label}</span>
                {active && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="p-4 space-y-3 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">โลโก้</h2>
        <p className="text-sm text-gray-600">แสดงที่หัวเว็บ หน้าเข้าสู่ระบบ และหัวใบลาที่พิมพ์ · PNG / JPG / WEBP ไม่เกิน 1MB · บันทึกทันทีที่อัปโหลด</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed rounded-xl bg-gray-50 shrink-0">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="โลโก้ปัจจุบัน" className="object-contain w-20 h-20" />
            ) : (
              <ImagePlus className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
            <Button type="button" variant="outline" className="h-10" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {form.logoUrl ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้"}
            </Button>
            {form.logoUrl && (
              <Button type="button" variant="outline" className="h-10 text-red-600 border-red-300 hover:bg-red-50" onClick={removeLogo} disabled={uploading}>
                <Trash2 className="w-4 h-4" /> เอาออก
              </Button>
            )}
          </div>
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setForm({ ...defaults, logoUrl: form.logoUrl })} />
    </div>
  );
}
