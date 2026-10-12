// types/leave-history.ts
export interface LeaveHistoryItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type: string; // "full" | "am" | "pm"
  date_end_type: string;   // "full" | "am" | "pm"
  totalDays: number;
  submittedAt: string;
  reason?: string;
  reviewedBy?: string;
  approvedBy?: string;
  reviewedAt?: string;
  approvedAt?: string;
  status: 'รอพิจารณา' | 'อนุมัติ' | 'ไม่อนุมัติ';
  comment?: string;
}

export interface LeaveHistorySearchFilters {
  year?: string;
  leaveType?: string;
  status?: string;
}

export interface LeaveHistorySummaryData {
  sickLeave: {
    used: number;
    total: number;
  };
  personalLeave: {
    used: number;
    total: number;
  };
  totalUsed: number;
  totalRemaining: number;
}