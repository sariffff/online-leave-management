"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronRight, ClipboardCheck, FileText, GraduationCap, Loader2, ShieldCheck, type LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/client/api";

type RoleOption = { id: string; name: string };
type Profile = { email?: string; fullName?: string };

const ROLE_INFO: Record<string, { title: string; desc: string; icon: LucideIcon; color: string }> = {
  user: { title: "บุคลากร", desc: "ยื่นใบลา ดูประวัติและวันลาคงเหลือ", icon: FileText, color: "bg-blue-100 text-blue-700" },
  supervisor: { title: "ฝ่ายธุรการ", desc: "ตรวจสอบใบลา (ผ่าน / ไม่ผ่าน)", icon: ClipboardCheck, color: "bg-amber-100 text-amber-700" },
  director: { title: "ผู้อำนวยการ", desc: "อนุมัติใบลา ดูสถิติ", icon: CalendarCheck, color: "bg-emerald-100 text-emerald-700" },
  academic: { title: "ฝ่ายวิชาการ", desc: "จัดครูสอนแทน ดูตารางสอน", icon: GraduationCap, color: "bg-indigo-100 text-indigo-700" },
  admin: { title: "ผู้ดูแลระบบ", desc: "จัดการบุคลากร ข้อมูลหลัก ตารางสอน วันหยุด", icon: ShieldCheck, color: "bg-purple-100 text-purple-700" },
};

/** เลือกบทบาทที่จะใช้งาน — กดการ์ดแล้วไปต่อทันที (มีบทบาทเดียวจะไปต่อให้อัตโนมัติ) */
export default function SelectRole({ roleOptions, profile }: { roleOptions: RoleOption[]; profile?: Profile }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const auto = useRef(false);

  async function choose(id: string) {
    setError("");
    setSubmitting(id);
    try {
      const res = await apiFetch<{ home: string }>("/api/auth/set-role", { method: "POST", json: { roleId: Number(id) } });
      router.push(res.home || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setSubmitting(null);
    }
  }

  useEffect(() => {
    if (!auto.current && roleOptions.length === 1) {
      auto.current = true;
      choose(roleOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleOptions]);

  return (
    <div className="w-full max-w-2xl px-4 py-6 mx-auto space-y-6 sm:py-10">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">เลือกบทบาทเพื่อเข้าใช้งาน</h1>
        <p className="mt-1 text-sm text-gray-600">
          {profile?.fullName || "-"}
          {profile?.email ? <span className="block text-gray-500 break-all">{profile.email}</span> : null}
        </p>
      </div>

      {roleOptions.length === 0 ? (
        <p className="p-4 text-center text-red-700 border border-red-200 rounded-xl bg-red-50">
          บัญชีนี้ยังไม่ได้รับสิทธิ์ใด ๆ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {roleOptions.map((r) => {
            const info = ROLE_INFO[r.name] ?? { title: r.name, desc: "", icon: FileText, color: "bg-gray-100 text-gray-700" };
            const Icon = info.icon;
            const busy = submitting === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => choose(r.id)}
                  disabled={!!submitting}
                  className="flex items-center w-full gap-4 p-4 text-left transition bg-white border border-gray-200 shadow-sm rounded-xl hover:border-blue-400 hover:shadow-md disabled:opacity-60"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${info.color}`}>
                    <Icon className="w-6 h-6" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900">{info.title}</span>
                    <span className="block text-sm text-gray-600">{info.desc}</span>
                  </span>
                  {busy ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-center text-red-600">{error}</p>}
    </div>
  );
}
