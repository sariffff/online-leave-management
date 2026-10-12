import { useEffect, useState } from "react";
import { toE164 } from "@/utils/phone";
import { createUser, getRoles } from "@/services/admin/userService";

interface RoleType {
  role_type_id: number;
  role_name: string;
}

export default function useAddUser({ onOpenChange, fetchUsers, open }: any) {
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    prename: "", name: "", surname: "", email: "", tel: "", password: "", confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadRoles();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setFormData({ prename: "", name: "", surname: "", email: "", tel: "", password: "", confirmPassword: "" });
    setSelectedRoles([]);
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const loadRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data || []);
    } catch (err) {
      console.error("Error fetching roles:", err);
      setRoles([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRoleChange = (roleId: number, checked: boolean) => {
    setSelectedRoles((prev) => checked ? [...prev, roleId] : prev.filter((id) => id !== roleId));
    if (errors.roles) setErrors((prev) => ({ ...prev, roles: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "กรุณากรอกชื่อ";
    if (!formData.surname.trim()) newErrors.surname = "กรุณากรอกนามสกุล";
    if (!formData.email.trim()) newErrors.email = "กรุณากรอกอีเมล";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) newErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!formData.password.trim()) newErrors.password = "กรุณากรอกรหัสผ่าน";
    else if (formData.password.length < 6) newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    if (selectedRoles.length === 0) newErrors.roles = "กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const phoneE164 = toE164(formData.tel);
      await createUser({
        ...formData,
        email: formData.email.trim().toLowerCase(),
        tel: phoneE164,
        role: selectedRoles,
      });
      alert("เพิ่มผู้ใช้เรียบร้อยแล้ว");
      fetchUsers?.();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return {
    roles, selectedRoles, formData, errors, loading,
    showPassword, showConfirmPassword, setShowPassword, setShowConfirmPassword,
    handleInputChange, handleRoleChange, handleSubmit,
  };
}
