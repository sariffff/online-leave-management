"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Subject = {
  subject_id: string;
  subject_name: string;
  subject_group: string; // ชื่อกลุ่ม (แสดงในตาราง)
  subject_level: string; // ชื่อระดับชั้น (แสดงในตาราง)
  // ถ้ามี subject_code/ids ให้เติมมาด้วยได้
  subject_code?: string;
  subject_level_id?: number | null;
  subject_group_id?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: Subject | null;
  fetchsubjects: () => Promise<void>;
};

export default function EditsubjectModal({ open, onOpenChange, subject, fetchsubjects }: Props) {
  const [subject_code, setSubjectCode] = React.useState(subject?.subject_code || "");
  const [subject_name, setSubjectName] = React.useState(subject?.subject_name || "");
  const [subject_level_id, setSubjectLevelId] = React.useState<string>("");
  const [subject_group_id, setSubjectGroupId] = React.useState<string>("");

  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setSubjectCode(subject?.subject_code || "");
    setSubjectName(subject?.subject_name || "");
    setSubjectLevelId(subject?.subject_level_id ? String(subject.subject_level_id) : "");
    setSubjectGroupId(subject?.subject_group_id ? String(subject.subject_group_id) : "");
  }, [subject]);

  async function onSubmit() {
    if (!subject?.subject_id) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/subjectmanagement/subject", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subject.subject_id,
          subject_code,
          subject_name,
          subject_level_id: subject_level_id ? Number(subject_level_id) : null,
          subject_group_id: subject_group_id ? Number(subject_group_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "อัปเดตรายวิชาไม่สำเร็จ");
      await fetchsubjects();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.message || "ไม่สามารถอัปเดตรายวิชาได้");
    } finally {
      setSubmitting(false);
    }
  }

  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขรายวิชา</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">รหัสวิชา</label>
            <Input value={subject_code} onChange={(e) => setSubjectCode(e.target.value)} placeholder="เช่น 111-101" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ชื่อวิชา</label>
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
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
