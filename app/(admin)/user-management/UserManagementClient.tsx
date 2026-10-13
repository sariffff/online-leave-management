"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import Pagination from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserFormModal, { type AdminUser } from "@/components/admin/Modals/user/UserFormModal";
import UserActionModal, { type UserAction } from "@/components/admin/Modals/user/UserActionModal";
import { apiFetch } from "@/lib/client/api";
import { fullName } from "@/lib/format";

const PAGE_SIZE = 10;

export default function UserManagementClient({ initialUsers }: { initialUsers?: AdminUser[] }) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(!initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<{ user: AdminUser | null } | null>(null);
  const [action, setAction] = useState<{ type: UserAction; user: AdminUser } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers((await apiFetch<{ users: AdminUser[] }>("/api/admin/usermanagement/get-user")).users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  // มีรายชื่อจากเซิร์ฟเวอร์แล้ว → ไม่ต้องโหลดตอนเปิดหน้า (โหลดซ้ำเฉพาะหลังเพิ่ม/แก้ไข/ลบ)
  useEffect(() => {
    if (!initialUsers) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleNames = useMemo(() => [...new Set(users.flatMap((u) => u.roles.map((r) => r.role_name)))], [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q || `${fullName(u)} ${u.email ?? ""}`.toLowerCase().includes(q)) && (role === "all" || u.roles.some((r) => r.role_name === role))
    );
  }, [users, search, role]);

  useEffect(() => setPage(1), [search, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6">
          <div className="flex flex-col items-start justify-between gap-3 mb-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-bold sm:text-xl">บุคลากรทั้งหมด ({filtered.length})</h2>
            <Button onClick={() => setForm({ user: null })} className="text-white bg-purple-600 hover:bg-purple-700">
              + เพิ่มบุคลากร
            </Button>
          </div>

          <div className="flex flex-col gap-3 mb-4 sm:flex-row">
            <Input placeholder="ค้นหาชื่อ-สกุล หรือ อีเมล..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-1/2" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 px-3 text-sm bg-white border rounded-md sm:w-1/4">
              <option value="all">ทุกบทบาท</option>
              {roleNames.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>

          <div className="mb-8 overflow-hidden bg-white shadow-sm rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr className="text-gray-500 uppercase">
                    {["ลำดับ", "ชื่อ - สกุล", "อีเมล", "เบอร์โทร", "บทบาท", "สถานะ", "การจัดการ"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-[11px] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>
                    ))
                  ) : error ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-red-600">{error}</td></tr>
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">ไม่พบข้อมูลตามเงื่อนไข</td></tr>
                  ) : (
                    visible.map((u, i) => (
                      <tr key={u.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{start + i + 1}</td>
                        <td className="px-4 py-2">
                          {fullName(u)}
                          {u.is_teacher && <span className="ml-2 text-[11px] text-indigo-600">(ครู)</span>}
                        </td>
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2">{u.tel || "-"}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span key={r.role_type_id} className="rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[11px]">{r.role_name}</span>
                            ))}
                            {u.roles.length === 0 && <span className="text-gray-400">ไม่ระบุ</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${u.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                            {u.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]" onClick={() => setForm({ user: u })}>แก้ไข</Button>
                            {u.is_active ? (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[12px] text-yellow-700 border-yellow-300 hover:bg-yellow-50" onClick={() => setAction({ type: "deactivate", user: u })}>
                                ปิดใช้งาน
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[12px] text-green-700 border-green-300 hover:bg-green-50" onClick={() => setAction({ type: "reactivate", user: u })}>
                                  เปิดใช้งาน
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[12px] text-red-600 border-red-300 hover:bg-red-50" onClick={() => setAction({ type: "delete", user: u })}>
                                  ลบ
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} total={filtered.length} />
          </div>
        </div>
      </div>

      <UserFormModal open={!!form} user={form?.user ?? null} onClose={() => setForm(null)} onSaved={load} />
      <UserActionModal
        action={action?.type ?? null}
        userId={action?.user.user_id}
        userName={action ? fullName(action.user) : ""}
        onClose={() => setAction(null)}
        onDone={load}
      />
    </div>
  );
}
