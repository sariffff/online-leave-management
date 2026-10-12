"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectId?: string;
  subjectName?: string;
  onDeleted: () => Promise<void>;
};

export default function DeletesubjectModal({ open, onOpenChange, subjectId, subjectName, onDeleted }: Props) {
  const [submitting, setSubmitting] = React.useState(false);

  async function onDelete() {
    if (!subjectId) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/subjectmanagement/subject", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ลบรายวิชาไม่สำเร็จ");
      await onDeleted();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.message || "ไม่สามารถลบรายวิชาได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogDescription>
            คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชา{" "}
            <span className="font-medium text-red-600">{subjectName || subjectId}</span> ?
            การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>ยกเลิก</Button>
          <Button variant="destructive" onClick={onDelete} disabled={submitting}>
            {submitting ? "กำลังลบ..." : "ลบ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
