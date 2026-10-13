"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import LogoutButton from "@/components/auth/LogoutButton";
import { apiFetch } from "@/lib/client/api";
import { fullName } from "@/lib/format";

type Me = { email: string | null; prename: string; name: string; surname: string; tel?: string };
type InitialMe = { email: string | null; prename: string; name: string; surname: string } | null;
type Form = { prename: string; name: string; surname: string; tel: string };

export default function HeaderComponent({ initialMe }: { initialMe: InitialMe }) {
  const [me, setMe] = useState<Me | null>(initialMe);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>({ prename: "", name: "", surname: "", tel: "" });

  // layout ฝั่งเซิร์ฟเวอร์ render ใหม่ (เช่น หลัง login/เปลี่ยนบทบาท) → ใช้ข้อมูลล่าสุด
  useEffect(() => setMe(initialMe), [initialMe]);

  const displayName = me ? fullName(me) || me.email || "โปรไฟล์" : "";

  async function openProfile() {
    setIsEditing(false);
    setProfileOpen(true);
    setDropdownOpen(false);
    if (!me) return;
    setForm({ prename: me.prename, name: me.name, surname: me.surname, tel: me.tel ?? "" });
    // เบอร์โทรอยู่ใน Supabase Auth — โหลดเฉพาะตอนเปิดหน้าข้อมูลส่วนตัว
    if (me.tel === undefined) {
      try {
        const full = await apiFetch<Me>("/api/me");
        setMe((m) => (m ? { ...m, tel: full.tel ?? "" } : m));
        setForm((f) => ({ ...f, tel: full.tel ?? "" }));
      } catch {
        /* แสดงเบอร์ว่างไว้ */
      }
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await apiFetch("/api/me", { method: "PATCH", json: form });
      setMe((m) => (m ? { ...m, ...form } : m));
      setIsEditing(false);
      toast.success("บันทึกเรียบร้อย");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Form, label: string) => (
    <label className="grid gap-1">
      <span>{label}</span>
      <input className="w-full p-2 border rounded-md" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </label>
  );

  return (
    <header className="relative flex items-center justify-between p-4 bg-blue-500">
      <h1 className="text-lg font-bold text-white md:text-xl">ระบบการลาของบุคลากร โรงเรียนบ้านตาสา</h1>

      {me ? (
        <div className="relative">
          <button onClick={() => setDropdownOpen((v) => !v)} className="font-medium text-white">
            {displayName}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 z-50 w-64 p-2 mt-2 bg-white shadow-lg rounded-xl">
              <button onClick={openProfile} className="w-full px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100">
                ข้อมูลส่วนตัว
              </button>
              <Link href="/select-role" className="block w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100" onClick={() => setDropdownOpen(false)}>
                สลับบทบาท
              </Link>
              <div className="my-1 border-t" />
              <div className="px-2 py-1">
                <LogoutButton />
              </div>
            </div>
          )}

          {profileOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onClick={() => setProfileOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative w-full max-w-xl p-6 bg-white shadow-2xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">ข้อมูลส่วนตัว</h2>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="border rounded-md px-3 py-1.5 text-sm hover:bg-gray-50">
                        แก้ไข
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setIsEditing(false)} disabled={saving} className="border rounded-md px-3 py-1.5 text-sm hover:bg-gray-50">
                          ยกเลิก
                        </button>
                        <button onClick={saveProfile} disabled={saving} className="bg-blue-600 text-white rounded-md px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-60">
                          {saving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                      </>
                    )}
                    <button onClick={() => setProfileOpen(false)} className="rounded-md px-3 py-1.5 text-sm hover:bg-gray-100" aria-label="ปิด">
                      ✕
                    </button>
                  </div>
                </div>

                {!isEditing ? (
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">ชื่อ–สกุล: </span>{displayName || "-"}</div>
                    <div><span className="font-medium">อีเมล: </span>{me.email || "-"}</div>
                    <div><span className="font-medium">เบอร์โทร: </span>{me.tel || "-"}</div>
                  </div>
                ) : (
                  <div className="grid gap-3 text-sm">
                    {field("prename", "คำนำหน้า")}
                    {field("name", "ชื่อ")}
                    {field("surname", "สกุล")}
                    {field("tel", "เบอร์โทร")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <a href="/login" className="text-white underline">
          ไม่ได้เข้าสู่ระบบ
        </a>
      )}
    </header>
  );
}
