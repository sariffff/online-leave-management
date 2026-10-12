// components/academic/modals/PlanSubstituteModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AssignSubstituteModal from "@/components/academic/modals/AssignSubstituteModal";

type DaySlot = {
  period: number;
  time: string;
  subject?: string;
  room?: string;
  teachingScheduleId?: number | string | null;
  hasSubstitute?: boolean | null;
};
type DaySchedule = { date: string; weekdayLabel?: string; slots: DaySlot[] };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leaveId: string;
  teacherName: string;
  subjectGroup?: string;
  dateRange: { start: string; end: string };
};

function thaiFullDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const month = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const weekday = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  return { label: `${d.getDate()} ${month[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`, weekday: weekday[d.getDay()] };
}

const fallbackTime: Record<number, string> = {
  1: "08:00 - 09:00 น.",
  2: "09:00 - 10:00 น.",
  3: "10:00 - 11:00 น.",
  4: "11:00 - 12:00 น.",
  5: "13:00 - 14:00 น.",
  6: "14:00 - 15:00 น.",
  7: "15:00 - 16:00 น.",
};

export default function PlanSubstituteModal({
  open, onOpenChange, leaveId, teacherName, subjectGroup, dateRange,
}: Props) {
  const [days, setDays] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [takenMap, setTakenMap] = useState<Map<string, { name?: string | null }>>(new Map());
  const [missing, setMissing] = useState<Array<{ date: string; tsId: number; period?: number | null }>>([]);

  const [pickOpen, setPickOpen] = useState(false);
  const [pickContext, setPickContext] = useState<{ date: string; slot: DaySlot } | null>(null);

  const [assignments, setAssignments] = useState<Record<string, { primary?: string; cross?: string }>>({});

  const keyOf = (dateISO: string, period: number) => `${dateISO}-${period}`;
  const keyTaken = (dateISO: string, teachingScheduleId?: number | string | null) =>
    `${dateISO}|${teachingScheduleId ?? ""}`;
  const keyTakenFallback = (dateISO: string, period: number) => `${dateISO}#p${period}`;

  const titleRange = useMemo(() => {
    const s = thaiFullDate(dateRange.start).label;
    const e = thaiFullDate(dateRange.end).label;
    return dateRange.start === dateRange.end ? s : `${s} - ${e}`;
  }, [dateRange.start, dateRange.end]);

  const isFullyCovered = useMemo(() => {
    if (!days.length) return false;
    for (const d of days) {
      for (const s of d.slots || []) {
        const k1 = keyTaken(d.date, s.teachingScheduleId);
        const k2 = keyTakenFallback(d.date, s.period);
        if (!(takenMap.has(k1) || takenMap.has(k2))) return false;
      }
    }
    return true;
  }, [days, takenMap]);

  // โหลดตารางและสถานะที่ถูกมอบหมาย (รวมทั้งดึง missing จาก complete API)
  useEffect(() => {
    if (!open || !leaveId) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true); setErr(null); setMissing([]);

        // 1) ตารางคาบของผู้ลา
        const qs = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
        const url = `/api/academic/leaves/${leaveId}?` + qs.toString();
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        const j: any = await res.json();
        if (!res.ok || j?.error) throw new Error(j?.error || "โหลดตารางไม่สำเร็จ");

        const sch = Array.isArray(j.schedule) ? j.schedule : [];
        const normalized: DaySchedule[] = sch.map((d: any) => ({
          date: d.date,
          slots: (d.slots || []).map((s: any) => {
            const subject =
              s.subject ?? s.subjectName ?? s.subject_title ?? (s.subjectId ? `วิชา #${s.subjectId}` : "-");

            const room =
              s.room ?? s.classroomName ?? (s.classroomId ? `ห้อง #${s.classroomId}` : "-");

            const pd = Number(s.period);
            const time = s.time || fallbackTime[pd] || "";

            return {
              period: pd,
              time,
              subject,
              room,
              teachingScheduleId: s.teachingScheduleId ?? s.teaching_schedule_id ?? null,
              hasSubstitute: s.hasSubstitute ?? s.has_substitute ?? null,
            } as DaySlot;
          }),
        }));
        setDays(normalized);

        // 2) เรียก complete(GET) เพื่อรู้ว่า missing อะไรบ้าง
        try {
          const rC = await fetch(`/api/academic/leaves/${leaveId}/complete`, { cache: "no-store", signal: controller.signal });
          const jC = await rC.json();
          if (rC.ok && jC?.details?.missing) setMissing(jC.details.missing as typeof missing);
        } catch {}

        // 3) สร้าง takenMap จาก substitutions endpoint ถ้ามี
        const tsIds = Array.from(
          new Set(
            normalized
              .flatMap((d) => d.slots)
              .map((s) => s.teachingScheduleId)
              .filter((v) => v !== null && v !== undefined)
          )
        ) as Array<number | string>;
        const tsCsv = tsIds.join(",");
        const nextTaken = new Map<string, { name?: string | null }>();

        try {
          const qs2 = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
          if (tsCsv) qs2.set("ts", tsCsv);
          const url2 = `/api/academic/substitutions?` + qs2.toString();
          const r2 = await fetch(url2, { cache: "no-store", signal: controller.signal });
          const j2 = await r2.json();
          if (!r2.ok || j2?.error) throw new Error(j2?.error || "โหลดรายการสอนแทนไม่สำเร็จ");

          const list: any[] = Array.isArray(j2.substitutions) ? j2.substitutions : [];
          for (const row of list) {
            const date = String(row.date);
            const tsId = row.teaching_schedule_id ?? null;
            if (tsId != null) nextTaken.set(keyTaken(date, tsId), { name: row.substitute_name || null });
          }
        } catch {
          // ignore
        }

        // 4) fallback จาก flag hasSubstitute
        for (const d of normalized) {
          for (const s of d.slots || []) {
            if (s.hasSubstitute) {
              if (s.teachingScheduleId != null) nextTaken.set(keyTaken(d.date, s.teachingScheduleId), { name: null });
              else nextTaken.set(keyTakenFallback(d.date, s.period), { name: null });
            }
          }
        }

        setTakenMap(nextTaken);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "โหลดตารางไม่สำเร็จ");
        setDays([]); setTakenMap(new Map()); setMissing([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, leaveId, dateRange.start, dateRange.end]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-hidden">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>วางแผนสอนแทน:</span>
              <span className="font-semibold">{teacherName}</span>
              {subjectGroup && <Badge variant="secondary" className="ml-1">{subjectGroup}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-3 text-sm text-muted-foreground">
            ช่วงวันที่: <span className="font-medium">{titleRange}</span>
          </div>

          <div className="rounded-md border overflow-hidden h-[calc(80vh-12rem)]">
            <div className="w-full h-full overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left w-[26%] border-r">วันที่</th>
                    <th className="px-3 py-2 text-left w-[8%]">คาบ</th>
                    <th className="px-3 py-2 text-left w-[20%]">เวลา</th>
                    <th className="px-3 py-2 text-left w-[22%]">วิชา</th>
                    <th className="px-3 py-2 text-left w-[12%]">ห้อง</th>
                    <th className="px-3 py-2 text-left w-[12%]">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">กำลังโหลดตาราง...</td></tr>
                  )}

                  {!loading && err && (
                    <tr><td colSpan={6} className="py-6 text-center text-red-600">{err}</td></tr>
                  )}

                  {!loading && !err && days.map((d, dayIdx) => {
                    const { label, weekday } = thaiFullDate(d.date);
                    const slots = d.slots?.length ? d.slots : [];
                    return (
                      <React.Fragment key={d.date}>
                        {dayIdx > 0 && (<tr className="bg-muted/60"><td colSpan={6} className="h-2 border-y" /></tr>)}

                        {slots.length > 0 ? (
                          slots.map((s, idx) => {
                            const keyPrimary   = keyTaken(d.date, s.teachingScheduleId);
                            const keyFallback  = keyTakenFallback(d.date, s.period);
                            const already      = takenMap.get(keyPrimary) || takenMap.get(keyFallback);
                            const assigned     = assignments[keyOf(d.date, s.period)];

                            return (
                              <tr key={`${d.date}-${s.period}`} className="align-top hover:bg-muted/20">
                                <td className="px-3 py-2 border-r bg-muted/5">
                                  {idx === 0 ? (
                                    <div>
                                      <div className="font-semibold">{label}</div>
                                      <div className="text-xs text-muted-foreground mt-0.5">วัน{weekday}</div>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">คาบ {s.period}</td>
                                <td className="px-3 py-2">{s.time}</td>
                                <td className="px-3 py-2">{s.subject ?? "-"}</td>
                                <td className="px-3 py-2">{s.room ?? "-"}</td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        style={{ backgroundColor: "#2563eb", color: "white" }}
                                        onClick={() => { setPickContext({ date: d.date, slot: s }); setPickOpen(true); }}
                                        disabled={!!already}
                                        title={already ? "มีการสอนแทนแล้ว" : undefined}
                                      >
                                        {already ? "ถูกมอบหมายแล้ว" : (assigned ? "แก้ไข" : "เลือกครูสอนแทน")}
                                      </Button>

                                      {already && (
                                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                                          โดย {already.name || "—"}
                                        </Badge>
                                      )}
                                      {!already && assigned && <Badge variant="secondary">เลือกแล้ว</Badge>}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr className="hover:bg-muted/20">
                            <td className="px-3 py-4 border-r bg-muted/5">
                              <div>
                                <div className="font-semibold">{label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">วัน{weekday}</div>
                              </div>
                            </td>
                            <td colSpan={5} className="px-3 py-4 text-muted-foreground">ไม่มีคาบเรียนที่เกี่ยวข้อง</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3">
            <div className="w-full sm:w-auto">
              {isFullyCovered ? (
                <div className="text-green-600">✓ มอบหมายครบทุกคาบแล้ว</div>
              ) : (
                <div className="text-amber-700">
                  ยังมอบหมายไม่ครบ
                  {missing.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      คาบที่ยังขาด:
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        {missing.slice(0, 6).map((m, i) => (
                          <li key={`${m.date}-${m.tsId}-${i}`}>
                            {m.date} — tsId:{m.tsId}{typeof m.period === "number" ? ` (คาบ ${m.period})` : ""}
                          </li>
                        ))}
                        {missing.length > 6 && <li>… และอีก {missing.length - 6} คาบ</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {isFullyCovered && (
                <Button
                  style={{ backgroundColor: "#16a34a", color: "white" }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/academic/leaves/${leaveId}/complete`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        cache: "no-store",
                      });
                      const j = await res.json();
                      if (!res.ok || j?.error) {
                        throw new Error(j?.error || j?.detail || "อัปเดตสถานะไม่สำเร็จ");
                      }
                      alert("อัปเดตสถานะใบลาเป็น 'covered' แล้ว");
                      onOpenChange(false);
                    } catch (e: any) {
                      alert(e?.message || "อัปเดตสถานะไม่สำเร็จ");
                    }
                  }}
                  title="อัปเดตสถานะใบลาเป็น covered เมื่อมอบหมายครบทุกคาบ"
                >
                  ✓ เสร็จสิ้น
                </Button>
              )}

              <Button
                style={{ backgroundColor: "oklch(62.7% 0.194 149.214)", color: "white" }}
                onClick={() => onOpenChange(false)}
              >
                ปิด
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pickContext && (
        <AssignSubstituteModal
          open={pickOpen}
          onOpenChange={setPickOpen}
          subjectGroupOfLeaver={subjectGroup ?? ""}
          context={{ period: pickContext.slot.period, dateISO: pickContext.date }}
          onAssign={async ({ period, date, primaryTeacherId, crossGroupTeacherId }) => {
            const chosenUserId = primaryTeacherId || crossGroupTeacherId;
            const tsId = pickContext.slot.teachingScheduleId;
            if (!chosenUserId) { alert("ยังไม่ได้เลือกครูสอนแทน"); return; }

            try {
              const res = await fetch("/api/academic/substitutions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                  teachingScheduleId: tsId,
                  dateISO: date,
                  substituteUserId: chosenUserId,
                }),
              });
              const j = await res.json();

              if (res.status === 409) {
                setTakenMap(prev => {
                  const next = new Map(prev);
                  if (tsId != null) next.set(keyTaken(date, tsId), { name: null });
                  else next.set(keyTakenFallback(date, period), { name: null });
                  return next;
                });
                alert("คาบนี้มีการมอบหมายแล้ว");
              } else if (!res.ok || j?.error) {
                throw new Error(j?.detail || j?.error || "บันทึกไม่สำเร็จ");
              } else {
                setTakenMap(prev => {
                  const next = new Map(prev);
                  if (tsId != null) next.set(keyTaken(date, tsId), { name: null });
                  else next.set(keyTakenFallback(date, period), { name: null });
                  return next;
                });
              }

              setAssignments(prev => ({ ...prev, [keyOf(date, period)]: { primary: primaryTeacherId, cross: crossGroupTeacherId } }));
              setPickOpen(false);
            } catch (e: any) {
              alert(e?.message || "บันทึกไม่สำเร็จ");
            }
          }}
        />
      )}
    </>
  );
}
