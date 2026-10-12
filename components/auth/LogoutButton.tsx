"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);

      // เรียก API ฝั่ง server ให้ลบคุกกี้ + signOut ของ Supabase ให้ครบ
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include", // สำคัญ: ให้แน่ใจว่าคุกกี้ไป-กลับครบ
      });

      // เสร็จแล้วพาไปหน้า login
      window.location.href = "/login";
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการออกจากระบบ: " + (err?.message || "ไม่ทราบสาเหตุ"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleLogout} disabled={loading} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-500 text-sm">
      {loading ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
    </Button>
  );
}
