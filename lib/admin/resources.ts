import "server-only";
import { HttpError } from "@/lib/http";
import { isISODate } from "@/lib/validate";
import { optInt, reqString, type CrudConfig } from "@/lib/admin/crud";

export const levelCfg: CrudConfig = {
  label: "ระดับชั้น",
  table: "level",
  idColumn: "level_id",
  select: "level_id, level_name",
  orderBy: "level_id",
  fields: { level_name: reqString("ชื่อระดับชั้น", 100) },
  required: ["level_name"],
  unique: "level_name",
  refs: [
    { table: "classroom", column: "classroom_level", label: "ห้องเรียน" },
    { table: "subject", column: "subject_level_id", label: "รายวิชา" },
  ],
};

export const subjectGroupCfg: CrudConfig = {
  label: "กลุ่มสาระ",
  table: "subjectgroup",
  idColumn: "subject_group_id",
  select: "subject_group_id, subject_group_name",
  orderBy: "subject_group_id",
  fields: { subject_group_name: reqString("ชื่อกลุ่มสาระ", 150) },
  required: ["subject_group_name"],
  unique: "subject_group_name",
  refs: [
    { table: "subject", column: "subject_group_id", label: "รายวิชา" },
    { table: "teacher", column: "subject_group_id", label: "ครู" },
  ],
};

export const classroomCfg: CrudConfig = {
  label: "ห้องเรียน",
  table: "classroom",
  idColumn: "classroom_id",
  select: "classroom_id, classroom_name, classroom_level, level:classroom_level ( level_id, level_name )",
  orderBy: "classroom_name",
  fields: { classroom_name: reqString("ชื่อห้องเรียน", 100), classroom_level: optInt },
  required: ["classroom_name"],
  unique: "classroom_name",
  refs: [{ table: "teachingschedule", column: "classroom_id", label: "คาบสอน" }],
  map: (r) => ({
    classroom_id: r.classroom_id,
    classroom_name: r.classroom_name ?? "",
    classroom_level: r.classroom_level ?? null,
    level_name: (r.level as { level_name?: string } | null)?.level_name ?? null,
  }),
};

export const subjectCfg: CrudConfig = {
  label: "รายวิชา",
  table: "subject",
  idColumn: "subject_id",
  select: `subject_id, subject_code, subject_name, subject_level_id, subject_group_id,
           level:subject_level_id ( level_name ), subjectgroup:subject_group_id ( subject_group_name )`,
  orderBy: "subject_id",
  fields: {
    subject_code: reqString("รหัสวิชา", 50),
    subject_name: reqString("ชื่อวิชา", 200),
    subject_level_id: optInt,
    subject_group_id: optInt,
  },
  required: ["subject_code", "subject_name"],
  refs: [{ table: "teachingschedule", column: "subject_id", label: "คาบสอน" }],
  map: (r) => ({
    subject_id: r.subject_id,
    subject_code: r.subject_code,
    subject_name: r.subject_name,
    subject_level_id: r.subject_level_id ?? null,
    subject_group_id: r.subject_group_id ?? null,
    subject_level: (r.level as { level_name?: string } | null)?.level_name ?? "",
    subject_group: (r.subjectgroup as { subject_group_name?: string } | null)?.subject_group_name ?? "",
  }),
};

export const holidayCfg: CrudConfig = {
  label: "วันหยุด",
  table: "holiday",
  idColumn: "holiday_id",
  select: "holiday_id, holiday_name, holiday_date",
  orderBy: "holiday_date",
  fields: {
    holiday_name: reqString("ชื่อวันหยุด", 150),
    holiday_date: (v) => {
      if (!isISODate(v)) throw new HttpError(422, "VALIDATION", "วันที่ไม่ถูกต้อง");
      return v;
    },
  },
  required: ["holiday_name", "holiday_date"],
};
