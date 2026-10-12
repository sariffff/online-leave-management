"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/admin/sidebar";

/* ===== Endpoints ===== */
const TEACHERS_API_LIST   = "/api/admin/schedule/teacher";
const TEACHER_DETAIL_API  = (id: string | number) => `/api/admin/schedule/teacher/${id}`;
const SUBJECTS_API        = "/api/admin/subjectmanagement/subject";
const CLASSROOMS_API      = "/api/admin/classroommanagement";
const LEVEL_API           = "/api/admin/levelmanagement";
const SCHEDULE_API        = (userId: string) => `/api/admin/schedule/table/${userId}`; // GET/POST/DELETE

/* ===== Types ===== */
interface TeachingSchedule {
  teaching_schedule_id?: string | number;
  schedule_id?: string;
  teacher_name?: string;
  subject?: string;
  classroom?: string;
  grade_level?: string;
  day?: string;        // จันทร์..ศุกร์
  time_slot?: string;  // HH:mm-HH:mm
}
type TeacherRow = {
  teacher_id?: number | string;
  user_id?: { user_id: string; prename?: string | null; name: string; surname: string };
};
type TeacherItem = { teacher_id: string; teacher_name: string };
type TeacherDetail = {
  teacher_id: string;
  user_id: { user_id: string; prename?: string | null; name: string; surname: string };
};
type Subject = { subject_id: string | number; subject_name: string };
type Classroom = { classroom_id: string | number; classroom_name: string; level_name?: string };
type Level = { level_id: string | number; level_name: string };
type Period = { period_number: number; start_time: string; end_time: string };

/* ===== Utils / Constants ===== */
const uid = () => Math.random().toString(36).slice(2, 10);
const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"] as const;

/** ใช้เวลาจริง 50 นาที และให้ header ผูกกับ PERIODS เสมอ */
const PERIODS: Period[] = [
  { period_number: 1, start_time: "08:00", end_time: "08:50" },
  { period_number: 2, start_time: "08:50", end_time: "09:40" },
  { period_number: 3, start_time: "09:50", end_time: "10:40" },
  { period_number: 4, start_time: "10:40", end_time: "11:30" },
  { period_number: 5, start_time: "13:00", end_time: "13:50" },
  { period_number: 6, start_time: "13:50", end_time: "14:40" },
];

const timeSlots = PERIODS.map(p => `${p.start_time}-${p.end_time}`) as unknown as readonly string[];

const dayLabelToValue: Record<string, string> = {
  "จ": "จันทร์", "จันทร์": "จันทร์", "mon": "จันทร์", "monday": "จันทร์",
  "อ": "อังคาร", "อังคาร": "อังคาร", "tue": "อังคาร", "tuesday": "อังคาร",
  "พุธ": "พุธ", "wed": "พุธ", "wednesday": "พุธ",
  "พฤ": "พฤหัสบดี", "พฤหัส": "พฤหัสบดี", "พฤหัสบดี": "พฤหัสบดี", "thu": "พฤหัสบดี", "thursday": "พฤหัสบดี",
  "ศ": "ศุกร์", "ศุกร์": "ศุกร์", "fri": "ศุกร์", "friday": "ศุกร์",
};
function withinGridTime(token: string) {
  const n = Number(token.replace(/[^0-9]/g, ""));
  if (n >= 1 && n <= timeSlots.length) return timeSlots[n - 1];
  const normalized = token.trim();
  return (timeSlots as readonly string[]).includes(normalized) ? normalized : "";
}
function dayToNumber(label: string): number | null {
  const idx = days.indexOf(label as any);
  return idx >= 0 ? idx + 1 : null;
}
function numberToDay(n?: number | null): string | undefined {
  if (n == null) return undefined;
  return days[n - 1];
}
function slotToPeriod(slot: string): number | null {
  const i = (timeSlots as readonly string[]).indexOf(slot);
  return i >= 0 ? i + 1 : null;
}
/** canonicalize label ให้ตรงหัวตาราง แม้ API ส่งเวลาไม่ตรงเป๊ะ */
function periodToSlot(p?: number | null, _start?: string | null, _end?: string | null): string | undefined {
  if (!p) return undefined;
  const found = PERIODS.find(x => x.period_number === p);
  return found ? `${found.start_time}-${found.end_time}` : undefined;
}

