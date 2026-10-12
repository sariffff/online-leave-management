// services/leaveRequestService.ts
export type LeaveRequest = {
  leave_request_id: number;
  date_start: string | null;     // ISO YYYY-MM-DD
  date_end: string | null;       // ISO YYYY-MM-DD
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number | null;
  reason: string | null;
  file: string | null;
  status: string | null;         // e.g. 'pending' | 'reviewed' | 'approved' | 'rejected'
  reviewed_by: string | null;    // UUID
  approved_by: string | null;    // UUID
  timestamp: string | null;      // ISO datetime
  leave_type_id: number | null;
  user_id: string;               // UUID (ผู้ส่งคำขอ)
  user?: { name?: string; surname?: string; email?: string } | null; // เผื่อคุณอยาก join user แสดงชื่อ
  leave_type_name?: string | null; // เผื่อ join leave type มาแสดง
};

type CreatePayload = Omit<LeaveRequest, "leave_request_id" | "timestamp">;
type UpdatePayload = Partial<CreatePayload> & { leave_request_id: number };

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

// READ (list)
export async function listLeaveRequests(params?: {
  status?: string; // 'all' | 'pending' | 'reviewed' | 'approved' | 'rejected'
  q?: string;      // ค้นหาเหตุผล/อีเมล/ชื่อ
}) {
  const url = new URL("/api/reviewer/leave-requests", window.location.origin);
  if (params?.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params?.q) url.searchParams.set("q", params.q);
  const res = await fetch(url.toString());
  const data = await handle(res);
  return (data.items || []) as LeaveRequest[];
}

// CREATE
export async function createLeaveRequest(payload: CreatePayload) {
  const res = await fetch("/api/reviewer/leave-requests/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// UPDATE
export async function updateLeaveRequest(payload: UpdatePayload) {
  const res = await fetch("/api/reviewer/leave-requests/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// DELETE
export async function deleteLeaveRequest(leave_request_id: number) {
  const res = await fetch("/api/reviewer/leave-requests/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leave_request_id }),
  });
  return handle(res);
}

// ACTIONS: approve/reject + set reviewer
export async function approveLeaveRequest(leave_request_id: number) {
  const res = await fetch("/api/reviewer/leave-requests/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leave_request_id }),
  });
  return handle(res);
}

export async function rejectLeaveRequest(leave_request_id: number, note?: string) {
  const res = await fetch("/api/reviewer/leave-requests/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leave_request_id, note }),
  });
  return handle(res);
}
