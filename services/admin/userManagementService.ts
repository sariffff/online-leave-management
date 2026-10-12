// services/userManagementService.ts
export type Role = { role_type_id: number; role_name: string };
export type User = {
  user_id: string;
  prename?: string | null;
  name: string;
  surname: string;
  email: string;
  tel?: string | null;
  is_active: boolean;
  roles: Role[];
};

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

// READ
export async function getUsers(): Promise<User[]> {
  const res = await fetch("/api/admin/usermanagement/get-user");
  const data = await handle(res);
  return data.users || [];
}

// CREATE
export async function createUser(payload: any) {
  const res = await fetch("/api/admin/usermanagement/create-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// UPDATE
export async function updateUser(userId: string, payload: any) {
  const res = await fetch("/api/admin/usermanagement/update-user", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });
  return handle(res);
}

// DEACTIVATE
export async function deactivateUser(userId: string) {
  const res = await fetch("/api/admin/usermanagement/deactivate-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return handle(res);
}

// REACTIVATE
export async function reactivateUser(userId: string) {
  const res = await fetch("/api/admin/usermanagement/reactivate-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return handle(res);
}

// DELETE
export async function deleteUser(userId: string) {
  const res = await fetch("/api/admin/usermanagement/delete-user", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return handle(res);
}