/* ===== Page ===== */
export default function SchedulePage() {
  /* ---------- Master data ---------- */
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const allGrades = useMemo(() => Array.from(new Set(levels.map(l => l.level_name))).filter(Boolean), [levels]);
  const allSubjects = useMemo(() => Array.from(new Set(subjects.map(s => s.subject_name))).filter(Boolean), [subjects]);

  /* ---------- Page state ---------- */
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // ✅ pagination (รายชื่อครู) — per page = 10
  const TEACHER_PAGE_SIZE = 10;
  const [teacherPage, setTeacherPage] = useState(1);

  /* ---------- Modal: view schedule ---------- */
  const [openView, setOpenView] = useState(false);
  const [viewTeacher, setViewTeacher] = useState<{ teacher_id: string; teacher_name: string; user_id: string }>({
    teacher_id: "", teacher_name: "", user_id: ""
  });
  const [viewSchedules, setViewSchedules] = useState<TeachingSchedule[]>([]);
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");

  /* ---------- Modals: add/edit ---------- */
  const [openEdit, setOpenEdit] = useState(false);
  const [editingRow, setEditingRow] = useState<TeachingSchedule | null>(null);
  const [form, setForm] = useState<TeachingSchedule>({});
  const quickRef = useRef<HTMLInputElement>(null);
  const [quick, setQuick] = useState("");

  /* ---------- Load Master ---------- */
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoadingAll(true); setLoadErrors([]);
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(TEACHERS_API_LIST, { cache: "no-store" }).then(r => r.json()),
          fetch(SUBJECTS_API,      { cache: "no-store" }).then(r => r.json()),
          fetch(CLASSROOMS_API,    { cache: "no-store" }).then(r => r.json()),
          fetch(LEVEL_API,         { cache: "no-store" }).then(r => r.json()),
        ]);
        if (cancelled) return;

        // Teachers
        const rawT: TeacherRow[] =
          Array.isArray(r1?.teacher) ? r1.teacher :
          Array.isArray(r1?.teachers) ? r1.teachers : [];
        const tList: TeacherItem[] = rawT
          .filter(t => t.teacher_id)
          .map(t => ({
            teacher_id: String(t.teacher_id),
            teacher_name: [t.user_id?.prename, t.user_id?.name, t.user_id?.surname].filter(Boolean).join(" ").trim()
          }));
        setTeachers(tList);

        // Subjects
        const rawS = Array.isArray(r2?.subjects) ? r2.subjects : Array.isArray(r2?.data) ? r2.data : [];
        setSubjects(rawS.map((s: any) => ({
          subject_id: s.subject_id ?? s.id ?? s.code ?? s.subjectCode ?? "",
          subject_name: s.subject_name ?? s.name ?? s.subjectName ?? "",
        })).filter((s: Subject) => s.subject_name));

        // Classrooms
        const rawC = Array.isArray(r3?.classroom) ? r3.classroom : Array.isArray(r3?.classrooms) ? r3.classrooms : [];
        setClassrooms(rawC.map((c: any) => ({
          classroom_id: c.classroom_id ?? c.id ?? "",
          classroom_name: c.classroom_name ?? c.name ?? "",
          level_name: c.classroom_level?.level_name ?? c.level_name ?? "",
        })));

        // Levels
        const rawL = Array.isArray(r4?.levels) ? r4.levels : Array.isArray(r4?.data) ? r4.data : [];
        setLevels(rawL.map((lv: any) => ({
          level_id: lv.level_id ?? lv.id ?? "",
          level_name: lv.level_name ?? lv.name ?? "",
        })).filter((lv: Level) => lv.level_name));
      } catch (e: any) {
        setLoadErrors(prev => [...prev, e?.message || "โหลดข้อมูลไม่สำเร็จ"]);
      } finally {
        setLoadingAll(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  /* ---------- Helpers ---------- */
  async function getUserIdByTeacherId(teacher_id: string): Promise<{user_id: string, name: string}> {
    const res = await fetch(TEACHER_DETAIL_API(teacher_id), { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "โหลดข้อมูลครูไม่สำเร็จ");
    const name = [j?.teacher?.user_id?.prename, j?.teacher?.user_id?.name, j?.teacher?.user_id?.surname].filter(Boolean).join(" ").trim();
    return { user_id: j?.teacher?.user_id?.user_id, name };
  }

  async function fetchSchedules(user_id: string, teacher_name: string) {
    const res = await fetch(SCHEDULE_API(user_id), { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "โหลดตารางสอนไม่สำเร็จ");
    const rows: any[] = Array.isArray(j?.schedules) ? j.schedules : [];

    const list = rows
      .filter(r => r?.day_of_week != null && r?.period_number != null)
      .map(r => ({
        teaching_schedule_id: r.teaching_schedule_id,
        schedule_id: String(r.teaching_schedule_id ?? uid()),
        teacher_name,
        subject: r.subject?.subject_name ?? r.subject_name ?? "",
        classroom: r.classroom?.classroom_name ?? r.classroom_name ?? "",
        grade_level: r.classroom?.classroom_level?.level_name ?? r.level_name ?? "",
        day: numberToDay(Number(r.day_of_week)) || undefined,
        time_slot: periodToSlot(r.period_number, r.start_time, r.end_time),
      } as TeachingSchedule))
      .filter(x => x.day && x.time_slot);
    return list;
  }

  function findSubjectIdByName(name?: string) {
    if (!name) return null;
    const found = subjects.find(s => s.subject_name.trim().toLowerCase() === name.trim().toLowerCase());
    return found?.subject_id ?? null;
  }
  function findClassroomIdByName(name?: string) {
    if (!name) return null;
    const found = classrooms.find(c => c.classroom_name.trim().toLowerCase() === name.trim().toLowerCase());
    return found?.classroom_id ?? null;
  }

  /* ---------- Open Modal (view) ---------- */
  async function openTeacherScheduleModal(teacher: TeacherItem) {
    try {
      const { user_id, name } = await getUserIdByTeacherId(teacher.teacher_id);
      setViewTeacher({ teacher_id: teacher.teacher_id, teacher_name: teacher.teacher_name || name, user_id });
      const list = await fetchSchedules(user_id, teacher.teacher_name || name);
      setViewSchedules(list);
      setFilterGrade("all"); setFilterSubject("all");
      setOpenView(true);
    } catch (e: any) {
      alert(e?.message || "เปิดตารางสอนไม่สำเร็จ");
    }
  }

  /* ---------- Add / Edit / Delete ---------- */
  async function createOrUpdateSchedule(newRow: TeachingSchedule, isEdit = false, oldRow?: TeachingSchedule) {
    if (!viewTeacher.user_id) return;
    const dayNum = dayToNumber(newRow.day || "");  const periodNum = slotToPeriod(newRow.time_slot || "");
    if (!dayNum || !periodNum) { alert("วัน/คาบไม่ถูกต้อง"); return; }

    const found = PERIODS.find(p => p.period_number === periodNum);
    const payload = {
      day_of_week: dayNum,
      period_number: periodNum,
      start_time: found?.start_time || null,
      end_time:   found?.end_time || null,
      subject_id: findSubjectIdByName(newRow.subject) ?? null,
      classroom_id: findClassroomIdByName(newRow.classroom) ?? null,
    };

    try {
      if (isEdit && oldRow?.teaching_schedule_id) {
        await fetch(`${SCHEDULE_API(viewTeacher.user_id)}?teaching_schedule_id=${oldRow.teaching_schedule_id}`, {
          method: "DELETE",
        });
      }
      const res = await fetch(SCHEDULE_API(viewTeacher.user_id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "บันทึกไม่สำเร็จ");

      const list = await fetchSchedules(viewTeacher.user_id, viewTeacher.teacher_name);
      setViewSchedules(list);
      setOpenEdit(false); setEditingRow(null);
    } catch (e: any) {
      alert(e?.message || "บันทึกไม่สำเร็จ");
    }
  }

  async function deleteOne(row: TeachingSchedule) {
    if (!viewTeacher.user_id || !row?.teaching_schedule_id) return;
    if (!confirm("ลบคาบนี้ใช่ไหม?")) return;
    try {
      const res = await fetch(`${SCHEDULE_API(viewTeacher.user_id)}?teaching_schedule_id=${row.teaching_schedule_id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "ลบไม่สำเร็จ");
      const list = await fetchSchedules(viewTeacher.user_id, viewTeacher.teacher_name);
      setViewSchedules(list);
    } catch (e: any) {
      alert(e?.message || "ลบไม่สำเร็จ");
    }
  }

  async function deleteAllForTeacher() {
    if (!viewTeacher.user_id) return;
    if (!confirm(`ลบตารางทั้งหมดของ ${viewTeacher.teacher_name} ใช่ไหม?`)) return;
    try {
      const res = await fetch(`${SCHEDULE_API(viewTeacher.user_id)}?all=true`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "ลบทั้งหมดไม่สำเร็จ");
      setViewSchedules([]);
    } catch (e: any) {
      alert(e?.message || "ลบทั้งหมดไม่สำเร็จ");
    }
  }

  /* ---------- Quick add (ใน modal) ---------- */
  function parseQuick(text: string) {
    // รูปแบบ: วัน คาบ/เวลา วิชา [ชั้น] [ห้อง]
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) return { error: "รูปแบบ: วัน คาบ/เวลา วิชา [ชั้น] [ห้อง]" } as const;
    const [dayToken, periodToken, ...rest] = parts;
    const day =
      dayLabelToValue[dayToken.toLowerCase()] ||
      dayLabelToValue[Object.keys(dayLabelToValue).find(k => k.toLowerCase() === dayToken.toLowerCase()) || ""];
    if (!day) return { error: "วันไม่ถูกต้อง" } as const;

    const time_slot = withinGridTime(periodToken) || periodToken;
    if (!(timeSlots as readonly string[]).includes(time_slot)) return { error: "คาบ/เวลาไม่ถูกต้อง" } as const;

    const subject = (rest[0] || "").replaceAll("_", " ");
    if (!subject) return { error: "กรอกรายวิชา" } as const;
    const grade_level = rest[1] ? rest[1].replaceAll("_", " ") : undefined;
    const classroom   = rest[2] ? rest[2].replaceAll("_", " ") : undefined;

    return { day, time_slot, subject, grade_level, classroom } as const;
  }
  async function onQuickSubmit() {
    const p = parseQuick(quick);
    if ("error" in p) { alert(p.error); return; }
    await createOrUpdateSchedule({ ...p, teacher_name: viewTeacher.teacher_name }, false);
    setQuick("");
  }

  /* ---------- Derived: filtered schedules in modal ---------- */
  const filteredSchedules = useMemo(() => {
    let arr = [...viewSchedules];
    if (filterGrade !== "all") arr = arr.filter(x => x.grade_level === filterGrade);
    if (filterSubject !== "all") arr = arr.filter(x => x.subject === filterSubject);
    return arr;
  }, [viewSchedules, filterGrade, filterSubject]);

  /* ---------- UI ---------- */
  const shownTeachers = useMemo(
    () => teachers.filter(t => t.teacher_name.toLowerCase().includes(search.toLowerCase())),
    [teachers, search]
  );

  // ✅ slice ตามหน้า + reset หน้าเมื่อค้นหาเปลี่ยน
  useEffect(() => {
    setTeacherPage(1);
  }, [search, teachers.length]);

  const teacherTotalPages = Math.max(1, Math.ceil(shownTeachers.length / TEACHER_PAGE_SIZE));
  const teacherSafePage = Math.min(Math.max(1, teacherPage), teacherTotalPages);
  const teacherStart = (teacherSafePage - 1) * TEACHER_PAGE_SIZE;
  const teacherEnd = teacherStart + TEACHER_PAGE_SIZE;
  const teacherVisible = shownTeachers.slice(teacherStart, teacherEnd);

  // ความกว้างคอลัมน์ของ “ลิสต์ครู” (ลำดับ/ชื่อ/การจัดการ)
  const teacherColWidths = ["w-16", "w-[28rem]", "w-40"];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="w-full p-3 space-y-6 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">จัดการตารางสอน</h1>
            <p className="mt-1 text-sm text-gray-600">ลิสต์ครูทั้งหมด → ดูตารางใน Modal • เพิ่ม/แก้ไข/ลบคาบ • ลบทั้งตาราง</p>
          </div>
        </div>

        {/* Loading/Errors */}
        {loadingAll && <div className="px-3 py-2 text-sm border rounded-lg bg-gray-50">กำลังโหลดข้อมูล…</div>}
        {loadErrors.length > 0 && (
          <div className="px-3 py-2 text-sm border rounded-lg border-amber-200 bg-amber-50 text-amber-800">
            โหลดข้อมูลบางส่วนไม่สำเร็จ: {loadErrors.join(" | ")}
          </div>
        )}

        {/* Teacher list + search (COMPACT + PAGINATION) */}
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่ออาจารย์…"
              className="w-full h-10 px-3 border rounded-lg sm:w-80"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[13px]">
              <colgroup>
                {teacherColWidths.map((w) => (
                  <col key={w} className={w} />
                ))}
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr className="text-gray-600 uppercase">
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ลำดับ</th>
                  <th className="px-4 py-2 text-left text-[11px] tracking-wide">ชื่ออาจารย์</th>
                  <th className="px-4 py-2 text-center text-[11px] tracking-wide">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teacherVisible.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                      ไม่พบอาจารย์
                    </td>
                  </tr>
                ) : (
                  teacherVisible.map((t, idx) => (
                    <tr key={t.teacher_id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span className="font-medium text-gray-900">
                          {teacherStart + idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-gray-900 truncate">{t.teacher_name}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <button
                            onClick={() => openTeacherScheduleModal(t)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] text-white hover:bg-blue-700"
                          >
                            ดูตาราง
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {teacherTotalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  หน้า {teacherSafePage} จาก {teacherTotalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setTeacherPage(teacherSafePage - 1)}
                    disabled={teacherSafePage === 1}
                    className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">
                    {teacherSafePage}
                  </span>
                  <button
                    onClick={() => setTeacherPage(teacherSafePage + 1)}
                    disabled={teacherSafePage === teacherTotalPages}
                    className="p-2 text-gray-500 rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal: View schedule per teacher (เดิม) */}
        {openView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpenView(false)} />
            <div className="relative w-full max-w-5xl bg-white shadow-xl rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">ตารางสอน: {viewTeacher.teacher_name}</h3>
                  <div className="text-xs text-gray-500">user_id: {viewTeacher.user_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setOpenEdit(true); setEditingRow(null); setForm({ time_slot: timeSlots[0], day: days[0], teacher_name: viewTeacher.teacher_name }); }}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white"
                  >
                    + เพิ่มคาบ
                  </button>
                  <button
                    onClick={deleteAllForTeacher}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                  >
                    ลบทั้งตาราง
                  </button>
                  <button onClick={() => setOpenView(false)} className="rounded-lg border px-3 py-1.5 text-sm">ปิด</button>
                </div>
              </div>

              {/* Filters + Quick add */}
              <div className="p-4 border-b">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block mb-1 text-sm font-medium">ชั้นเรียน</label>
                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full h-10 px-3 border rounded-lg">
                      <option value="all">ทุกชั้นเรียน</option>
                      {allGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">รายวิชา</label>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="w-full h-10 px-3 border rounded-lg">
                      <option value="all">ทุกรายวิชา</option>
                      {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">Quick-add</label>
                    <div className="flex gap-2">
                      <input
                        ref={quickRef}
                        value={quick}
                        onChange={e => setQuick(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && onQuickSubmit()}
                        placeholder="วัน คาบ/เวลา วิชา [ชั้น] [ห้อง]"
                        className="flex-1 h-10 px-3 border rounded-lg"
                      />
                      <button onClick={onQuickSubmit} className="h-10 px-3 text-white bg-blue-600 rounded-lg">เพิ่ม</button>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">ตัวอย่าง: จันทร์ 1 ภาษาไทย ป.1 ห้อง101</div>
                  </div>
                </div>
              </div>

              {/* Schedule grid */}
              <div className="max-h-[70vh] overflow-auto p-4">
                <div className="min-w-full" style={{ minWidth: "900px" }}>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="sticky left-0 z-10 px-3 py-3 text-xs font-semibold text-center text-gray-700 border-r min-w-20 bg-gray-50">วัน/เวลา</th>
                        {timeSlots.map(slot => (
                          <th key={slot} className="px-2 py-3 text-xs font-semibold text-center text-gray-700 border-r min-w-32">
                            <div className="whitespace-nowrap">{slot}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map(d => (
                        <tr key={d} className="border-b">
                          <td className="sticky left-0 z-10 px-3 py-3 font-medium text-gray-900 border-r bg-gray-50">{d}</td>
                          {timeSlots.map(slot => {
                            const slotRows = filteredSchedules.filter(x => x.day === d && x.time_slot === slot);
                            const clash = slotRows.length > 1;
                            return (
                              <td key={`${d}-${slot}`} className="px-2 py-3 align-top border-r">
                                {slotRows.length === 0 ? (
                                  <div className="p-3 text-xs text-center text-gray-400 border border-dashed rounded-lg">
                                    ว่าง
                                  </div>
                                ) : (
                                  <div className={`space-y-2 ${clash ? "bg-red-50 p-2 rounded-lg" : ""}`}>
                                    {clash && <div className="text-xs font-semibold text-red-600">⚠️ ซ้อนทับ {slotRows.length} รายการ</div>}
                                    {slotRows.map(row => (
                                      <div key={String(row.teaching_schedule_id ?? row.schedule_id)} className="p-2 text-xs bg-white border rounded-lg">
                                        <div className="font-semibold text-gray-800">{row.subject}</div>
                                        <div className="text-gray-700">ห้อง {row.classroom || "-"}</div>
                                        <div className="text-gray-600">{row.grade_level || "ส่วนรวม"}</div>
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() => { setEditingRow(row); setForm({ ...row }); setOpenEdit(true); }}
                                            className="px-2 py-1 border rounded"
                                          >
                                            แก้ไข
                                          </button>
                                          <button
                                            onClick={() => deleteOne(row)}
                                            className="px-2 py-1 text-red-700 border border-red-300 rounded bg-red-50"
                                          >
                                            ลบคาบนี้
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal: Add/Edit row */}
        {openEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setOpenEdit(false); setEditingRow(null); }} />
            <div className="relative w-full max-w-xl bg-white shadow-xl rounded-2xl">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">{editingRow ? "แก้ไขคาบ" : "เพิ่มคาบ"}</h3>
                <button onClick={() => { setOpenEdit(false); setEditingRow(null); }} className="px-3 py-1 text-sm border rounded-lg">ปิด</button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">วัน *</label>
                  <select
                    value={form.day || days[0]}
                    onChange={e => setForm(p => ({ ...p, day: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">คาบ/เวลา *</label>
                  <select
                    value={form.time_slot || timeSlots[0]}
                    onChange={e => setForm(p => ({ ...p, time_slot: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">รายวิชา *</label>
                  <input
                    value={form.subject || ""}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="เช่น ภาษาไทย"
                  />
                  <div className="mt-1 text-xs text-gray-500">* ระบบจะจับคู่ชื่อวิชากับ subject_id อัตโนมัติตอนบันทึก</div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-sm font-medium">ชั้นเรียน</label>
                    <input
                      value={form.grade_level || ""}
                      onChange={e => setForm(p => ({ ...p, grade_level: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="เช่น ป.2 (ว่างได้)"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium">ห้องเรียน</label>
                    <input
                      value={form.classroom || ""}
                      onChange={e => setForm(p => ({ ...p, classroom: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="เช่น 101 (ว่างได้)"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => { setOpenEdit(false); setEditingRow(null); }} className="px-4 py-2 border rounded-lg">ยกเลิก</button>
                  <button
                    onClick={() => createOrUpdateSchedule(form as TeachingSchedule, !!editingRow, editingRow || undefined)}
                    className="px-4 py-2 text-white bg-purple-600 rounded-lg"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
