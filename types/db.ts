// โครงสร้างแถวของฐานข้อมูล (อ้างอิง schema ใน README) — เก็บให้ตรงกับ Supabase

export type UserRow = {
  user_id: string;
  prename: string | null;
  name: string | null;
  surname: string | null;
  is_active: boolean | null;
};

export type RoleTypeRow = { role_type_id: number; role_name: string };
export type UserRoleRow = { user_role_id: number; user_id: string; role_type_id: number };

export type LeaveTypeRow = {
  leave_type_id: number;
  leave_type_name: string;
  max_leave_day: number | null; // null = ไม่จำกัดโควตา
  carry_over_max: number | null;
  note: string | null;
};

export type UserLeaveQuotaRow = {
  user_leave_quota_id: number;
  user_id: string;
  leave_type_id: number;
  year: number;
  total_used: number | null;
  total_remaining: number | null;
  reserved: number | null;
};

export type LeaveRequestRow = {
  leave_request_id: number;
  user_id: string;
  leave_type_id: number;
  date_start: string;
  date_end: string;
  date_start_type: string | null;
  date_end_type: string | null;
  total_day: number;
  reason: string | null;
  file: string | null; // JSON string ของ array เช่น '["public/<uid>/<ts>-0.pdf"]'
  status: string;
  comment: string | null;
  year: number | null;
  timestamp: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

export type TeacherRow = { teacher_id: number; user_id: string | null; subject_group_id: number | null };

export type TeachingScheduleRow = {
  teaching_schedule_id: number;
  semester: string | null;
  day_of_week: string | null;
  period_number: number | null;
  start_time: string | null;
  end_time: string | null;
  subject_id: number | null;
  classroom_id: number | null;
  teacher_id: number | null;
};

export type SubstituteRow = {
  substitute_teaching_id: number;
  date_time: string | null;
  substitute_user_id: string | null;
  teaching_schedule_id: number | null;
};

export type HolidayRow = { holiday_id: number; holiday_name: string | null; holiday_date: string | null };
