// type ฝั่ง client ของ DTO ใบลา (ตรงกับ lib/leave/queries.ts LeaveDTO — แยกไฟล์เพื่อไม่ดึงโค้ด server-only มาฝั่ง client)
export type LeaveFileDTO = { name: string; path: string; url: string };

export type LeaveItem = {
  id: string;
  userId: string;
  leaveTypeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type: string;
  date_end_type: string;
  totalDays: number;
  reason: string | null;
  comment: string | null;
  status_code: string;
  status: string;
  year: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  files: LeaveFileDTO[];
  user: { id: string; prename: string; name: string; surname: string; fullName: string; email: string };
};

export const leaveCode = (id: string | number) => `L${String(id).padStart(3, "0")}`;
