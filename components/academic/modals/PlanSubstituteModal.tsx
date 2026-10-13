"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AssignSubstituteModal, { type AssignContext } from "@/components/academic/modals/AssignSubstituteModal";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { thaiDate } from "@/lib/format";

type Slot = {
  teachingScheduleId: number;
  period: number;
  time: string;
  subject: string;
  room: string;
  substituteUserId: string | null;
  substituteName: string | null;
};
type Day = { date: string; weekday: number | null; slots: Slot[] };
type Detail = {
  leave: LeaveItem;
  isTeacher: boolean;
  subjectGroupId: number | null;
  schedule: Day[];
  progress: { required: number; assigned: number; complete: boolean; missing: { date: string; tsId: number; period: number }[] };
};

const WEEKDAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const weekdayOf = (iso: string) => WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];

/** วางแผนสอนแทนทุกคาบในช่วงลา — โหลดข้อมูลทั้งหมดจาก endpoint เดียว */
export default function PlanSubstituteModal({
  open,
  onOpenChange,
  leaveId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leaveId: string;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<AssignContext | null>(null);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setDetail(await apiFetch<Detail>(`/api/academic/leaves/${leaveId}`, { signal }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setDetail(null);
        setError(e instanceof Error ? e.message : "โหลดตารางไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [leaveId]
  );

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [open, load]);

  async function finish() {
    setFinishing(true);
    try {
      await apiFetch(`/api/academic/leaves/${leaveId}/complete`, { method: "PATCH" });
      toast.success("ปิดงานสอนแทนเรียบร้อย");
      onChanged?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setFinishing(false);
    }
  }

  const leave = detail?.leave;
  const progress = detail?.progress;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>วางแผนสอนแทน:</span>
              <span className="font-semibold">{leave?.user.fullName ?? "..."}</span>
              {leave && (
                <Badge variant="secondary">
                  {thaiDate(leave.startDate, true)}
                  {leave.startDate !== leave.endDate ? ` - ${thaiDate(leave.endDate, true)}` : ""}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left w-[24%] border-r">วันที่</th>
                  <th className="px-3 py-2 text-left w-[8%]">คาบ</th>
                  <th className="px-3 py-2 text-left w-[16%]">เวลา</th>
                  <th className="px-3 py-2 text-left w-[18%]">วิชา</th>
                  <th className="px-3 py-2 text-left w-[10%]">ห้อง</th>
                  <th className="px-3 py-2 text-left">ครูสอนแทน</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">กำลังโหลดตาราง...</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-red-600">{error}</td>
                  </tr>
                )}
                {!loading && detail && !detail.isTeacher && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">ผู้ลาไม่ได้เป็นครู จึงไม่มีตารางสอน</td>
                  </tr>
                )}
                {!loading &&
                  detail?.isTeacher &&
                  detail.schedule.map((d, di) => (
                    <Fragment key={d.date}>
                      {di > 0 && (
                        <tr className="bg-muted/60">
                          <td colSpan={6} className="h-2 border-y" />
                        </tr>
                      )}
                      {d.slots.length === 0 ? (
                        <tr className="hover:bg-muted/20">
                          <td className="px-3 py-3 border-r bg-muted/5">
                            <div className="font-semibold">{thaiDate(d.date)}</div>
                            <div className="text-xs text-muted-foreground">วัน{weekdayOf(d.date)}</div>
                          </td>
                          <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                            {d.weekday === null ? "วันหยุดสุดสัปดาห์" : "ไม่มีคาบเรียนที่เกี่ยวข้อง"}
                          </td>
                        </tr>
                      ) : (
                        d.slots.map((s, si) => (
                          <tr key={s.teachingScheduleId} className="align-top hover:bg-muted/20">
                            <td className="px-3 py-2 border-r bg-muted/5">
                              {si === 0 && (
                                <>
                                  <div className="font-semibold">{thaiDate(d.date)}</div>
                                  <div className="text-xs text-muted-foreground">วัน{weekdayOf(d.date)}</div>
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2">คาบ {s.period}</td>
                            <td className="px-3 py-2">{s.time}</td>
                            <td className="px-3 py-2">{s.subject}</td>
                            <td className="px-3 py-2">{s.room}</td>
                            <td className="px-3 py-2">
                              {s.substituteUserId ? (
                                <Badge variant="outline" className="border-green-300 text-green-700">
                                  {s.substituteName || "—"}
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="text-white bg-blue-600 hover:bg-blue-700"
                                  onClick={() => setPicking({ dateISO: d.date, period: s.period, teachingScheduleId: s.teachingScheduleId })}
                                >
                                  เลือกครูสอนแทน
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              {progress && progress.required > 0 ? (
                progress.complete ? (
                  <span className="text-green-600">✓ มอบหมายครบทุกคาบแล้ว ({progress.assigned}/{progress.required})</span>
                ) : (
                  <span className="text-amber-700">
                    มอบหมายแล้ว {progress.assigned}/{progress.required} คาบ — ยังขาด {progress.missing.length} คาบ
                  </span>
                )
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              {leave?.status_code === "approved" && progress?.complete && progress.required > 0 && (
                <Button onClick={finish} disabled={finishing} className="text-white bg-green-600 hover:bg-green-700">
                  {finishing ? "กำลังบันทึก..." : "✓ เสร็จสิ้น"}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {picking && leave && (
        <AssignSubstituteModal
          open
          onOpenChange={(v) => !v && setPicking(null)}
          context={picking}
          subjectGroupId={detail?.subjectGroupId ?? null}
          leaverUserId={leave.userId}
          onAssigned={() => load()}
        />
      )}
    </>
  );
}
