"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export interface Role {
  role_type_id: number;
  role_name: string;
}

export interface User {
  user_id: string;
  prename?: string;
  name: string;
  surname: string;
  email: string;
  tel?: string;
  is_active: boolean;
  roles: Role[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  fetchUsers?: () => void;
}

export default function EditUserModal({ open, onOpenChange, user, fetchUsers }: Props) {
  const [formData, setFormData] = useState({
    prename: "",
    name: "",
    surname: "",
    email: "",
    tel: "",
    is_active: true,
  });
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ดึงบทบาททั้งหมดจาก API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/admin/role-type");
        const data = await res.json();
        setAllRoles(data.roles || []);
      } catch (err) {
        setAllRoles([]);
      }
    };
    fetchRoles();
  }, []);

  // เซ็ต formData + selectedRoles เมื่อ user เปลี่ยน
  useEffect(() => {
    if (user) {
      setFormData({
        prename: user.prename ?? "",
        name: user.name,
        surname: user.surname,
        email: user.email,
        tel: user.tel ?? "",
        is_active: user.is_active,
      });
      setSelectedRoles(user.roles.map((r) => r.role_type_id));
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
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
    if (selectedRoles.length === 0) newErrors.roles = "กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usermanagement/edit-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, user_id: user.user_id, roles: selectedRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      fetchUsers?.();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "บันทึกไม่สำเร็จ");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="prename">คำนำหน้า</Label>
                  <Input name="prename" value={formData.prename} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="name">ชื่อ</Label>
                  <Input name="name" value={formData.name} onChange={handleInputChange} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="surname">นามสกุล</Label>
                  <Input name="surname" value={formData.surname} onChange={handleInputChange} />
                  {errors.surname && <p className="text-xs text-red-500">{errors.surname}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Label>บทบาท</Label>
              <div className="space-y-2">
                {allRoles.map((role) => (
                  <div key={role.role_type_id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedRoles.includes(role.role_type_id)}
                      onCheckedChange={(c) => handleRoleChange(role.role_type_id, c as boolean)}
                    />
                    <Label>{role.role_name}</Label>
                  </div>
                ))}
              </div>
              {errors.roles && <p className="text-xs text-red-500">{errors.roles}</p>}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
