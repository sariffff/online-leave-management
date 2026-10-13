"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";

const SECTIONS = [
  { key: "general", label: "ทั่วไป", hint: "ชื่อระบบ ชื่อโรงเรียน ตำแหน่งผู้อนุมัติ สี และเอาโลโก้ออก" },
  { key: "leaveTypes", label: "กฎประเภทการลา", hint: "คำอธิบาย สี ลำดับ กฎการลา และเปิดใช้งานทุกประเภท (ไม่ลบประเภทที่เพิ่มเอง ไม่แก้วันลาต่อปี)" },
  { key: "periods", label: "คาบเรียน", hint: "6 คาบ เวลาเดิม (เวลาในตารางสอนที่บันทึกไว้แล้วไม่เปลี่ยน)" },
  { key: "attachments", label: "ไฟล์แนบ", hint: "ไม่เกิน 5MB, 5 ไฟล์, PDF/JPG/PNG — ปรับขีดจำกัดของที่เก็บไฟล์ใบลาตามด้วย" },
] as const;

/** คืนค่าเริ่มต้น (factory reset) ตามหมวดที่เลือก — ทุกหมวดบันทึกในประวัติและย้อนกลับได้ */
export default function FactoryResetButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(SECTIONS.map((s) => s.key));
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function run() {
    setBusy(true);
    try {
      const r = await apiFetch<{ sections: string[] }>("/api/admin/settings/reset", { method: "POST", json: { sections: picked } });
      toast.success(r.sections.length ? `คืนค่าเริ่มต้นแล้ว ${r.sections.length} หมวด` : "ทุกหมวดที่เลือกเป็นค่าเริ่มต้นอยู่แล้ว");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "คืนค่าเริ่มต้นไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="h-10 text-red-700 border-red-200 hover:bg-red-50" onClick={() => setOpen(true)}>
        <RotateCcw className="w-4 h-4" /> คืนค่าเริ่มต้นทั้งระบบ
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>คืนค่าเริ่มต้น</DialogTitle>
            <DialogDescription>เลือกหมวดที่ต้องการกลับไปใช้ค่าตั้งต้นของระบบ — ถ้าเปลี่ยนใจ ย้อนกลับได้จากหมวด &ldquo;ประวัติการแก้ไข&rdquo;</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <label className="flex gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 shrink-0" checked={picked.includes(s.key)} onChange={() => toggle(s.key)} />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{s.label}</span>
                    <span className="block text-xs text-gray-500">{s.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</Button>
            <Button onClick={run} disabled={busy || picked.length === 0} className="text-white bg-red-600 hover:bg-red-700">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} คืนค่าเริ่มต้น {picked.length} หมวด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
