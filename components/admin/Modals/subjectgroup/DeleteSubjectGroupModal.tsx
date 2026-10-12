"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

export interface SubjectGroupForm {
  subject_group_id?: string | number;
  subject_group_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectGroup?: SubjectGroupForm | null;   // ข้อมูลแถวที่เลือก
  fetchSubjectGroup?: () => void;           // callback ให้พาเรนต์รีเฟรช
}

export default function DeleteSubjectGroupModal({
  open,
  onOpenChange,
  subjectGroup,
  fetchSubjectGroup,
}: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) setLoading(false);
  }, [open]);

  const handleDelete = async () => {
    if (!subjectGroup?.subject_group_id) {
      toast.error("ไม่พบรหัสกลุ่มสาระ");
      return;
    }
    setLoading(true);
    try {
      const id = subjectGroup.subject_group_id;
      const res = await fetch(
        `/api/admin/subjectmanagement/subject-group/${id}`,
        { method: "DELETE", headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ลบกลุ่มสาระไม่สำเร็จ");

      toast.success("ลบกลุ่มสาระเรียบร้อย");
      fetchSubjectGroup?.();   
      onOpenChange(false);     
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "เกิดข้อผิดพลาดในการเรียก API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            ยืนยันการลบกลุ่มสาระ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            ต้องการลบ <span className="font-semibold">
              {subjectGroup?.subject_group_name || "(ไม่ทราบชื่อ)"}
            </span>{" "}
            ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้
          </p>
          <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
            * โปรดตรวจสอบให้แน่ใจก่อนดำเนินการลบ
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            ลบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
