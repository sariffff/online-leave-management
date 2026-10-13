"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/client/api";

export type AdminUser = {
  user_id: string;
  prename: string | null;
  name: string;
  surname: string;
  email: string | null;
  tel: string | null;
  is_active: boolean;
  is_teacher: boolean;
  subject_group_id: number | null;
  roles: { role_type_id: number; role_name: string }[];
};

type Role = { role_type_id: number; role_name: string };
type Group = { subject_group_id: number; subject_group_name: string };

const ROLE_TH: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  user: "บุคลากรทั่วไป",
  supervisor: "ฝ่ายธุรการ (ตรวจสอบ)",
  director: "ผู้อำนวยการ",
  academic: "ฝ่ายวิชาการ",
};

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/** เพิ่ม/แก้ไขผู้ใช้ — ใช้ฟอร์มเดียว (เดิมแยก AddUserModal + EditUserModal) */
export default function UserFormModal({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = เพิ่มผู้ใช้ใหม่ */
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!user;
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({ prename: "", name: "", surname: "", email: "", tel: "", password: "", confirm: "", is_active: true });
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([apiFetch<{ roles: Role[] }>("/api/admin/role-type"), apiFetch<{ items: Group[] }>("/api/admin/subjectmanagement/subject-group")])
      .then(([r, g]) => {
        setRoles(r.roles);
        setGroups(g.items);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setShowPw(false);
    setF({
      prename: user?.prename ?? "",
      name: user?.name ?? "",
      surname: user?.surname ?? "",
      email: user?.email ?? "",
      tel: user?.tel ?? "",
      password: "",
      confirm: "",
      is_active: user?.is_active ?? true,
    });
    setSelectedRoles(user?.roles.map((r) => r.role_type_id) ?? []);
    setIsTeacher(user?.is_teacher ?? false);
    setGroupId(user?.subject_group_id ? String(user.subject_group_id) : "");
  }, [open, user]);

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  function validate() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "กรุณากรอกชื่อ";
    if (!f.surname.trim()) e.surname = "กรุณากรอกนามสกุล";
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "รูปแบบอีเมลไม่ถูกต้อง";
      if (f.password.length < 6) e.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
      if (f.password !== f.confirm) e.confirm = "รหัสผ่านไม่ตรงกัน";
    }
    if (selectedRoles.length === 0) e.roles = "กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const common = {
        prename: f.prename.trim(),
        name: f.name.trim(),
        surname: f.surname.trim(),
        tel: f.tel.trim(),
        is_teacher: isTeacher,
        subject_group_id: isTeacher && groupId ? Number(groupId) : null,
      };
      if (editing) {
        await apiFetch("/api/admin/usermanagement/edit-user", {
          method: "PUT",
          json: { ...common, user_id: user.user_id, is_active: f.is_active, roles: selectedRoles },
        });
      } else {
        await apiFetch("/api/admin/usermanagement/create-user", {
          method: "POST",
          json: { ...common, email: f.email.trim().toLowerCase(), password: f.password, role: selectedRoles },
        });
      }
      toast.success(editing ? "บันทึกเรียบร้อย" : "เพิ่มผู้ใช้เรียบร้อยแล้ว");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs text-red-500">{errors[k]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="prename">คำนำหน้า</Label>
              <Input id="prename" value={f.prename} onChange={(e) => set({ prename: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="name">ชื่อ <span className="text-red-500">*</span></Label>
              <Input id="name" value={f.name} onChange={(e) => set({ name: e.target.value })} className={errors.name ? "border-red-500" : ""} />
              {err("name")}
            </div>
            <div>
              <Label htmlFor="surname">นามสกุล <span className="text-red-500">*</span></Label>
              <Input id="surname" value={f.surname} onChange={(e) => set({ surname: e.target.value })} className={errors.surname ? "border-red-500" : ""} />
              {err("surname")}
            </div>
          </div>

          <div>
            <Label htmlFor="email">อีเมล {!editing && <span className="text-red-500">*</span>}</Label>
            <Input id="email" type="email" value={f.email} disabled={editing} onChange={(e) => set({ email: e.target.value })} className={errors.email ? "border-red-500" : ""} />
            {err("email")}
          </div>

          <div>
            <Label htmlFor="tel">เบอร์โทรศัพท์</Label>
            <Input id="tel" value={f.tel} onChange={(e) => set({ tel: e.target.value })} placeholder="0812345678" />
          </div>

          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Label htmlFor="password">รหัสผ่าน <span className="text-red-500">*</span></Label>
                <Input id="password" type={showPw ? "text" : "password"} value={f.password} onChange={(e) => set({ password: e.target.value })} className={`pr-10 ${errors.password ? "border-red-500" : ""}`} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 px-2 top-6" onClick={() => setShowPw((v) => !v)} aria-label="แสดง/ซ่อนรหัสผ่าน">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                {err("password")}
              </div>
              <div>
                <Label htmlFor="confirm">ยืนยันรหัสผ่าน <span className="text-red-500">*</span></Label>
                <Input id="confirm" type={showPw ? "text" : "password"} value={f.confirm} onChange={(e) => set({ confirm: e.target.value })} className={errors.confirm ? "border-red-500" : ""} />
                {err("confirm")}
              </div>
            </div>
          )}

          <div className="p-3 space-y-2 border rounded-lg">
            <Label>บทบาท <span className="text-red-500">*</span></Label>
            {roles.map((r) => (
              <div key={r.role_type_id} className="flex items-center gap-2">
                <Checkbox
                  id={`role-${r.role_type_id}`}
                  checked={selectedRoles.includes(r.role_type_id)}
                  onCheckedChange={(c) => setSelectedRoles((p) => (c ? [...p, r.role_type_id] : p.filter((x) => x !== r.role_type_id)))}
                />
                <Label htmlFor={`role-${r.role_type_id}`} className="cursor-pointer">
                  {ROLE_TH[r.role_name] ?? r.role_name}
                </Label>
              </div>
            ))}
            {err("roles")}
          </div>

          <div className="p-3 space-y-2 border rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox id="isTeacher" checked={isTeacher} onCheckedChange={(c) => setIsTeacher(c === true)} />
              <Label htmlFor="isTeacher" className="cursor-pointer">เป็นครู (มีตารางสอน / เป็นครูสอนแทนได้)</Label>
            </div>
            {isTeacher && (
              <select className={selectCls} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">— ไม่ระบุกลุ่มสาระ —</option>
                {groups.map((g) => (
                  <option key={g.subject_group_id} value={g.subject_group_id}>{g.subject_group_name}</option>
                ))}
              </select>
            )}
          </div>

          {editing && (
            <div className="flex items-center gap-2">
              <Checkbox id="active" checked={f.is_active} onCheckedChange={(c) => set({ is_active: c === true })} />
              <Label htmlFor="active" className="cursor-pointer">เปิดใช้งานบัญชี</Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
