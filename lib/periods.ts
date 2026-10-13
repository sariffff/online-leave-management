// คาบเรียนมาตรฐานของโรงเรียน (คาบละ 50 นาที) — ใช้กำหนดเวลาตอนเพิ่มตารางสอน
export type Period = { period_number: number; start_time: string; end_time: string };

export const PERIODS: Period[] = [
  { period_number: 1, start_time: "08:00", end_time: "08:50" },
  { period_number: 2, start_time: "08:50", end_time: "09:40" },
  { period_number: 3, start_time: "09:50", end_time: "10:40" },
  { period_number: 4, start_time: "10:40", end_time: "11:30" },
  { period_number: 5, start_time: "13:00", end_time: "13:50" },
  { period_number: 6, start_time: "13:50", end_time: "14:40" },
];

export const DAY_NAMES = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"] as const;
