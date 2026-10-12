"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fetchsubjects: () => Promise<void>;
};

export default function AddsubjectModal({ open, onOpenChange, fetchsubjects }: Props) {
  const [subject_code, setSubjectCode] = React.useState("");
  const [subject_name, setSubjectName] = React.useState("");
  const [subject_level_id, setSubjectLevelId] = React.useState<string>("");
  const [subject_group_id, setSubjectGroupId] = React.useState<string>("");

  const [submitting, setSubmitting] = React.useState(false);
  const canSubmit = subject_code.trim() && subject_name.trim();

  async function onSubmit() {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/subjectmanagement/subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_code,
          subject_name,
          subject_level_id: subject_level_id ? Number(subject_level_id) : null,
          subject_group_id: subject_group_id ? Number(subject_group_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "เพิ่มรายวิชาไม่สำเร็จ");
      await fetchsubjects();
      onOpenChange(false);
      setSubjectCode(""); setSubjectName(""); setSubjectLevelId(""); setSubjectGroupId("");
    } catch (e: any) {
      alert(e?.message || "ไม่สามารถเพิ่มรายวิชาได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>เพิ่มรายวิชาใหม่</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">รหัสวิชา *</label>
            <Input value={subject_code} onChange={(e) => setSubjectCode(e.target.value)} placeholder="เช่น 111-101" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ชื่อวิชา *</label>
            <Input value={subject_name} onChange={(e) => setSubjectName(e.target.value)} placeholder="เช่น คณิตพื้นฐาน" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">subject_level_id</label>
              <Input value={subject_level_id} onChange={(e) => setSubjectLevelId(e.target.value)} placeholder="ตัวเลข หรือเว้นว่าง" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">subject_group_id</label>
              <Input value={subject_group_id} onChange={(e) => setSubjectGroupId(e.target.value)} placeholder="ตัวเลข หรือเว้นว่าง" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
