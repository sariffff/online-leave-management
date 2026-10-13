"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import Pagination from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { DAY_NAMES } from "@/lib/periods";
import { usePublicSettings } from "@/components/shell/SettingsContext";

type Teacher = { teacher_id: number; user_id: string; name: string; subject_group_name: string | null };
type Slot = {
  teaching_schedule_id: number;
  day_of_week: number;
  period_number: number;
  subject_id: number | null;
  subject_name: string;
  classroom_id: number | null;
  classroom_name: string;
  level_name: string;
};
type Subject = { subject_id: number; subject_code: string; subject_name: string };
type Classroom = { classroom_id: number; classroom_name: string; level_name: string | null };

const PAGE_SIZE = 10;
const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

export default function ScheduleManagementPage() {
  // คาบเรียนจากการตั้งค่าระบบ
  const PERIODS = usePublicSettings().periods.periods;
  const confirm = useConfirm();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");

  const [editing, setEditing] = useState<{ slot: Slot | null } | null>(null);
  const [form, setForm] = useState({ day: "1", period: "1", subject_id: "", classroom_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: Teacher[] }>("/api/admin/schedule/teacher"),
      apiFetch<{ items: Subject[] }>("/api/admin/subjectmanagement/subject"),
      apiFetch<{ items: Classroom[] }>("/api/admin/classroommanagement"),
    ])
      .then(([t, s, c]) => {
        setTeachers(t.items);
        setSubjects(s.items);
        setClassrooms(c.items);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadSlots = useCallback(async (t: Teacher) => {
    setSlotsLoading(true);
    try {
      setSlots((await apiFetch<{ schedules: Slot[] }>(`/api/admin/schedule/table/${t.user_id}`)).schedules);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลดตารางสอนไม่สำเร็จ");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  function openTeacher(t: Teacher) {
    setTeacher(t);
    setFilterSubject("all");
    setSlots([]);
    loadSlots(t);
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? teachers.filter((t) => t.name.toLowerCase().includes(q)) : teachers;
  }, [teachers, search]);
  useEffect(() => setPage(1), [search]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  const subjectNames = useMemo(() => [...new Set(slots.map((s) => s.subject_name).filter(Boolean))], [slots]);
  const visibleSlots = filterSubject === "all" ? slots : slots.filter((s) => s.subject_name === filterSubject);

  /** preset: กดช่องว่างในตาราง → ตั้งวัน/คาบให้ */
  function openForm(slot: Slot | null, preset?: { day: number; period: number }) {
    setForm({
      day: String(slot?.day_of_week ?? preset?.day ?? 1),
      period: String(slot?.period_number ?? preset?.period ?? 1),
      subject_id: slot?.subject_id ? String(slot.subject_id) : "",
      classroom_id: slot?.classroom_id ? String(slot.classroom_id) : "",
    });
    setEditing({ slot });
  }

  async function save() {
    if (!teacher || !editing) return;
    const p = PERIODS.find((x) => x.period_number === Number(form.period));
    const body = {
      day_of_week: Number(form.day),
      period_number: Number(form.period),
      start_time: p?.start_time ?? null,
      end_time: p?.end_time ?? null,
      subject_id: form.subject_id ? Number(form.subject_id) : null,
      classroom_id: form.classroom_id ? Number(form.classroom_id) : null,
    };
    setSaving(true);
    try {
      const base = `/api/admin/schedule/table/${teacher.user_id}`;
      if (editing.slot) await apiFetch(`${base}?teaching_schedule_id=${editing.slot.teaching_schedule_id}`, { method: "PATCH", json: body });
      else await apiFetch(base, { method: "POST", json: body });
      toast.success("บันทึกเรียบร้อย");
      setEditing(null);
      loadSlots(teacher);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(slot: Slot) {
    if (!teacher) return;
    if (!(await confirm({ title: `ลบคาบ ${slot.period_number} ใช่ไหม?`, confirmLabel: "ลบ", danger: true }))) return;
    try {
      await apiFetch(`/api/admin/schedule/table/${teacher.user_id}?teaching_schedule_id=${slot.teaching_schedule_id}`, { method: "DELETE" });
      loadSlots(teacher);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function removeAll() {
    if (!teacher) return;
    if (!(await confirm({ title: `ลบตารางสอนทั้งหมดของ ${teacher.name}?`, description: "ลบทุกคาบของครูท่านนี้ ย้อนกลับไม่ได้", confirmLabel: "ลบทั้งหมด", danger: true }))) return;
    try {
      await apiFetch(`/api/admin/schedule/table/${teacher.user_id}?all=true`, { method: "DELETE" });
      setSlots([]);
      toast.success("ลบตารางสอนทั้งหมดแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <PageContainer>
      <PageHeader title="จัดการตารางสอน" description="เลือกครู → ดูตาราง • กดช่อง &quot;ว่าง&quot; เพื่อเพิ่มคาบ • แก้ไข/ลบคาบ • ลบทั้งตาราง" />

        {loadError && <div className="px-3 py-2 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{loadError}</div>}

        {/* รายชื่ออาจารย์ — เลือกแล้วแสดงตารางสอนในหน้าเดียวกัน (ไม่ซ้อน dialog) */}
        {!teacher && (
        <div className="overflow-hidden bg-white border shadow-sm rounded-xl">
          <div className="p-3 border-b sm:p-4">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่ออาจารย์…" aria-label="ค้นหาอาจารย์" className="h-10 sm:w-80" />
          </div>
          {/* มือถือ: รายชื่อแบบการ์ด */}
          <ul className="divide-y md:hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-4"><div className="h-12 bg-gray-100 rounded animate-pulse" /></li>)
            ) : shown.length === 0 ? (
              <li className="px-4 py-10 text-center text-gray-500">ไม่พบอาจารย์</li>
            ) : (
              shown.slice(start, start + PAGE_SIZE).map((t) => (
                <li key={t.teacher_id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.subject_group_name ?? "-"}</div>
                  </div>
                  <Button size="sm" className="h-10 text-white bg-blue-600 shrink-0 hover:bg-blue-700" onClick={() => openTeacher(t)}>ดูตาราง</Button>
                </li>
              ))
            )}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr className="text-gray-600 uppercase">
                <th className="px-4 py-2 text-left text-[11px] w-16">ลำดับ</th>
                <th className="px-4 py-2 text-left text-[11px]">ชื่ออาจารย์</th>
                <th className="px-4 py-2 text-left text-[11px]">กลุ่มสาระ</th>
                <th className="px-4 py-2 text-center text-[11px] w-40">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>)
              ) : shown.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">ไม่พบอาจารย์</td></tr>
              ) : (
                shown.slice(start, start + PAGE_SIZE).map((t, i) => (
                  <tr key={t.teacher_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{start + i + 1}</td>
                    <td className="px-4 py-2">{t.name}</td>
                    <td className="px-4 py-2 text-gray-600">{t.subject_group_name ?? "-"}</td>
                    <td className="px-4 py-2 text-center">
                      <Button size="sm" className="h-8 text-white bg-blue-600 hover:bg-blue-700" onClick={() => openTeacher(t)}>ดูตาราง</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} total={shown.length} />
        </div>
        )}

      {/* ตารางสอนรายครู */}
      {teacher && (
        <section className="p-3 space-y-4 bg-white border shadow-sm sm:p-4 rounded-xl" aria-label={`ตารางสอนของ ${teacher.name}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button variant="outline" className="h-10" onClick={() => setTeacher(null)}>
              ← รายชื่ออาจารย์
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">ตารางสอน: {teacher.name}</h2>
              <p className="text-xs text-gray-500">{teacher.subject_group_name ?? "ไม่มีกลุ่มสาระ"} · {slots.length} คาบ</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="กรองรายวิชา" className={`${selectCls} h-10 sm:w-64`} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="all">ทุกรายวิชา</option>
              {subjectNames.map((n) => <option key={n}>{n}</option>)}
            </select>
            <div className="hidden flex-1 sm:block" />
            <Button className="flex-1 h-10 text-white bg-purple-600 sm:flex-none hover:bg-purple-700" onClick={() => openForm(null)}>+ เพิ่มคาบ</Button>
            <Button variant="outline" className="flex-1 h-10 text-red-700 border-red-300 sm:flex-none hover:bg-red-50" onClick={removeAll} disabled={slots.length === 0}>ลบทั้งตาราง</Button>
          </div>

          {/* มือถือ: รายการตามวัน */}
          <div className="space-y-3 md:hidden">
            {DAY_NAMES.map((day, di) => {
              const items = visibleSlots.filter((s) => s.day_of_week === di + 1).sort((a, b) => a.period_number - b.period_number);
              return (
                <div key={day} className="border rounded-lg">
                  <div className="px-3 py-2 text-sm font-semibold border-b bg-gray-50">วัน{day}</div>
                  {slotsLoading ? (
                    <div className="h-10 m-3 bg-gray-100 rounded animate-pulse" />
                  ) : items.length === 0 ? (
                    <button type="button" onClick={() => openForm(null, { day: di + 1, period: 1 })} className="w-full px-3 py-3 text-sm text-left text-gray-400 hover:text-purple-700">
                      ไม่มีคาบสอน · + เพิ่มคาบ
                    </button>
                  ) : (
                    <ul className="divide-y">
                      {items.map((s) => (
                        <li key={s.teaching_schedule_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <div className="font-semibold w-14 shrink-0">คาบ {s.period_number}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{s.subject_name || "-"}</div>
                            <div className="text-gray-600 truncate">ห้อง {s.classroom_name || "-"}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-9" onClick={() => openForm(s)}>แก้ไข</Button>
                            <Button size="sm" variant="outline" className="text-red-700 border-red-300 h-9" onClick={() => remove(s)}>ลบ</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse" style={{ minWidth: 800 }}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-3 text-xs font-semibold text-center border-r">วัน / คาบ</th>
                  {PERIODS.map((p) => (
                    <th key={p.period_number} className="px-2 py-3 text-xs font-semibold text-center border-r">
                      คาบ {p.period_number}
                      <div className="font-normal text-gray-500">{p.start_time}-{p.end_time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((day, di) => (
                  <tr key={day} className="border-b">
                    <td className="px-3 py-3 font-medium border-r bg-gray-50">{day}</td>
                    {PERIODS.map((p) => {
                      const cell = visibleSlots.filter((s) => s.day_of_week === di + 1 && s.period_number === p.period_number);
                      return (
                        <td key={p.period_number} className="px-2 py-2 align-top border-r">
                          {slotsLoading ? (
                            <div className="h-10 bg-gray-100 rounded animate-pulse" />
                          ) : cell.length === 0 ? (
                            <button
                              type="button"
                              aria-label={`เพิ่มคาบ ${p.period_number} วัน${day}`}
                              onClick={() => openForm(null, { day: di + 1, period: p.period_number })}
                              className="w-full p-2 text-xs text-center text-gray-400 border border-dashed rounded-lg hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700"
                            >
                              ว่าง <span className="hidden lg:inline">+ เพิ่ม</span>
                            </button>
                          ) : (
                            cell.map((s) => (
                              <div key={s.teaching_schedule_id} className="p-2 mb-1 text-xs bg-white border rounded-lg">
                                <div className="font-semibold text-gray-800">{s.subject_name || "-"}</div>
                                <div className="text-gray-700">ห้อง {s.classroom_name || "-"}</div>
                                <div className="text-gray-500">{s.level_name || "ส่วนรวม"}</div>
                                <div className="flex gap-1 mt-2">
                                  <button onClick={() => openForm(s)} className="px-2 py-0.5 border rounded hover:bg-gray-50">แก้ไข</button>
                                  <button onClick={() => remove(s)} className="px-2 py-0.5 text-red-700 border border-red-300 rounded bg-red-50 hover:bg-red-100">ลบ</button>
                                </div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* เพิ่ม/แก้ไขคาบ */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.slot ? "แก้ไขคาบ" : "เพิ่มคาบ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วัน</Label>
                <select aria-label="วัน" className={`${selectCls} h-10`} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                  {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </select>
              </div>
              <div>
                <Label>คาบ</Label>
                <select aria-label="คาบ" className={`${selectCls} h-10`} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                  {PERIODS.map((p) => <option key={p.period_number} value={p.period_number}>คาบ {p.period_number} ({p.start_time}-{p.end_time})</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>รายวิชา</Label>
              <select aria-label="รายวิชา" className={`${selectCls} h-10`} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject_code} {s.subject_name}</option>)}
              </select>
            </div>
            <div>
              <Label>ห้องเรียน</Label>
              <select aria-label="ห้องเรียน" className={`${selectCls} h-10`} value={form.classroom_id} onChange={(e) => setForm({ ...form, classroom_id: e.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {classrooms.map((c) => <option key={c.classroom_id} value={c.classroom_id}>{c.classroom_name}{c.level_name ? ` (${c.level_name})` : ""}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving} className="bg-purple-600 hover:bg-purple-700">{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
