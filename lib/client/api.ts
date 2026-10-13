// fetch ฝั่ง client แบบมี type และโยน ApiError เมื่อ response ไม่ ok
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

type Opts = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit | null };

export async function apiFetch<T = unknown>(url: string, opts: Opts = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const init: RequestInit = { cache: "no-store", credentials: "same-origin", ...rest };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers = { "Content-Type": "application/json", ...(headers as Record<string, string>) };
  } else if (headers) {
    init.headers = headers;
  }

  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (data && (data.error as string)) || `HTTP_${res.status}`;
    const detail = data?.detail;
    // detail = { message } (เช่นกฎการลา "ลาได้ครั้งละไม่เกิน 3 วัน") ระบุละเอียดกว่าข้อความทั่วไปของรหัส
    const ruleMsg = detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string" ? (detail as { message: string }).message : null;
    throw new ApiError(res.status, ruleMsg ?? ERROR_TH[code] ?? (typeof detail === "string" ? detail : code), detail);
  }
  return data as T;
}

/** ข้อความผิดพลาดที่ผู้ใช้อ่านเข้าใจ (รหัสจาก API → ภาษาไทย) */
export const ERROR_TH: Record<string, string> = {
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบใหม่",
  Unauthorized: "กรุณาเข้าสู่ระบบใหม่",
  Forbidden: "ไม่มีสิทธิ์ดำเนินการ",
  INSUFFICIENT_QUOTA: "จำนวนวันลาเกินสิทธิ์ที่เหลือ",
  LEAVE_CROSSES_FISCAL_YEAR: "ช่วงวันลาต้องอยู่ในปีงบประมาณเดียวกัน",
  NO_WORKING_DAYS: "ช่วงวันที่เลือกไม่มีวันทำการ",
  MISSING_REASON: "กรุณากรอกเหตุผลการลา",
  INVALID_DATE: "รูปแบบวันที่ไม่ถูกต้อง",
  END_BEFORE_START: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา",
  NOT_EDITABLE: "แก้ไขไม่ได้ในสถานะนี้",
  NOT_DELETABLE: "ลบไม่ได้ในสถานะนี้",
  NOT_REVIEWABLE: "ใบลานี้ไม่อยู่ในสถานะรอตรวจสอบ (อาจมีผู้อื่นดำเนินการไปแล้ว)",
  NOT_APPROVABLE: "ใบลานี้ไม่อยู่ในสถานะรออนุมัติ (อาจมีผู้อื่นดำเนินการไปแล้ว)",
  STATUS_CHANGED: "สถานะใบลาเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า",
  REQUEST_NOT_FOUND: "ไม่พบใบลา",
  FILE_TOO_LARGE: "ไฟล์ใหญ่เกินขนาดที่กำหนด",
  FILE_TYPE_NOT_ALLOWED: "ชนิดไฟล์นี้แนบไม่ได้",
  TOO_MANY_FILES: "แนบไฟล์เกินจำนวนที่กำหนด",
  SUBSTITUTE_NOT_FREE: "ครูท่านนี้ไม่ว่างในคาบดังกล่าว",
  ALREADY_ASSIGNED: "คาบนี้มีผู้สอนแทนแล้ว",
  DATE_NOT_MATCH_SCHEDULE: "วันที่ไม่ตรงกับวันสอนของคาบนี้",
  CANNOT_SUBSTITUTE_SELF: "ไม่สามารถให้ผู้ลาสอนแทนตัวเองได้",
  NOT_COMPLETE: "ยังมอบหมายสอนแทนไม่ครบทุกคาบ",
  NOT_COVERABLE: "ใบลานี้ไม่อยู่ในสถานะที่ปิดงานสอนแทนได้",
  OVERLAPPING_LEAVE: "ช่วงวันที่นี้ทับกับใบลาที่มีอยู่แล้ว",
  NO_APPROVED_LEAVE: "ครูเจ้าของคาบไม่มีใบลาที่อนุมัติในวัน/ช่วงเวลานี้",
  USER_NOT_FOUND: "ไม่พบบุคลากรในระบบ",
  USER_INACTIVE: "บุคลากรนี้ถูกปิดใช้งาน",
  DB_ERROR: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
  INTERNAL_ERROR: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
};
