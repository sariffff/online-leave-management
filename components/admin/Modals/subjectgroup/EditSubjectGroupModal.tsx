"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-hot-toast";

export interface SubjectGroupForm {
  subject_group_id?: string | number;
  subject_group_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectGroup?: SubjectGroupForm | null;
  fetchSubjectGroup?: () => void;
}

export default function EditSubjectGroupModal({
  open,
  onOpenChange,
  subjectGroup,
  fetchSubjectGroup,
}: Props) {
  const [formData, setFormData] = useState<SubjectGroupForm>({
    subject_group_id: undefined,
    subject_group_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && subjectGroup) {
      setFormData({
        subject_group_id: subjectGroup.subject_group_id,
        subject_group_name: subjectGroup.subject_group_name ?? "",
      });
      setErrors({});
    }
  }, [open, subjectGroup]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as {
      name: keyof SubjectGroupForm;
      value: string;
    };
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.subject_group_id)
      newErrors.subject_group_id = "ไม่พบรหัสกลุ่มสาระ";
    if (!formData.subject_group_name?.trim())
      newErrors.subject_group_name = "กรุณากรอกชื่อกลุ่มสาระ";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const id = formData.subject_group_id;
      if (!id) throw new Error("ไม่พบรหัสกลุ่มสาระ");
      const res = await fetch(
        `/api/admin/subjectmanagement/subject-group/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            subject_group_id: formData.subject_group_id,
            subject_group_name: formData.subject_group_name,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "เกิดข้อผิดพลาดในการแก้ไขกลุ่มสาระ");

      toast.success("บันทึกการแก้ไขเรียบร้อย");
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขกลุ่มสาระ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="subject_group_name">
                    ชื่อกลุ่มสาระ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="subject_group_name"
                    name="subject_group_name"
                    value={formData.subject_group_name}
                    onChange={handleInputChange}
                    className={
                      errors.subject_group_name ? "border-red-500" : ""
                    }
                  />
                  {errors.subject_group_name && (
                    <p className="text-xs text-red-500">
                      {errors.subject_group_name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
