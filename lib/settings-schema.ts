// รูปแบบ + ค่าเริ่มต้น + การตรวจค่าของ "การตั้งค่าระบบ" — ไม่มีโค้ดฝั่งเซิร์ฟเวอร์ จึงใช้ได้ทั้งหน้าเว็บและระบบหลังบ้าน
// ค่าเริ่มต้นทุกค่า = ค่าที่ระบบใช้อยู่ก่อนมีหน้าตั้งค่า (เปิดใช้แล้วพฤติกรรมไม่เปลี่ยน)

/* ---------------- สีของระบบ ---------------- */
export const THEMES = {
  blue: { label: "ฟ้า – คราม (ค่าเริ่มต้น)", from: "#2563eb", to: "#4f46e5" },
  sky: { label: "ฟ้าอ่อน", from: "#0284c7", to: "#0891b2" },
  green: { label: "เขียว", from: "#059669", to: "#0d9488" },
  purple: { label: "ม่วง", from: "#7c3aed", to: "#c026d3" },
  red: { label: "แดง – ส้ม", from: "#dc2626", to: "#ea580c" },
  slate: { label: "เทาเข้ม", from: "#334155", to: "#1e293b" },
} as const;
export type ThemeKey = keyof typeof THEMES;

/* ---------------- หมวดต่าง ๆ ---------------- */
export type GeneralSettings = {
  systemName: string; // แสดงที่หัวเว็บ (จอกว้าง), ชื่อแท็บเบราว์เซอร์, หน้าเข้าสู่ระบบ
  systemShortName: string; // หัวเว็บบนมือถือ
  schoolName: string;
  approverTitle: string; // "ผู้อำนวยการโรงเรียน…" — บรรทัด "เรียน" และตำแหน่งผู้อนุมัติในใบลา
  footerText: string; // ท้ายเมนูด้านข้าง (ว่าง = ไม่แสดง)
  theme: ThemeKey;
  logoUrl: string | null;
};

export type CountMode = "working" | "calendar";
/** กฎ/หน้าตาเพิ่มเติมของประเภทการลา (ข้อมูลหลักอยู่ในตาราง leavetype) — null = ไม่จำกัด */
export type LeaveTypeRule = {
  description: string;
  color: string; // คีย์ของ LEAVE_COLORS
  isActive: boolean;
  sortOrder: number;
  maxDaysPerRequest: number | null;
  docRequiredAfterDays: number | null; // ลาเกินกี่วันต้องแนบเอกสาร
  minNoticeDays: number | null; // ต้องยื่นล่วงหน้าอย่างน้อยกี่วัน
  maxBackdateDays: number | null; // ยื่นย้อนหลังได้ไม่เกินกี่วัน
  allowHalfDay: boolean;
  countMode: CountMode;
};

export type Period = { period_number: number; start_time: string; end_time: string };
export type PeriodSettings = { periods: Period[]; afternoonStartsAt: string };

export const FILE_KINDS = {
  pdf: { label: "PDF", mime: "application/pdf", ext: [".pdf"] },
  jpg: { label: "JPG", mime: "image/jpeg", ext: [".jpg", ".jpeg"] },
  png: { label: "PNG", mime: "image/png", ext: [".png"] },
  webp: { label: "WEBP", mime: "image/webp", ext: [".webp"] },
  heic: { label: "HEIC (iPhone)", mime: "image/heic", ext: [".heic"] },
} as const;
export type FileKind = keyof typeof FILE_KINDS;
export type AttachmentSettings = { maxFileMB: number; maxFiles: number; kinds: FileKind[] };

export type AppSettings = {
  general: GeneralSettings;
  leaveTypes: Record<string, LeaveTypeRule>; // คีย์ = leave_type_id
  periods: PeriodSettings;
  attachments: AttachmentSettings;
};
export type SettingsSection = keyof AppSettings;

