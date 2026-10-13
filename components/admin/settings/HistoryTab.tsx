"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Pagination from "@/components/shared/Pagination";
import { apiFetch } from "@/lib/client/api";
import { usePagedQuery } from "@/lib/client/usePagedQuery";
import { FILE_KINDS, LEAVE_COLORS, THEMES } from "@/lib/settings-schema";

type Entry = {
  id: string;
  at: string;
  by: { id: string; name: string };
  section: string;
  key?: string;
  label: string;
  before: unknown;
  after: unknown;
  revertOf?: string;
  /** เหตุที่ย้อนกลับไม่ได้ (null = ย้อนกลับได้) */
  blockedReason: string | null;
};

const SECTION_TH: Record<string, string> = { general: "ทั่วไป", leaveTypes: "ประเภทการลา", periods: "คาบเรียน", attachments: "ไฟล์แนบ" };

const FIELD_TH: Record<string, string> = {
  leave_type_name: "ชื่อประเภท",
  max_leave_day: "วันลาต่อปี",
  carry_over_max: "สะสมได้สูงสุด",
  note: "หมายเหตุ",
  systemName: "ชื่อระบบ",
  systemShortName: "ชื่อย่อ",
  schoolName: "ชื่อโรงเรียน",
  approverTitle: "ตำแหน่งผู้อนุมัติ",
  footerText: "ข้อความท้ายเมนู",
  theme: "สีของระบบ",
  logoUrl: "โลโก้",
  description: "คำอธิบาย",
  color: "สี",
  isActive: "เปิดใช้งาน",
  sortOrder: "ลำดับ",
  maxDaysPerRequest: "ลาได้ครั้งละไม่เกิน",
  docRequiredAfterDays: "ต้องแนบเอกสารเมื่อลาเกิน",
  minNoticeDays: "ยื่นล่วงหน้า",
  maxBackdateDays: "ยื่นย้อนหลังได้",
  allowHalfDay: "ลาครึ่งวัน",
  countMode: "วิธีนับวัน",
  periods: "คาบเรียน",
  afternoonStartsAt: "เริ่มช่วงบ่าย",
  maxFileMB: "ขนาดไฟล์สูงสุด (MB)",
  maxFiles: "จำนวนไฟล์สูงสุด",
  kinds: "ชนิดไฟล์",
};

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ใช่" : "ไม่";
  if (field === "theme") return THEMES[v as keyof typeof THEMES]?.label ?? String(v);
  if (field === "color") return LEAVE_COLORS[v as keyof typeof LEAVE_COLORS]?.label ?? String(v);
  if (field === "countMode") return v === "calendar" ? "นับรวมวันหยุด" : "นับเฉพาะวันทำการ";
  if (field === "logoUrl") return "มีโลโก้";
  if (field === "kinds" && Array.isArray(v)) return v.map((k) => FILE_KINDS[k as keyof typeof FILE_KINDS]?.label ?? k).join(", ");
  if (field === "periods" && Array.isArray(v)) return v.map((p: { start_time: string; end_time: string }, i) => `${i + 1}) ${p.start_time}-${p.end_time}`).join(" ");
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** รายการฟิลด์ที่เปลี่ยน: ชื่อฟิลด์ / ค่าเดิม / ค่าใหม่ */
function diff(before: unknown, after: unknown): { field: string; from: string; to: string }[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ field: FIELD_TH[k] ?? k, from: show(k, b[k]), to: show(k, a[k]) }));
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default function HistoryTab({ onReverted }: { onReverted: () => void }) {
  const list = usePagedQuery<Entry>("/api/admin/settings/history", {}, 20);
  const [confirm, setConfirm] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);

  async function revert() {
    if (!confirm) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/settings/history/${confirm.id}/revert`, { method: "POST" });
      toast.success("ย้อนกลับค่าเดิมแล้ว");
      setConfirm(null);
      list.reload();
      onReverted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ย้อนกลับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden bg-white border shadow-sm rounded-xl">
      <div className="px-4 py-3 border-b sm:px-6">
        <h2 className="font-semibold text-gray-900">ประวัติการแก้ไข ({list.total} รายการ)</h2>
        <p className="text-sm text-gray-500">ใครแก้อะไร เมื่อไร — กด &ldquo;ย้อนกลับ&rdquo; เพื่อใช้ค่าก่อนการแก้ไขนั้น (การย้อนกลับบันทึกเป็นประวัติใหม่ แต่ย้อนกลับซ้ำไม่ได้ และแต่ละรายการย้อนกลับได้ครั้งเดียว)</p>
      </div>

      {list.loading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : list.error ? (
        <p className="px-4 py-10 text-center text-red-600">{list.error}</p>
      ) : list.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-gray-500">ยังไม่มีการแก้ไขการตั้งค่า</p>
      ) : (
        <ul className="divide-y">
          {list.rows.map((h) => {
            // คืนค่าเริ่มต้นกฎประเภทการลา: แสดงสรุปแทนรายการทุกฟิลด์ของทุกประเภท
            const isRulesReset = h.section === "leaveTypes" && h.key === "reset";
            const changes = isRulesReset ? [] : diff(h.before, h.after);
            return (
              <li key={h.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:px-6">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{SECTION_TH[h.section] ?? h.section}</span>
                    <span className="font-medium text-gray-900">{h.label}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {when(h.at)} · โดย {h.by.name}
                  </div>
                  {isRulesReset && <p className="text-sm text-gray-600">กฎ คำอธิบาย สี ลำดับ และการเปิดใช้งานของทุกประเภท</p>}
                  {changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {changes.slice(0, 8).map((c) => (
                        <li key={c.field} className="break-words">
                          <span className="text-gray-600">{c.field}:</span> <span className="text-red-600 line-through">{c.from}</span> →{" "}
                          <span className="text-green-700">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {h.blockedReason ? (
                  <span title={h.blockedReason} className="self-start px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-md shrink-0">
                    {h.revertOf || h.label.startsWith("ย้อนกลับ:") ? "รายการย้อนกลับ" : "ย้อนกลับแล้ว"}
                  </span>
                ) : (
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setConfirm(h)}>
                    <RotateCcw className="w-4 h-4" /> ย้อนกลับ
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={list.page} totalPages={list.totalPages} onChange={list.setPage} total={list.total} />

      <Dialog open={!!confirm} onOpenChange={(v) => !v && !busy && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ย้อนกลับค่าเดิม?</DialogTitle>
            <DialogDescription>
              ใช้ค่าก่อนการแก้ไข &ldquo;{confirm?.label}&rdquo; ({confirm ? when(confirm.at) : ""})
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>ยกเลิก</Button>
            <Button onClick={revert} disabled={busy} className="text-white bg-(--brand) hover:opacity-90">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} ย้อนกลับ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
