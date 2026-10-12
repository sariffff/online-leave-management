"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Teacher = { id: string; name: string; subjectGroup?: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** กลุ่มสาระของผู้ลา (id เป็น string หรือ number ก็ได้; ว่างได้) */
  subjectGroupOfLeaver: string | number;
  /** วันที่/คาบ/teachingScheduleId ที่ต้องหาคนสอนแทน */
  context: { period: number; dateISO: string; teachingScheduleId: number | string };
  /** user_id ของผู้ลา */
  leaverUserId?: string;
  onAssign?: (payload: {
    period: number;
    date: string;
    primaryTeacherId?: string;    // user_id
    crossGroupTeacherId?: string; // user_id
  }) => Promise<void> | void;
};

function TeacherCombobox({
  label, value, onChange, options, placeholder = "พิมพ์เพื่อค้นหา...",
}: {
  label: string; value?: string; onChange: (v: string | undefined) => void;
  options: Teacher[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((t) => t.id === value);
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between w-full">
            <span className={cn(!selected && "text-muted-foreground")}>
              {selected ? selected.name : "เลือกครูสอนแทน"}
            </span>
            <ChevronsUpDown className="w-4 h-4 ml-2 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList className="overflow-auto max-h-64">
              <CommandEmpty>ไม่พบชื่อที่ค้นหา</CommandEmpty>
              <CommandGroup>
                {options.map((t) => (
                  <CommandItem
                    key={`${t.id}`}
                    value={t.name}
                    onSelect={() => { onChange(String(t.id)); setOpen(false); }}
                    className="cursor-pointer"
                  >
                    <Check className={cn("mr-2 h-4 w-4", String(value) === String(t.id) ? "opacity-100" : "opacity-0")} />
                    {t.name}
                    {t.subjectGroup != null && (
                      <span className="ml-auto text-xs text-muted-foreground">{t.subjectGroup}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="sm" className="justify-start px-0 mt-1 text-muted-foreground" onClick={() => onChange(undefined)}>
          ล้างค่า
        </Button>
      )}
    </div>
  );
}

export default function AssignSubstituteModal({
  open, onOpenChange, subjectGroupOfLeaver, context, leaverUserId, onAssign,
}: Props) {
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string | undefined>();
  const [crossGroupTeacherId, setCrossGroupTeacherId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [data1, setData1] = useState<Teacher[]>([]); // กลุ่มสาระเดียวกัน
  const [data2, setData2] = useState<Teacher[]>([]); // นอกกลุ่มสาระ

  const canAssign = !!primaryTeacherId || !!crossGroupTeacherId;

  function buildDisplayName(t: any): string {
    const fromProfile = [t?.prename, t?.name, t?.surname].filter(Boolean).join(" ").trim();
    if (t && t.displayName != null && String(t.displayName).trim() !== "") return String(t.displayName);
    if (fromProfile) return fromProfile;
    if (t && t.name != null && String(t.name).trim() !== "") return String(t.name);
    return "—";
  }

  useEffect(() => {
    if (!open) return;
    if (!context?.dateISO || !context?.period) return;

    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true); setErr(null);

        const sg = Number(subjectGroupOfLeaver);
        const qs = new URLSearchParams({
          date: context.dateISO,
          period: String(context.period),
          subjectGroup: Number.isFinite(sg) ? String(sg) : "",
        });
        if (leaverUserId) qs.set("excludeUserId", leaverUserId);

        const res = await fetch(`/api/academic/free-teachers?${qs.toString()}`, { cache: "no-store", signal: ac.signal });
        const j: any = await res.json();
        if (!res.ok || j?.error) throw new Error(j?.detail || j?.error || "โหลดรายชื่อครูว่างไม่สำเร็จ");

        const mapList = (arr: any[]): Teacher[] =>
          (arr || []).map((t: any) => {
            const rawId = t?.user_id ?? t?.id ?? t?.teacher_id ?? "";
            const idStr = String(rawId);
            if (!idStr) return null as any;
            const sg2 = t?.subjectGroup;
            const sgNumItem = Number.isFinite(Number(sg2)) ? Number(sg2) : undefined;
            return { id: idStr, name: buildDisplayName(t) || (t?.name || "—"), subjectGroup: sgNumItem } as Teacher;
          }).filter(Boolean) as Teacher[];

        if (Array.isArray(j?.data1) || Array.isArray(j?.data2)) {
          setData1(mapList(j.data1));
          setData2(mapList(j.data2));
        } else if (Array.isArray(j?.sameGroup) || Array.isArray(j?.otherGroups)) {
          setData1(mapList(j.sameGroup));
          setData2(mapList(j.otherGroups));
        } else {
          const all = mapList(j?.data || []);
          const sgTarget = Number(subjectGroupOfLeaver);
          const same = Number.isFinite(sgTarget) ? all.filter(m => m.subjectGroup === sgTarget) : [];
          const other = Number.isFinite(sgTarget) ? all.filter(m => m.subjectGroup !== sgTarget) : all;
          setData1(same);
          setData2(other);
        }

        setPrimaryTeacherId(undefined);
        setCrossGroupTeacherId(undefined);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "โหลดรายชื่อครูว่างไม่สำเร็จ");
        setData1([]); setData2([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [open, context?.dateISO, context?.period, subjectGroupOfLeaver, leaverUserId]);

  useEffect(() => {
    if (primaryTeacherId) setCrossGroupTeacherId(undefined);
  }, [primaryTeacherId]);
  useEffect(() => {
    if (crossGroupTeacherId) setPrimaryTeacherId(undefined);
  }, [crossGroupTeacherId]);

  async function handleAssign() {
    setErr(null);

    if (onAssign) {
      await onAssign({
        period: context.period,
        date: context.dateISO,
        primaryTeacherId,
        crossGroupTeacherId,
      });
      return;
    }

    const substituteUserId = primaryTeacherId || crossGroupTeacherId;
    if (!substituteUserId) return;

    const teachingScheduleId = context?.teachingScheduleId;
    if (teachingScheduleId == null || teachingScheduleId === "") {
      setErr("ไม่พบ teachingScheduleId ของคาบนี้");
      return;
    }

    try {
      setPosting(true);
      const res = await fetch("/api/academic/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teachingScheduleId,
          dateISO: context.dateISO,      // YYYY-MM-DD
          substituteUserId,              // user_id ของครูที่จะสอนแทน
        }),
      });

      if (res.status === 409) {
        setErr("มีผู้สอนแทนแล้วในคาบนี้");
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "บันทึกการมอบหมายไม่สำเร็จ");
        return;
      }

      onOpenChange(false);
    } catch (e: any) {
      setErr(e?.message || "บันทึกการมอบหมายไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  }

  const noTeachers = !loading && !err && data1.length === 0 && data2.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setErr(null); onOpenChange(v); }} modal>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle>เลือกครูสอนแทน</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="text-sm text-muted-foreground">
            วันที่ <span className="font-medium">{context.dateISO}</span> | คาบที่ <span className="font-medium">{context.period}</span>
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-2">
              {err}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-muted-foreground">กำลังโหลดรายชื่อครูว่าง…</div>
          ) : noTeachers ? (
            <div className="rounded-lg border bg-amber-50 text-amber-900 text-sm p-3">
              ไม่มีครูว่างคาบนี้
            </div>
          ) : (
            <>
              <TeacherCombobox
                label={`ครูกลุ่มสาระเดียวกัน${data1.length ? ` (${data1.length})` : ""}`}
                value={primaryTeacherId}
                onChange={setPrimaryTeacherId}
                options={data1}
                placeholder="พิมพ์เพื่อค้นหา..."
              />
              <TeacherCombobox
                label={`ครูนอกกลุ่มสาระ${data2.length ? ` (${data2.length})` : ""}`}
                value={crossGroupTeacherId}
                onChange={setCrossGroupTeacherId}
                options={data2}
                placeholder="พิมพ์เพื่อค้นหา..."
              />
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="destructive" onClick={() => onOpenChange(false)} disabled={posting}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!canAssign || loading || posting || (!!err && err === "มีผู้สอนแทนแล้วในคาบนี้") || noTeachers}
            style={{ backgroundColor: "oklch(62.7% 0.194 149.214)", color: "white" }}
          >
            {posting ? "กำลังมอบหมาย..." : "มอบหมาย"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
