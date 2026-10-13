"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client/api";
import { SaveBar, useUnsavedWarning } from "@/components/admin/settings/GeneralTab";
import {
  FILE_KINDS,
  MAX_ATTACHMENT_MB,
  SettingsError,
  describeAttachments,
  validateAttachments,
  type AttachmentSettings,
  type FileKind,
} from "@/lib/settings-schema";

type Props = {
  value: AttachmentSettings;
  defaults: AttachmentSettings;
  onDirty: (dirty: boolean) => void;
  onSaved: (value: AttachmentSettings) => void;
};

/** ตรวจด้วยกฎเดียวกับระบบหลังบ้าน */
function problemOf(form: AttachmentSettings): string | null {
  try {
    validateAttachments(form, form);
    return null;
  } catch (e) {
    return e instanceof SettingsError ? e.message : "ข้อมูลไม่ถูกต้อง";
  }
}

export default function AttachmentsTab({ value, defaults, onDirty, onSaved }: Props) {
  const [form, setForm] = useState<AttachmentSettings>(value);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(value), [form, value]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useUnsavedWarning(dirty);
  const problem = useMemo(() => problemOf(form), [form]);

  const toggleKind = (k: FileKind) =>
    setForm((f) => ({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : (Object.keys(FILE_KINDS) as FileKind[]).filter((x) => x === k || f.kinds.includes(x)) }));

  async function save() {
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const r = await apiFetch<{ value: AttachmentSettings; bucketUpdated: boolean }>("/api/admin/settings/attachments", { method: "PUT", json: form });
      setForm(r.value);
      onSaved(r.value);
      if (r.bucketUpdated) toast.success("บันทึกการตั้งค่าไฟล์แนบแล้ว");
      else toast("บันทึกแล้ว แต่ปรับขีดจำกัดของที่เก็บไฟล์ไม่สำเร็จ — ระบบยังตรวจไฟล์ตามค่าใหม่ทุกครั้งที่อัปโหลด", { icon: "⚠️", duration: 8000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="p-4 space-y-4 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">ขนาดและจำนวน</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="maxFileMB">ขนาดไฟล์สูงสุด (MB ต่อไฟล์)</Label>
            <Input
              id="maxFileMB"
              type="number"
              inputMode="decimal"
              min={1}
              max={MAX_ATTACHMENT_MB}
              step={0.5}
              className="h-10"
              value={Number.isFinite(form.maxFileMB) ? form.maxFileMB : ""}
              onChange={(e) => setForm((f) => ({ ...f, maxFileMB: e.target.value === "" ? NaN : Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-500">1–{MAX_ATTACHMENT_MB} MB</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxFiles">จำนวนไฟล์สูงสุดต่อใบลา</Label>
            <Input
              id="maxFiles"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              className="h-10"
              value={Number.isFinite(form.maxFiles) ? form.maxFiles : ""}
              onChange={(e) => setForm((f) => ({ ...f, maxFiles: e.target.value === "" ? NaN : Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-500">1–10 ไฟล์</p>
          </div>
        </div>
      </section>

      <section className="p-4 space-y-3 bg-white border shadow-sm sm:p-6 rounded-xl">
        <h2 className="font-semibold text-gray-900">ชนิดไฟล์ที่รับ</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(FILE_KINDS) as FileKind[]).map((k) => (
            <label key={k} className="flex items-center gap-2 p-3 text-sm border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" className="w-4 h-4" checked={form.kinds.includes(k)} onChange={() => toggleKind(k)} />
              {FILE_KINDS[k].label}
            </label>
          ))}
        </div>
      </section>

      <section className="p-4 text-sm text-blue-900 border border-blue-200 rounded-xl bg-blue-50">
        <span className="font-medium">ผู้ยื่นลาจะเห็น:</span> {problem ? "—" : describeAttachments(form)}
        <p className="mt-1 text-xs text-blue-800">ไฟล์ที่แนบไว้แล้วในใบลาเดิมไม่ได้รับผลกระทบ</p>
      </section>
      {problem && <p className="text-sm text-red-600" role="alert">{problem}</p>}

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setForm(defaults)} />
    </div>
  );
}
