import UserManagementClient from "./UserManagementClient";
import { listUsers } from "@/lib/admin/users";

// รายชื่อบุคลากรโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML (layout ของกลุ่มหน้า admin ตรวจสิทธิ์ให้แล้ว)
export default async function Page() {
  let users;
  try {
    users = await listUsers();
  } catch (e) {
    console.error("[user-management] initial load failed", e);
  }
  return <UserManagementClient initialUsers={users} />;
}