/** ข้อมูลที่เปิดให้ทุกคนอ่าน (หัวเว็บ, หน้าเข้าสู่ระบบ, ฟอร์มยื่นลา) */
export type PublicSettings = { general: GeneralSettings; periods: PeriodSettings; attachments: AttachmentSettings };

/* ---------------- ค่าเริ่มต้น ---------------- */
export const LEAVE_COLORS = {
  red: { label: "แดง", chip: "bg-red-100 text-red-800", card: "bg-red-50" },
  blue: { label: "ฟ้า", chip: "bg-blue-100 text-blue-800", card: "bg-blue-50" },
  green: { label: "เขียว", chip: "bg-green-100 text-green-800", card: "bg-green-50" },
  pink: { label: "ชมพู", chip: "bg-pink-100 text-pink-800", card: "bg-pink-50" },
  purple: { label: "ม่วง", chip: "bg-purple-100 text-purple-800", card: "bg-purple-50" },
  indigo: { label: "คราม", chip: "bg-indigo-100 text-indigo-800", card: "bg-indigo-50" },
  yellow: { label: "เหลือง", chip: "bg-yellow-100 text-yellow-800", card: "bg-yellow-50" },
  teal: { label: "เขียวอมฟ้า", chip: "bg-teal-100 text-teal-800", card: "bg-teal-50" },
  orange: { label: "ส้ม", chip: "bg-orange-100 text-orange-800", card: "bg-orange-50" },
  cyan: { label: "ฟ้าอมเขียว", chip: "bg-cyan-100 text-cyan-800", card: "bg-cyan-50" },
  gray: { label: "เทา", chip: "bg-gray-100 text-gray-800", card: "bg-gray-50" },
} as const;
export type LeaveColor = keyof typeof LEAVE_COLORS;

const rule = (description: string, color: LeaveColor, sortOrder: number, extra: Partial<LeaveTypeRule> = {}): LeaveTypeRule => ({
  description,
  color,
  isActive: true,
  sortOrder,
  maxDaysPerRequest: null,
  docRequiredAfterDays: null,
  minNoticeDays: null,
  maxBackdateDays: null,
  allowHalfDay: true,
  countMode: "working",
  ...extra,
});

/** คำอธิบาย/สีเดิมของประเภทลา 1–11 (ย้ายมาจาก leave-type.tsx) */
export const DEFAULT_LEAVE_RULES: Record<string, LeaveTypeRule> = {
  "1": rule("การลาเนื่องจากเจ็บป่วย (เกิน 3 วันต้องมีใบรับรองแพทย์)", "red", 1, { docRequiredAfterDays: 3 }),
  "2": rule("การลาเพื่อจัดการธุระส่วนตัว", "blue", 2),
  "3": rule("การลาพักผ่อนประจำปี", "green", 3),
  "4": rule("การลาเพื่อคลอดบุตรสำหรับข้าราชการหญิง", "pink", 4),
  "5": rule("การลาเพื่อเลี้ยงดูบุตรหลังคลอด", "purple", 5),
  "6": rule("การลาไปช่วยเหลือภริยา/คู่สมรสที่คลอดบุตร", "indigo", 6),
  "7": rule("การลาเพื่อเกณฑ์ทหาร หรือเข้ารับการศึกษาวิชาทหาร", "yellow", 7),
  "8": rule("การลาเพื่อเพิ่มพูนความรู้ที่เป็นประโยชน์ต่อราชการ", "teal", 8),
  "9": rule("การลาเพื่ออุปสมบทหรือไปประกอบพิธีฮัจย์", "orange", 9),
  "10": rule("การลาเพื่อปฏิบัติงานระหว่างประเทศที่เป็นประโยชน์", "cyan", 10),
  "11": rule("การลาไปติดตามคู่สมรสที่ไปปฏิบัติงานในสถานที่อื่น", "gray", 11),
};
export const defaultLeaveRule = (id: number | string): LeaveTypeRule =>
  DEFAULT_LEAVE_RULES[String(id)] ?? rule("", "gray", 100 + Number(id || 0));

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    systemName: "ระบบการลาของบุคลากร โรงเรียนบ้านตาสา",
    systemShortName: "ระบบลาออนไลน์",
    schoolName: "โรงเรียนบ้านตาสา",
    approverTitle: "ผู้อำนวยการโรงเรียนบ้านตาสา",
    footerText: "",
    theme: "blue",
    logoUrl: null,
  },
  leaveTypes: DEFAULT_LEAVE_RULES,
  periods: {
    periods: [
      { period_number: 1, start_time: "08:00", end_time: "08:50" },
      { period_number: 2, start_time: "08:50", end_time: "09:40" },
      { period_number: 3, start_time: "09:50", end_time: "10:40" },
      { period_number: 4, start_time: "10:40", end_time: "11:30" },
      { period_number: 5, start_time: "13:00", end_time: "13:50" },
      { period_number: 6, start_time: "13:50", end_time: "14:40" },
    ],
    afternoonStartsAt: "12:00",
  },
  attachments: { maxFileMB: 5, maxFiles: 5, kinds: ["pdf", "jpg", "png"] },
};

