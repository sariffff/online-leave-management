// lib/services/leave.mock.ts
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type LeaveRequest = {
    leave_request_id: number;
    date_start: string;   // 'YYYY-MM-DD' หรือ ISO
    date_end: string;
    date_start_type?: string;
    date_end_type?: string;
    total_day: number;
    reason?: string;
    file?: string;
    status: LeaveStatus;
    leave_type_id: number;
    user_id: number;
    leavetype?: { leave_type_name: string };
    user?: {
        name: string;
        surname: string;
        email?: string;
        position?: string;
    };
};

export type Entitlement = {
    user_id: number;
    total: number;      // สิทธิ์รวมทั้งปี (วัน)
    used: number;       // ใช้แล้ว (วัน) - ถ้าอยากให้ตรงกับ approved จริง ให้คำนวณจาก mockRequests ก็ได้
};

const users = [
    { id: 1, name: 'นายสมชื่น', surname: 'สิงขราย', position: 'ครู', department: 'คณิตศาสตร์' },
    { id: 2, name: 'นางสมหญิง', surname: 'ใจดี', position: 'ครู', department: 'ภาษาไทย' },
    { id: 3, name: 'นายสมศักดิ์', surname: 'รักงาน', position: 'ครู', department: 'วิทยาศาสตร์' },
    { id: 4, name: 'น.ส.ใสใส', surname: 'เรียนรู้', position: 'ครู', department: 'สังคมศึกษา' },
];

const leaveTypes = [
    { id: 1, leave_type_name: 'ลาป่วย' },
    { id: 2, leave_type_name: 'ลากิจ' },
    { id: 3, leave_type_name: 'ลาพักร้อน' },
    { id: 4, leave_type_name: 'ลาปีใหม่' },
    { id: 5, leave_type_name: 'ลาคลอด' },
    { id: 6, leave_type_name: 'ลาบวช' },
    { id: 7, leave_type_name: 'ลาอุปสมบท' },
    { id: 8, leave_type_name: 'ลาศึกษาต่อ' },
    { id: 9, leave_type_name: 'ลาเพื่อรับราชการทหาร' },
    { id: 10, leave_type_name: 'ลาอื่นๆ' },
];

// *** MOCK REQUESTS (2025) ***
const mockRequests: LeaveRequest[] = [
    { leave_request_id: 1001, user_id: 1, leave_type_id: 1, status: 'approved', total_day: 2, date_start: '2026-01-18', date_end: '2026-01-19' },
    { leave_request_id: 1002, user_id: 1, leave_type_id: 2, status: 'pending', total_day: 1, date_start: '2025-02-11', date_end: '2025-02-11' },
    { leave_request_id: 1003, user_id: 1, leave_type_id: 3, status: 'approved', total_day: 3, date_start: '2025-08-15', date_end: '2025-08-17' },

    { leave_request_id: 1004, user_id: 2, leave_type_id: 5, status: 'approved', total_day: 1, date_start: '2025-03-05', date_end: '2025-03-05' },
    { leave_request_id: 1005, user_id: 2, leave_type_id: 5, status: 'rejected', total_day: 1, date_start: '2025-06-10', date_end: '2025-06-10' },
    { leave_request_id: 1006, user_id: 2, leave_type_id: 10, status: 'approved', total_day: 2, date_start: '2025-01-01', date_end: '2025-01-02' },

    { leave_request_id: 1007, user_id: 3, leave_type_id: 5, status: 'approved', total_day: 4, date_start: '2025-07-20', date_end: '2025-07-23' },
    { leave_request_id: 1008, user_id: 3, leave_type_id: 5, status: 'pending', total_day: 1, date_start: '2025-09-10', date_end: '2025-09-10' },

    { leave_request_id: 1009, user_id: 4, leave_type_id: 5, status: 'approved', total_day: 2, date_start: '2025-04-08', date_end: '2025-04-09' },
    { leave_request_id: 1010, user_id: 4, leave_type_id: 5, status: 'approved', total_day: 1, date_start: '2025-05-14', date_end: '2025-05-14' },
].map((r) => {
    const u = users.find((x) => x.id === r.user_id)!;
    const t = leaveTypes.find((x) => x.id === r.leave_type_id)!;
    return {
        ...r,
        user: { name: u.name, surname: u.surname, position: u.position, department: u.department },
        leavetype: { leave_type_name: t.leave_type_name },
    };
});

// Mock entitlements (สิทธิ์รวม/ใช้แล้ว)
const mockEntitlements: Entitlement[] = [
    { user_id: 1, total: 60, used: 5 },  // (2+3)
    { user_id: 2, total: 60, used: 3 },  // (1+2 rejectedไม่คิด)
    { user_id: 3, total: 60, used: 4 },
    { user_id: 4, total: 60, used: 3 },
];

// --- Helpers ---
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function fetchLeaveRequestsMock(params?: { status?: LeaveStatus | 'all'; q?: string }) {
    await delay(200); // จำลอง latency
    let list = [...mockRequests];

    if (params?.status && params.status !== 'all') {
        list = list.filter((r) => r.status === params.status);
    }
    if (params?.q) {
        const q = params.q.toLowerCase();
        list = list.filter((r) => {
            const fullName = `${r.user?.name ?? ''} ${r.user?.surname ?? ''}`.toLowerCase();
            const typeName = r.leavetype?.leave_type_name?.toLowerCase() ?? '';
            return (
                fullName.includes(q) ||
                typeName.includes(q) ||
                String(r.leave_request_id).includes(q)
            );
        });
    }
    return { items: list };
}

export async function fetchLeaveRequestsByUserMock(user_id: number) {
    await delay(150);
    const items = mockRequests.filter((r) => r.user_id === user_id);
    return { items };
}

export async function fetchEntitlementByUserMock(user_id: number) {
    await delay(120);
    const found = mockEntitlements.find((e) => e.user_id === user_id);
    return found ?? { user_id, total: 60, used: itemsApprovedDays(user_id) };
}

function itemsApprovedDays(user_id: number) {
    return mockRequests
        .filter((r) => r.user_id === user_id && r.status === 'approved')
        .reduce((sum, r) => sum + (r.total_day || 0), 0);
}