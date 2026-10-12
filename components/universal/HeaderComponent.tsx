// components/HeaderComponent.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import useProfile from "@/hooks/useProfile";
import LogoutButton from "@/components/auth/LogoutButton";

type ProfileForm = {
  prename: string;
  name: string;
  surname: string;
  tel: string;
};

export default function HeaderComponent() {
  // UI state 
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    prename: "",
    name: "",
    surname: "",
    tel: "",
  });

  // Session/profile
  const { userInfo, loading } = useProfile();

  // ชื่อที่แสดง
  const displayName = useMemo(() => {
    if (!userInfo) return "";
    const fn = `${userInfo.prename ?? ""}${userInfo.name ?? ""} ${userInfo.surname ?? ""}`
      .replace(/\s+/g, " ")
      .trim();
    return fn || userInfo.email || "โปรไฟล์";
  }, [userInfo]);

  // เปิดโมดอลโปรไฟล์ + เติมค่าเริ่มต้น
  function openProfile() {
    if (userInfo) {
      setForm({
        prename: userInfo.prename ?? "",
        name: userInfo.name ?? "",
        surname: userInfo.surname ?? "",
        tel: (userInfo as any).tel ?? "",
      });
    }
    setIsEditing(false);
    setProfileOpen(true);
    setDropdownOpen(false);
  }

  // บันทึกโปรไฟล์ผ่าน API ของเรา (ไม่อัปเดต DB ตรง ๆ จาก client)
  async function saveProfile() {
    if (!userInfo) return;
    try {
      setSaving(true);
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prename: form.prename.trim(),
          name: form.name.trim(),
          surname: form.surname.trim(),
          tel: form.tel.trim(),
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.message || "บันทึกไม่สำเร็จ");

      // อัปเดตหน้าจอแบบง่าย ๆ: sync ค่าในหน่วยความจำ
      (userInfo as any).prename = form.prename;
      (userInfo as any).name = form.name;
      (userInfo as any).surname = form.surname;
      (userInfo as any).tel = form.tel;

      setIsEditing(false);
    } catch (e) {
      console.error("[saveProfile] error:", e);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="bg-blue-500 p-4 flex justify-between items-center relative">
      <h1 className="text-lg md:text-xl font-bold text-white">
        ระบบการลาของบุคลากร โรงเรียนบ้านตาสา
      </h1>

      {loading ? (
        <div className="text-white/90">Loading...</div>
      ) : userInfo ? (
        <div className="relative">
          {/* ชื่อผู้ใช้ (เปิด/ปิด dropdown) */}
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="text-white font-medium"
          >
            {displayName}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg p-2">
              <button
                onClick={openProfile}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
              >
                ข้อมูลส่วนตัว
              </button>

              {/* สลับบทบาท: ใช้หน้า select-role + cookie active_role (มาตรฐานระบบ) */}
              <Link
                href="/select-role"
                className="block w-full px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
                onClick={() => setDropdownOpen(false)}
              >
                สลับบทบาท
              </Link>

              <div className="border-t my-1" />

              <div className="px-2 py-1">
                <LogoutButton />
              </div>
            </div>
          )}

          {/* Modal โปรไฟล์ (พื้นฐาน) */}
          {profileOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              aria-modal="true"
              role="dialog"
              onClick={() => setProfileOpen(false)}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div
                className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">ข้อมูลส่วนตัว</h2>
                  <div className="flex gap-2 items-center">
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="border rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        แก้ไข
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="border rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                          disabled={saving}
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={saveProfile}
                          className="bg-blue-600 text-white rounded-md px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-60"
                          disabled={saving}
                        >
                          {saving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setProfileOpen(false)}
                      className="rounded-md px-3 py-1.5 text-sm hover:bg-gray-100"
                      aria-label="ปิด"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* เนื้อหาโปรไฟล์ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {!isEditing ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">ชื่อ–สกุล: </span>
                        {displayName || "-"}
                      </div>
                      <div>
                        <span className="font-medium">อีเมล: </span>
                        {userInfo.email || "-"}
                      </div>
                      {"tel" in userInfo && (
                        <div>
                          <span className="font-medium">เบอร์โทร: </span>
                          {(userInfo as any).tel || "-"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 text-sm">
                      <label className="grid gap-1">
                        <span>คำนำหน้า</span>
                        <input
                          className="w-full border rounded-md p-2"
                          value={form.prename}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, prename: e.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span>ชื่อ</span>
                        <input
                          className="w-full border rounded-md p-2"
                          value={form.name}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, name: e.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span>สกุล</span>
                        <input
                          className="w-full border rounded-md p-2"
                          value={form.surname}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, surname: e.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span>เบอร์โทร</span>
                        <input
                          className="w-full border rounded-md p-2"
                          value={form.tel}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, tel: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
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
