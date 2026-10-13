"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type RoleOption = { id: string; name: string };
type Profile = { email?: string; fullName?: string };

const ROLE_TH: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  user: "บุคลากรทั่วไป (ยื่นใบลา)",
  supervisor: "ฝ่ายธุรการ (ตรวจสอบใบลา)",
  director: "ผู้อำนวยการ (อนุมัติใบลา)",
  academic: "ฝ่ายวิชาการ (จัดสอนแทน)",
};

export default function SelectRole({ roleOptions, profile }: { roleOptions: RoleOption[]; profile?: Profile }) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // มีบทบาทเดียว → เลือกให้อัตโนมัติ
  useEffect(() => {
    if (!selected && roleOptions.length === 1) setSelected(roleOptions[0].id);
  }, [roleOptions, selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return setError("โปรดเลือกสิทธิ์ก่อน");
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch<{ home: string }>("/api/auth/set-role", { method: "POST", json: { roleId: Number(selected) } });
      router.push(res.home || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl p-4 mx-auto mt-8 space-y-8 bg-white rounded-lg shadow sm:p-7">
      <section className="bg-blue-200 border rounded">
        <div className="px-4 py-2 font-semibold">Profile</div>
        <div className="px-4 py-3 space-y-2 bg-white">
          <p><span className="font-medium">ชื่อ - นามสกุล :</span> {profile?.fullName || "-"}</p>
          <p><span className="font-medium">Email :</span> {profile?.email || "-"}</p>
        </div>
      </section>

      <section className="bg-blue-200 border rounded">
        <div className="px-4 py-2 font-semibold">สิทธิ์เข้าใช้งานระบบ</div>
        <div className="px-4 py-4 space-y-4 text-sm bg-white sm:text-base">
          {roleOptions.length === 0 ? (
            <p className="text-red-600">บัญชีนี้ยังไม่ได้รับสิทธิ์ใด ๆ กรุณาติดต่อผู้ดูแลระบบ</p>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="role" className="block mb-1 font-medium">เลือกสิทธิ์เข้าใช้งาน</label>
              <select
                id="role"
                className="w-full px-3 py-2 bg-gray-100 border rounded sm:w-1/2"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={submitting}
              >
                <option value="">-- กรุณาเลือกสิทธิ์ --</option>
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>{ROLE_TH[r.name] ?? r.name}</option>
                ))}
              </select>

              {error && <p className="mt-2 text-red-600">{error}</p>}

              <div className="pt-4 text-center">
                <button
                  type="submit"
                  disabled={submitting || !selected}
                  className="px-6 py-2 font-semibold text-black transition bg-green-300 rounded hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "กำลังตั้งค่า..." : "ดำเนินการต่อ"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
