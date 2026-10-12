"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RoleOption = { id: string; name: string; key?: string };
type Profile = { email?: string; prename?: string; name?: string; surname?: string };

const ROLE_ROUTES: Record<string, string> = {
  "1": "/user-management",     // admin
  "2": "/leave-page",          // user
  "3": "/reviewed-page",           // supervisor
  "4": "/leave-approve",   // director
  "5": "/leavetable",  // academic
};

export default function SelectRole({
  roleOptions,
  profile,
}: {
  roleOptions: RoleOption[];
  profile?: Profile;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ถ้ามี role เดียว auto-select ให้ง่ายขึ้น
  useEffect(() => {
    if (!selectedRole && roleOptions.length === 1) {
      setSelectedRole(roleOptions[0].id);
    }
  }, [roleOptions, selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedRole) {
      setErrorMsg("โปรดเลือกสิทธิ์ก่อน");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/auth/set-role", {
        method: "POST",
        credentials: "include", // ส่ง/รับคุกกี้ให้ครบ
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: Number(selectedRole) }),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || `Set role failed (${res.status})`);
      }

      router.push(ROLE_ROUTES[selectedRole] ?? "/");
    } catch (err: any) {
      setErrorMsg(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 sm:p-7 max-w-7xl mx-auto mt-8 space-y-8">
      {/* Profile */}
      <section className="border rounded bg-blue-200">
        <div className="px-4 py-2 font-semibold">Profile</div>
        <div className="bg-white px-4 py-3 space-y-2">
          <p>
            <span className="font-medium">ชื่อ - นามสกุล :</span>{" "}
            {`${profile?.prename ?? ""}${profile?.name ?? ""} ${profile?.surname ?? ""}`.trim() || "-"}
          </p>
          <p>
            <span className="font-medium">Email :</span> {profile?.email ?? "-"}
          </p>
        </div>
      </section>

      {/* Roles */}
      <section className="border rounded bg-blue-200">
        <div className="px-4 py-2 font-semibold">สิทธิ์เข้าใช้งานระบบ</div>
        <div className="bg-white px-4 py-4 space-y-4 text-sm sm:text-base">
          <form onSubmit={handleSubmit}>
            <p className="font-medium mb-1">เลือกสิทธิ์เข้าใช้งาน</p>
            <select
              className="w-full sm:w-1/2 bg-gray-100 border px-3 py-2 rounded"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              required
              disabled={submitting || roleOptions.length === 0}
            >
              <option value="">-- กรุณาเลือกสิทธิ์ --</option>
              {roleOptions.map((role) => (
                <option key={role.key ?? role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            {errorMsg && <p className="text-red-600 mt-2">{errorMsg}</p>}

            <div className="pt-4 text-center">
              <button
                type="submit"
                className="bg-green-300 hover:bg-green-400 px-6 py-2 rounded text-black font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting || !selectedRole}
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting ? "กำลังตั้งค่า..." : "ดำเนินการต่อ"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
