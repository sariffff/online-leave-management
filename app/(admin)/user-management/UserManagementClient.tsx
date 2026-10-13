"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserFormModal, { type AdminUser } from "@/components/admin/Modals/user/UserFormModal";
import UserActionModal, { type UserAction } from "@/components/admin/Modals/user/UserActionModal";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import { apiFetch } from "@/lib/client/api";
import { fullName } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

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

  // มีรายชื่อจากเซิร์ฟเวอร์แล้ว → ไม่ต้องโหลดตอนเปิดหน้า (โหลดใหม่หลังแก้ไขเท่านั้น)
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
  const status = loading ? "loading" : error ? "error" : visible.length === 0 ? "empty" : "rows";

  const statusPill = (u: AdminUser) => (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs ${u.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}`}
    >
      {u.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
    </span>
  );

  const rolePills = (u: AdminUser) => (
    <div className="flex flex-wrap gap-1">
      {u.roles.map((r) => (
        <span key={r.role_type_id} className="rounded-md bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
          {roleLabel(r.role_name)}
        </span>
      ))}
      {u.roles.length === 0 && <span className="text-gray-400">ไม่ระบุ</span>}
    </div>
  );

  const actions = (u: AdminUser, mobile = false) => {
    const h = mobile ? "h-10" : "h-8";
    return (
      <div className={mobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center gap-1"}>
        <Button size="sm" variant="outline" className={h} onClick={() => setForm({ user: u })}>
          แก้ไข
        </Button>
        {u.is_active ? (
          <Button
            size="sm"
            variant="outline"
            className={`${h} text-yellow-700 border-yellow-300 hover:bg-yellow-50`}
            onClick={() => setAction({ type: "deactivate", user: u })}
          >
            ปิดใช้งาน
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className={`${h} text-green-700 border-green-300 hover:bg-green-50`}
              onClick={() => setAction({ type: "reactivate", user: u })}
            >
              เปิดใช้งาน
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`${h} text-red-600 border-red-300 hover:bg-red-50 ${mobile ? "col-span-2" : ""}`}
              onClick={() => setAction({ type: "delete", user: u })}
            >
              ลบ
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title={`บุคลากรทั้งหมด (${filtered.length})`}
        description="เพิ่ม แก้ไข กำหนดบทบาท และเปิด/ปิดการใช้งานบัญชี"
        actions={
          <Button onClick={() => setForm({ user: null })} className="h-10 text-white bg-purple-600 hover:bg-purple-700">
            + เพิ่มบุคลากร
          </Button>
        }
      />

      <div className="flex flex-col gap-3 p-3 bg-white border shadow-sm sm:flex-row sm:p-4 rounded-xl">
        <Input
          placeholder="ค้นหาชื่อ-สกุล หรือ อีเมล..."
          aria-label="ค้นหาบุคลากร"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 sm:flex-1"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="กรองตามบทบาท" className="h-10 px-3 text-sm bg-white border rounded-md sm:w-56">
          <option value="all">ทุกบทบาท</option>
          {roleNames.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden bg-white border shadow-sm rounded-xl">
        {/* จอเล็กกว่า xl: การ์ด (2 คอลัมน์ตั้งแต่ sm) */}
        <div className="xl:hidden">
          {status === "loading" && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}
          {status === "error" && <p className="px-4 py-10 text-center text-red-600">{error}</p>}
          {status === "empty" && <p className="px-4 py-10 text-center text-gray-500">ไม่พบข้อมูลตามเงื่อนไข</p>}
          {status === "rows" && (
            <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
              {visible.map((u) => (
                <li key={u.user_id} className="flex flex-col p-4 space-y-2 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">
                        {fullName(u)}
                        {u.is_teacher && <span className="ml-1 text-xs text-indigo-600">(ครู)</span>}
                      </div>
                      <div className="text-xs text-gray-500 break-all">{u.email}</div>
                      {u.tel && <div className="text-xs text-gray-500">{u.tel}</div>}
                    </div>
                    {statusPill(u)}
                  </div>
                  {rolePills(u)}
                  <div className="pt-1 mt-auto">{actions(u, true)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* จอ xl ขึ้นไป: ตาราง */}
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-gray-600">
                {["ลำดับ", "ชื่อ - สกุล", "อีเมล", "เบอร์โทร", "บทบาท", "สถานะ", "การจัดการ"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium tracking-wide text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {status === "loading" &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              {status === "error" && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {status === "empty" && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    ไม่พบข้อมูลตามเงื่อนไข
                  </td>
                </tr>
              )}
              {status === "rows" &&
                visible.map((u, i) => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{start + i + 1}</td>
                    <td className="px-4 py-2.5 min-w-40">
                      {fullName(u)}
                      {u.is_teacher && <span className="ml-1 text-xs text-indigo-600">(ครู)</span>}
                    </td>
                    <td className="px-4 py-2.5 break-all min-w-40">{u.email}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{u.tel || "-"}</td>
                    <td className="px-4 py-2.5">{rolePills(u)}</td>
                    <td className="px-4 py-2.5">{statusPill(u)}</td>
                    <td className="px-4 py-2.5">{actions(u)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} total={filtered.length} />
      </section>

      <UserFormModal open={!!form} user={form?.user ?? null} onClose={() => setForm(null)} onSaved={load} />
      <UserActionModal
        action={action?.type ?? null}
        userId={action?.user.user_id}
        userName={action ? fullName(action.user) : ""}
        onClose={() => setAction(null)}
        onDone={load}
      />
    </PageContainer>
  );
}
