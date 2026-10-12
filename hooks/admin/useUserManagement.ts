// hooks/useUserManagement.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { getUsers, type User } from "@/services/admin/userManagementService";

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [loading, setLoading] = useState(false);

  // modal & selection states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await getUsers();
      setUsers(list);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.prename || ""} ${user.name} ${user.surname}`.toLowerCase();
      const q = searchTerm.toLowerCase();
      const searchMatch = fullName.includes(q) || user.email.toLowerCase().includes(q);
      const roleMatch =
        selectedRole === "all" ||
        user.roles.some((r) => r.role_name === selectedRole);
      return searchMatch && roleMatch;
    });
  }, [users, searchTerm, selectedRole]);

  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(users.flatMap((u) => u.roles.map((r) => r.role_name))));
  }, [users]);

  return {
    // data/state
    users,
    filteredUsers,
    uniqueRoles,
    loading,

    // filters
    searchTerm,
    setSearchTerm,
    selectedRole,
    setSelectedRole,

    // selection
    selectedUser,
    setSelectedUser,

    // modals
    showAddModal, setShowAddModal,
    showEditModal, setShowEditModal,
    showDeactivateModal, setShowDeactivateModal,
    showReactivateModal, setShowReactivateModal,
    showDeleteModal, setShowDeleteModal,

    // actions
    fetchUsers,
  };
}
