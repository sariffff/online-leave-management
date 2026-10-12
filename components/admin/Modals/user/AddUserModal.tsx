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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { toE164 } from "@/utils/phone";
import toast from "react-hot-toast";

// Shadcn Select
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface RoleType {
  role_type_id: number;
  role_name: string;
}

interface SubjectGroup {
  subject_group_id: string | number; // API อาจส่งมาเป็น string; เดี๋ยวค่อยแปลงตอน submit
  subject_group_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchUsers?: () => void;
}

export default function AddUserModal({ open, onOpenChange, fetchUsers }: Props) {
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    prename: "",
    name: "",
    surname: "",
    email: "",
    tel: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ------ Teacher extra ------
  const [isTeacher, setIsTeacher] = useState(false);
  const NONE = "__NONE__";
  const [subjectGroupId, setSubjectGroupId] = useState<string | undefined>(undefined);

  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [loadingSubjectGroup, setLoadingSubjectGroup] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRoles();
      fetchSubjectGroups();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setFormData({
      prename: "",
      name: "",
      surname: "",
      email: "",
      tel: "",
      password: "",
      confirmPassword: "",
    });
    setSelectedRoles([]);
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);

    setIsTeacher(false);
    setSubjectGroupId(undefined);
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/role-type", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch roles");
      setRoles(data.roles || []);
    } catch (err: any) {
      console.error("Error fetching roles:", err);
      setRoles([]);
    }
  };

  const fetchSubjectGroups = async () => {
    setLoadingSubjectGroup(true);
    try {
      const res = await fetch("/api/admin/subjectmanagement/subject-group", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch subject groups");
      setSubjectGroups(Array.isArray(data.subjectGroups) ? data.subjectGroups : []);
    } catch (err: any) {
      console.error("Error fetching subject groups:", err);
      setSubjectGroups([]);
    } finally {
      setLoadingSubjectGroup(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "password" || name === "confirmPassword") {
      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
  };

  const handleRoleChange = (roleId: number, checked: boolean) => {
    setSelectedRoles((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId)
    );
    if (errors.roles) setErrors((prev) => ({ ...prev, roles: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "กรุณากรอกชื่อ";
    if (!formData.surname.trim()) newErrors.surname = "กรุณากรอกนามสกุล";
    if (!formData.email.trim()) newErrors.email = "กรุณากรอกอีเมล";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      newErrors.email = "รูปแบบอีเมลไม่ถูกต้อง (user@example.com)";
    if (!formData.password.trim()) newErrors.password = "กรุณากรอกรหัสผ่าน";
    else if (formData.password.length < 6)
      newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    if (selectedRoles.length === 0) newErrors.roles = "กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const phoneE164 = toE164(formData.tel);

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      // ส่งเป็น number หรือ null เท่านั้น (ไม่ห่อเป็น object)
      const subject_group_id: number | null =
        isTeacher
          ? (subjectGroupId && subjectGroupId !== NONE ? Number(subjectGroupId) : null)
          : null;

      const res = await fetch("/api/admin/usermanagement/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prename: formData.prename.trim(),
          name: formData.name.trim(),
          surname: formData.surname.trim(),
          email: formData.email.trim().toLowerCase(),
          tel: phoneE164,
          password: formData.password,
          role: selectedRoles,            // number[]
          subject_group_id,               // number | null
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");

      toast("เพิ่มผู้ใช้เรียบร้อยแล้ว");
      fetchUsers?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast(err.message || "เกิดข้อผิดพลาดในการเรียก API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> เพิ่มผู้ใช้ใหม่
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Personal Info */}
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="prename">คำนำหน้า</Label>
                  <Input id="prename" name="prename" value={formData.prename} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="name">
                    ชื่อ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="surname">
                    นามสกุล <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="surname"
                    name="surname"
                    value={formData.surname}
                    onChange={handleInputChange}
                    className={errors.surname ? "border-red-500" : ""}
                  />
                  {errors.surname && <p className="text-xs text-red-500">{errors.surname}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  อีเมล <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tel">เบอร์โทรศัพท์</Label>
                <Input id="tel" name="tel" value={formData.tel} onChange={handleInputChange} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Password */}
                <div className="relative">
                  <Label htmlFor="password">
                    รหัสผ่าน <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <Label htmlFor="confirmPassword">
                    ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Roles */}
          <Card>
            <CardContent className="space-y-4">
              <Label>
                บทบาท <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2 overflow-y-auto max-h-40">
                {roles.length === 0 ? (
                  <p className="py-4 text-center text-gray-500">ไม่มีบทบาทให้เลือก</p>
                ) : (
                  roles.map((role) => (
                    <div key={role.role_type_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.role_type_id}`}
                        checked={selectedRoles.includes(role.role_type_id)}
                        onCheckedChange={(c) => handleRoleChange(role.role_type_id, c as boolean)}
                      />
                      <Label htmlFor={`role-${role.role_type_id}`} className="cursor-pointer">
                        {role.role_name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {errors.roles && <p className="text-xs text-red-500">{errors.roles}</p>}
            </CardContent>
          </Card>

          {/* Teacher Profile (optional) */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isTeacher"
                    checked={isTeacher}
                    onCheckedChange={(c) => setIsTeacher(Boolean(c))}
                  />
                  <Label htmlFor="isTeacher" className="cursor-pointer font-medium">
                    ตั้งเป็นครู (สร้างโปรไฟล์ครู)
                  </Label>
                </div>
                <span className="text-xs text-gray-500">
                  ใช้กับตารางสอน/สอนแทน ไม่เกี่ยวกับสิทธิ์บทบาท
                </span>
              </div>

              {isTeacher && (
                <div className="space-y-1">
                  <Label>กลุ่มสาระ</Label>
                  <Select
                    value={subjectGroupId}
                    onValueChange={(v) => setSubjectGroupId(v === NONE ? undefined : v)}
                    disabled={loadingSubjectGroup || subjectGroups.length === 0}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={loadingSubjectGroup ? "กำลังโหลด..." : "เลือกกลุ่มสาระ (ไม่บังคับ)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                      {subjectGroups.map((sg) => (
                        <SelectItem
                          key={String(sg.subject_group_id)}
                          value={String(sg.subject_group_id)}  // เก็บเป็น string ใน state
                        >
                          {sg.subject_group_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!loadingSubjectGroup && subjectGroups.length === 0 && (
                    <p className="text-xs text-amber-600">
                      ยังไม่มีกลุ่มสาระในระบบ — เพิ่มข้อมูลในตาราง subjectgroup ก่อน
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