/* ---------------- ตรวจค่า ---------------- */
export class SettingsError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, field: string, label: string, { min = 1, max = 200 } = {}) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) throw new SettingsError(field, `กรุณากรอก${label}`);
  if (s.length > max) throw new SettingsError(field, `${label}ยาวเกิน ${max} ตัวอักษร`);
  return s;
};
const intOrNull = (v: unknown, field: string, label: string, { min = 0, max = 3650 } = {}) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new SettingsError(field, `${label}ต้องเป็นจำนวนเต็ม ${min}–${max}`);
  return n;
};
const bool = (v: unknown) => v === true || v === "true";

export function validateGeneral(v: Partial<GeneralSettings>, prev: GeneralSettings): GeneralSettings {
  const theme = (v.theme ?? prev.theme) as ThemeKey;
  if (!(theme in THEMES)) throw new SettingsError("theme", "สีของระบบไม่ถูกต้อง");
  const logoUrl = v.logoUrl === undefined ? prev.logoUrl : v.logoUrl;
  if (logoUrl !== null && (typeof logoUrl !== "string" || !/^https:\/\//.test(logoUrl))) throw new SettingsError("logoUrl", "ลิงก์โลโก้ไม่ถูกต้อง");
  return {
    systemName: str(v.systemName ?? prev.systemName, "systemName", "ชื่อระบบ", { max: 120 }),
    systemShortName: str(v.systemShortName ?? prev.systemShortName, "systemShortName", "ชื่อระบบแบบย่อ", { max: 40 }),
    schoolName: str(v.schoolName ?? prev.schoolName, "schoolName", "ชื่อโรงเรียน", { max: 120 }),
    approverTitle: str(v.approverTitle ?? prev.approverTitle, "approverTitle", "ตำแหน่งผู้อนุมัติ", { max: 120 }),
    footerText: str(v.footerText ?? prev.footerText, "footerText", "ข้อความท้ายเมนู", { min: 0, max: 80 }),
    theme,
    logoUrl,
  };
}

export function validateLeaveRule(v: Partial<LeaveTypeRule>, prev: LeaveTypeRule): LeaveTypeRule {
  const color = (v.color ?? prev.color) as string;
  if (!(color in LEAVE_COLORS)) throw new SettingsError("color", "สีไม่ถูกต้อง");
  const countMode = (v.countMode ?? prev.countMode) as CountMode;
  if (countMode !== "working" && countMode !== "calendar") throw new SettingsError("countMode", "วิธีนับวันไม่ถูกต้อง");
  const pick = <K extends keyof LeaveTypeRule>(k: K) => (k in v ? v[k] : prev[k]);
  return {
    description: str(pick("description"), "description", "คำอธิบาย", { min: 0, max: 300 }),
    color,
    isActive: bool(pick("isActive")),
    sortOrder: intOrNull(pick("sortOrder"), "sortOrder", "ลำดับ", { min: 0, max: 10000 }) ?? 0,
    maxDaysPerRequest: intOrNull(pick("maxDaysPerRequest"), "maxDaysPerRequest", "ลาได้ครั้งละ", { min: 1 }),
    docRequiredAfterDays: intOrNull(pick("docRequiredAfterDays"), "docRequiredAfterDays", "ต้องแนบเอกสารเมื่อลาเกิน", { min: 0 }),
    minNoticeDays: intOrNull(pick("minNoticeDays"), "minNoticeDays", "ต้องยื่นล่วงหน้า", { min: 0, max: 365 }),
    maxBackdateDays: intOrNull(pick("maxBackdateDays"), "maxBackdateDays", "ยื่นย้อนหลังได้", { min: 0, max: 365 }),
    allowHalfDay: bool(pick("allowHalfDay")),
    countMode,
  };
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function validatePeriods(v: Partial<PeriodSettings>, prev: PeriodSettings): PeriodSettings {
  const list = Array.isArray(v.periods) ? v.periods : prev.periods;
  if (list.length < 1 || list.length > 12) throw new SettingsError("periods", "จำนวนคาบต้องอยู่ระหว่าง 1–12 คาบ");
  const periods = list.map((p, i) => {
    const start = String(p?.start_time ?? "").slice(0, 5);
    const end = String(p?.end_time ?? "").slice(0, 5);
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) throw new SettingsError(`periods.${i}`, `คาบที่ ${i + 1}: เวลาต้องเป็นรูปแบบ ชั่วโมง:นาที`);
    if (toMinutes(end) <= toMinutes(start)) throw new SettingsError(`periods.${i}`, `คาบที่ ${i + 1}: เวลาสิ้นสุดต้องหลังเวลาเริ่ม`);
    return { period_number: i + 1, start_time: start, end_time: end };
  });
  for (let i = 1; i < periods.length; i++) {
    if (toMinutes(periods[i].start_time) < toMinutes(periods[i - 1].end_time)) {
      throw new SettingsError(`periods.${i}`, `คาบที่ ${i + 1} เริ่มก่อนคาบที่ ${i} จบ`);
    }
  }
  const afternoonStartsAt = String(v.afternoonStartsAt ?? prev.afternoonStartsAt).slice(0, 5);
  if (!TIME_RE.test(afternoonStartsAt)) throw new SettingsError("afternoonStartsAt", "เวลาเริ่มช่วงบ่ายไม่ถูกต้อง");
  return { periods, afternoonStartsAt };
}

/** เพดานของพื้นที่เก็บไฟล์ใบลา (ตั้งเกินนี้ไม่ได้) */
export const MAX_ATTACHMENT_MB = 20;

export function validateAttachments(v: Partial<AttachmentSettings>, prev: AttachmentSettings): AttachmentSettings {
  const maxFileMB = Number(v.maxFileMB ?? prev.maxFileMB);
  if (!Number.isFinite(maxFileMB) || maxFileMB < 1 || maxFileMB > MAX_ATTACHMENT_MB) {
    throw new SettingsError("maxFileMB", `ขนาดไฟล์ต้องอยู่ระหว่าง 1–${MAX_ATTACHMENT_MB} MB`);
  }
  const maxFiles = Number(v.maxFiles ?? prev.maxFiles);
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 10) throw new SettingsError("maxFiles", "จำนวนไฟล์ต้องอยู่ระหว่าง 1–10");
  const kinds = [...new Set((Array.isArray(v.kinds) ? v.kinds : prev.kinds).filter((k): k is FileKind => k in FILE_KINDS))];
  if (kinds.length === 0) throw new SettingsError("kinds", "ต้องเลือกชนิดไฟล์อย่างน้อย 1 ชนิด");
  return { maxFileMB: Math.round(maxFileMB * 10) / 10, maxFiles, kinds };
}

/** รวมค่าที่บันทึกไว้กับค่าเริ่มต้น (ค่าที่หาย/ผิดรูปใช้ค่าเริ่มต้นแทน — ไฟล์ตั้งค่าเสียระบบก็ยังทำงาน) */
export function mergeSettings(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<SettingsSection, unknown>>;
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  const d = DEFAULT_SETTINGS;
  const leaveTypes: Record<string, LeaveTypeRule> = { ...d.leaveTypes };
  if (r.leaveTypes && typeof r.leaveTypes === "object") {
    for (const [id, v] of Object.entries(r.leaveTypes as Record<string, Partial<LeaveTypeRule>>)) {
      leaveTypes[id] = safe(() => validateLeaveRule(v ?? {}, defaultLeaveRule(id)), defaultLeaveRule(id));
    }
  }
  return {
    general: safe(() => validateGeneral((r.general ?? {}) as Partial<GeneralSettings>, d.general), d.general),
    leaveTypes,
    periods: safe(() => validatePeriods((r.periods ?? {}) as Partial<PeriodSettings>, d.periods), d.periods),
    attachments: safe(() => validateAttachments((r.attachments ?? {}) as Partial<AttachmentSettings>, d.attachments), d.attachments),
  };
}

export const toPublic = (s: AppSettings): PublicSettings => ({ general: s.general, periods: s.periods, attachments: s.attachments });

/** "ช่วงเช้า/บ่าย" ของคาบตามเวลาเริ่ม */
export function periodPartOf(settings: PeriodSettings, period: number, startTime?: string | null): "am" | "pm" {
  const start = (startTime && /^\d{2}:\d{2}/.test(startTime) ? startTime : settings.periods.find((p) => p.period_number === period)?.start_time) ?? "";
  if (!start) return period <= 4 ? "am" : "pm";
  return start.slice(0, 5) < settings.afternoonStartsAt ? "am" : "pm";
}

/* ---------------- ไฟล์แนบ: ใช้ทั้งฟอร์มและระบบหลังบ้าน ---------------- */
type FileLike = { name: string; size: number; type: string };

/** ชนิดของไฟล์ตาม MIME หรือนามสกุล (บางเครื่องส่ง HEIC มาโดยไม่มี MIME) */
export function fileKindOf(f: Pick<FileLike, "name" | "type">): FileKind | null {
  const ext = (f.name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  for (const [k, v] of Object.entries(FILE_KINDS) as [FileKind, (typeof FILE_KINDS)[FileKind]][]) {
    if (f.type ? f.type === v.mime : (v.ext as readonly string[]).includes(ext)) return k;
  }
  return null;
}

export const kindsText = (a: AttachmentSettings) => a.kinds.map((k) => FILE_KINDS[k].label).join(", ");

/** ค่า accept ของ <input type="file"> */
export const acceptOf = (a: AttachmentSettings) => a.kinds.flatMap((k) => [...FILE_KINDS[k].ext, FILE_KINDS[k].mime]).join(",");

/** คำอธิบายสั้น เช่น "PDF, JPG, PNG (สูงสุด 5MB ต่อไฟล์, ไม่เกิน 5 ไฟล์)" */
export const describeAttachments = (a: AttachmentSettings) => `${kindsText(a)} (สูงสุด ${a.maxFileMB}MB ต่อไฟล์, ไม่เกิน ${a.maxFiles} ไฟล์)`;

/** ปัญหาของไฟล์เดียว: code ใช้กับ API, message แสดงผู้ใช้ (null = ใช้ได้) */
export function checkAttachment(a: AttachmentSettings, f: FileLike): { code: "FILE_TOO_LARGE" | "FILE_TYPE_NOT_ALLOWED"; message: string } | null {
  const kind = fileKindOf(f);
  if (!kind || !a.kinds.includes(kind)) return { code: "FILE_TYPE_NOT_ALLOWED", message: `${f.name} ไม่ใช่ ${kindsText(a)}` };
  if (f.size > a.maxFileMB * 1024 * 1024) return { code: "FILE_TOO_LARGE", message: `${f.name} ใหญ่เกิน ${a.maxFileMB}MB` };
  return null;
}
