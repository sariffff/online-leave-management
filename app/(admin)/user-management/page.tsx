// app/admin/user-management/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

import EditUserModal, {
  User,
  Role,
} from "@/components/admin/Modals/user/EditUserModal";
import AddUserModal from "@/components/admin/Modals/user/AddUserModal";
import DeactivateUserModal from "@/components/admin/Modals/user/DeactivateUserModal";
import ReactivateUserModal from "@/components/admin/Modals/user/ReactivateUserModal";
import DeleteUserModal from "@/components/admin/Modals/user/DeleteUserModal";

const PAGE_SIZE = 10;

export default function Page() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [loading, setLoading] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);

  // modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usermanagement/get-user");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // filter client-side
  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const fullName = `${user.prename || ""} ${user.name} ${user.surname}`
        .trim()
        .toLowerCase();
      const email = (user.email || "").toLowerCase();

      const searchMatch = !q || fullName.includes(q) || email.includes(q);
      const roleMatch =
        selectedRole === "all" ||
        user.roles?.some((r) => r.role_name === selectedRole);

      return searchMatch && roleMatch;
    });
  }, [users, searchTerm, selectedRole]);

  // reset to page 1 when filter changed
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  // unique roles
  const uniqueRoles = useMemo(
    () =>
      Array.from(
        new Set(
          (users || []).flatMap((u) => (u.roles || []).map((r) => r.role_name))
        )
      ),
    [users]
  );

  // pagination calc
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visible = filteredUsers.slice(startIdx, endIdx);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      {/* Main */}
      <div className="flex-1 overflow-auto">
        {/* Page container */}
        <div className="min-h-screen p-6">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-3 mb-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-bold sm:text-xl">
              บุคลากรทั้งหมด ({filteredUsers.length})
            </h2>
            <Button
              onClick={() => setShowAddModal(true)}
              className="text-white bg-purple-600 hover:bg-purple-700"
            >
              + เพิ่มบุคลากร
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 mb-4 sm:flex-row">
            <Input
              placeholder="ค้นหาชื่อ-สกุล หรือ อีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:w-1/2"
            />
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v)}
            >
              <SelectTrigger className="sm:w-1/4">
                <SelectValue placeholder="ทุกบทบาท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกบทบาท</SelectItem>
                {uniqueRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table COMPACT */}
          <div className="mb-8 overflow-hidden bg-white shadow-sm rounded-xl">
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                รายชื่อบุคลากร
              </h3>
            </div>

            {!loading ? (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-[13px]">
                  {/* ✅ ใส่ครบ 7 คอลัมน์ (ลำดับ/ชื่อ/อีเมล/เบอร์/บทบาท/สถานะ/การจัดการ) */}
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-[13rem]" />
                    <col className="w-[13rem]" />
                    <col className="w-32" />
                    <col className="w-[20rem]" />
                    <col className="w-24" />   
                    <col className="w-40" />
                  </colgroup>

                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr className="text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">
                        ลำดับ
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">
                        ชื่อ - สกุล
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">
                        อีเมล
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">
                        เบอร์โทร
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] tracking-wide">
                        บทบาท
                      </th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">
                        สถานะ
                      </th>
                      <th className="px-4 py-2 text-center text-[11px] tracking-wide">
                        การจัดการ
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {visible.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-10 text-center text-gray-500"
                        >
                          ไม่พบข้อมูลตามเงื่อนไข
                        </td>
                      </tr>
                    ) : (
                      visible.map((user, idx) => {
                        const rowNo = startIdx + idx + 1; // ลำดับจริงตามหน้า
                        return (
                          <tr key={user.user_id} className="hover:bg-gray-50">
                            {/* ลำดับ */}
                            <td className="px-4 py-2">
                              <span className="font-medium text-gray-900">
                                {rowNo}
                              </span>
                            </td>

                            {/* ชื่อ - สกุล */}
                            <td className="px-4 py-2">
                              <div className="truncate">
                                {user.prename} {user.name} {user.surname}
                              </div>
                            </td>

                            {/* อีเมล */}
                            <td className="px-4 py-2">
                              <div className="truncate">{user.email}</div>
                            </td>

                            {/* เบอร์โทร */}
                            <td className="px-4 py-2">
                              <div className="truncate">{user.tel || "-"}</div>
                            </td>

                            {/* บทบาท */}
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {(user.roles ?? []).map((r) => (
                                  <span
                                    key={r.role_type_id}
                                    className="inline-block rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[11px] leading-4"
                                  >
                                    {r.role_name}
                                  </span>
                                ))}
                                {(!user.roles || user.roles.length === 0) && (
                                  <span className="text-gray-400">ไม่ระบุ</span>
                                )}
                              </div>
                            </td>

                            {/* สถานะ */}
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] leading-4 ${
                                  user.is_active
                                    ? "bg-green-100 text-green-800 border-green-200"
                                    : "bg-red-100 text-red-800 border-red-200"
                                }`}
                              >
                                {user.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                              </span>
                            </td>

                            {/* การจัดการ */}
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[12px]"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowEditModal(true);
                                  }}
                                >
                                  แก้ไข
                                </Button>

                                {user.is_active ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[12px] text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowDeactivateModal(true);
                                    }}
                                  >
                                    ปิดใช้งาน
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[12px] text-green-700 border-green-300 hover:bg-green-50"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowReactivateModal(true);
                                      }}
                                    >
                                      เปิดใช้งาน
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[12px] text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      ลบ
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-gray-500">กำลังโหลดข้อมูล...</div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    หน้า {safePage} จาก {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(safePage - 1)}
                      disabled={safePage === 1}
                      className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">
                      {safePage}
                    </span>
                    <button
                      onClick={() => setCurrentPage(safePage + 1)}
                      disabled={safePage === totalPages}
                      className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modals */}
          <EditUserModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            user={selectedUser}
            fetchUsers={fetchUsers}
          />
          <AddUserModal
            open={showAddModal}
            onOpenChange={setShowAddModal}
            fetchUsers={fetchUsers}
          />
          <DeactivateUserModal
            open={showDeactivateModal}
            onOpenChange={setShowDeactivateModal}
            userId={selectedUser?.user_id}
            userName={`${selectedUser?.prename || ""} ${selectedUser?.name} ${
              selectedUser?.surname
            }`}
            onUpdated={fetchUsers}
          />
          <ReactivateUserModal
            open={showReactivateModal}
            onOpenChange={setShowReactivateModal}
            userId={selectedUser?.user_id}
            userName={`${selectedUser?.prename || ""} ${selectedUser?.name} ${
              selectedUser?.surname
            }`}
            onUpdated={fetchUsers}
          />
          <DeleteUserModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            userId={selectedUser?.user_id}
            userName={`${selectedUser?.prename || ""} ${selectedUser?.name} ${
              selectedUser?.surname
            }`}
            onDeleted={fetchUsers}
          />
        </div>
      </div>
    </div>
  );
}
