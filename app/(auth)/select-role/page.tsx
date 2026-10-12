import "server-only";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/guard";
import SelectRole from "@/components/universal/select-role";

export const metadata: Metadata = {
  title: "เลือกสิทธิ์เข้าใช้งาน",
  robots: { index: false },
};

export default async function SelectRolePage() {
  // ใช้ guard ฝั่งเซิร์ฟเวอร์
  const g = await requireAuth();
  if (!g.ok) redirect("/login");

  // map roles จาก guard -> props สำหรับ client
  const roleOptions = g.roles.map((r) => ({
    id: String(r.id),
    name: r.name,
    key: String(r.id),
  }));

  // ถ้าต้องการชื่อ-นามสกุลจริง ให้ดึงเพิ่มใน guard; ตอนนี้แสดงอีเมลไว้ก่อน
  const profile = { email: g.user.email ?? "" };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="p-4">
        {/* ส่งข้อมูลที่จำเป็นลง client */}
        <SelectRole roleOptions={roleOptions} profile={profile} />
      </div>
    </main>
  );
}
