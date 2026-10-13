// ชื่อบทบาทต้องตรงกับ roletype.role_name ในฐานข้อมูล (1=admin ... 5=academic)
export const ROLE = {
  admin: "admin",
  user: "user",
  supervisor: "supervisor",
  director: "director",
  academic: "academic",
} as const;

export type RoleName = (typeof ROLE)[keyof typeof ROLE];

/** หน้าแรกของแต่ละบทบาทหลังเลือกสิทธิ์ (ใช้ role_name) */
export const ROLE_HOME: Record<RoleName, string> = {
  admin: "/user-management",
  user: "/leave-page",
  supervisor: "/reviewed-page",
  director: "/leave-approve",
  academic: "/leavetable",
};

/** ชื่อบทบาทภาษาไทยสำหรับแสดงผล */
export const ROLE_LABEL: Record<RoleName, string> = {
  admin: "ผู้ดูแลระบบ",
  user: "บุคลากร",
  supervisor: "ธุรการ",
  director: "ผู้อำนวยการ",
  academic: "วิชาการ",
};

export const roleLabel = (name: string) => ROLE_LABEL[name as RoleName] ?? name;
