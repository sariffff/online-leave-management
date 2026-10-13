"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client/api";
import { thaiDate } from "@/lib/format";

type Teacher = { id: string; user_id: string; name: string; subjectGroup: number | null };
type FreeResponse = { data1: Teacher[]; data2: Teacher[] };

export type AssignContext = { dateISO: string; period: number; teachingScheduleId: number };

/** เลือกครูที่ว่างในคาบนั้นมาสอนแทน (แยกกลุ่มสาระเดียวกัน / ต่างกลุ่ม) */
export default function AssignSubstituteModal({
  open,
  onOpenChange,
  context,
  subjectGroupId,
  leaverUserId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: AssignContext;
  subjectGroupId: number | null;
  leaverUserId: string;
  onAssigned: () => void;
}) {
  const [same, setSame] = useState<Teacher[]>([]);
  const [other, setOther] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Teacher | null>(null);
  const [comboOpen, setComboOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setPicked(null);
    const qs = new URLSearchParams({ date: context.dateISO, period: String(context.period), excludeUserId: leaverUserId });
    if (subjectGroupId !== null) qs.set("subjectGroup", String(subjectGroupId));

    apiFetch<FreeResponse>(`/api/academic/free-teachers?${qs}`, { signal: ac.signal })
      .then((r) => {
        setSame(r.data1);
        setOther(r.data2);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSame([]);
        setOther([]);
        setError(e instanceof Error ? e.message : "โหลดรายชื่อครูว่างไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [open, context.dateISO, context.period, leaverUserId, subjectGroupId]);

  async function assign() {
    if (!picked) return;
    setPosting(true);
    try {
      await apiFetch("/api/academic/substitutions", {
        method: "POST",
        json: { teachingScheduleId: context.teachingScheduleId, dateISO: context.dateISO, substituteUserId: picked.user_id },
      });
      toast.success("มอบหมายครูสอนแทนแล้ว");
      onAssigned();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกการมอบหมายไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  }

  const empty = !loading && !error && same.length === 0 && other.length === 0;

  const item = (t: Teacher) => (
    <CommandItem
      key={t.user_id}
      value={`${t.name} ${t.user_id}`}
      onSelect={() => {
        setPicked(t);
        setComboOpen(false);
      }}
      className="cursor-pointer"
    >
      <Check className={cn("mr-2 h-4 w-4", picked?.user_id === t.user_id ? "opacity-100" : "opacity-0")} />
      {t.name}
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !posting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>เลือกครูสอนแทน</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            วันที่ <span className="font-medium">{thaiDate(context.dateISO)}</span> | คาบที่ <span className="font-medium">{context.period}</span>
          </div>

          {error && <div className="p-2 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{error}</div>}

          {loading ? (
            <div className="h-10 rounded-md bg-gray-100 animate-pulse" />
          ) : empty ? (
            <div className="p-3 text-sm border rounded-lg bg-amber-50 text-amber-900">ไม่มีครูว่างคาบนี้</div>
          ) : (
            <Popover open={comboOpen} onOpenChange={setComboOpen} modal>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="justify-between w-full">
                  <span className={cn(!picked && "text-muted-foreground")}>{picked ? picked.name : "เลือกครูสอนแทน"}</span>
                  <ChevronsUpDown className="w-4 h-4 ml-2 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="พิมพ์เพื่อค้นหา..." />
                  <CommandList className="overflow-auto max-h-64">
                    <CommandEmpty>ไม่พบชื่อที่ค้นหา</CommandEmpty>
                    {same.length > 0 && <CommandGroup heading={`กลุ่มสาระเดียวกัน (${same.length})`}>{same.map(item)}</CommandGroup>}
                    {other.length > 0 && <CommandGroup heading={`ต่างกลุ่มสาระ (${other.length})`}>{other.map(item)}</CommandGroup>}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={posting}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={assign} disabled={!picked || loading || posting} className="text-white bg-green-600 hover:bg-green-700">
            {posting ? "กำลังมอบหมาย..." : "มอบหมาย"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
