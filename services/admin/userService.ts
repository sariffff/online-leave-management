export async function createUser(payload: any) {
  const res = await fetch("/api/admin/usermanagement/create-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export async function getRoles() {
  const res = await fetch("/api/admin/role-type");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch roles");
  return data.roles;
}
