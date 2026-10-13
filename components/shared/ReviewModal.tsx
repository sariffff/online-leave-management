"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import LeaveSummary from "@/components/shared/LeaveSummary";
import type { LeaveItem } from "@/components/shared/types";

export type ReviewMode = "review" | "approve";

const CONFIG = {
  review: {
    title: "ตรวจสอบใบลา",
    desc: "ตรวจสอบความถูกต้องก่อน “ผ่าน/ไม่ผ่าน”",
    requiredStatus: "pending",
    ok: { action: "reviewed", label: "ผ่าน" },
    no: { action: "fail", label: "ไม่ผ่าน" },
    notePlaceholder: "หมายเหตุ (ถ้า \"ไม่ผ่าน\" ต้องระบุเหตุผล)",
  },
  approve: {
    title: "อนุมัติใบลา",
    desc: "พิจารณาอนุมัติหรือไม่อนุมัติใบลาที่ผ่านการตรวจสอบแล้ว",
    requiredStatus: "reviewed",
    ok: { action: "approved", label: "อนุมัติ" },
    no: { action: "rejected", label: "ไม่อนุมัติ" },
    notePlaceholder: "หมายเหตุ (ถ้า \"ไม่อนุมัติ\" ต้องระบุเหตุผล)",
  },
} as const;

/**
 * modal พิจารณาใบลา ใช้ร่วมกันระหว่างธุรการ (review) และ ผอ. (approve)
 * onSubmit ควรโยน error เมื่อบันทึกไม่สำเร็จ — modal จะแสดง toast และไม่ปิด
 */
export default function ReviewModal({
  mode,
  open,
  item,
  onClose,
  onSubmit,
}: {
  mode: ReviewMode;
  open: boolean;
  item: LeaveItem | null;
  onClose: () => void;
  onSubmit: (args: { action: string; id: number; note?: string }) => Promise<void>;
}) {
  const cfg = CONFIG[mode];
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [needReason, setNeedReason] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setNeedReason(false);
    }
  }, [open, item?.id]);

  const canAct = !!item && item.status_code === cfg.requiredStatus;

  async function act(action: string, label: string) {
    if (!item) return;
    // ไม่ผ่าน/ไม่อนุมัติ ต้องมีเหตุผล (ระบบหลังบ้านตรวจซ้ำ)
    if (action === cfg.no.action && !note.trim()) {
      setNeedReason(true);
      document.getElementById("review-note")?.focus();
      return;
    }
    setBusy(action);
    try {
      await onSubmit({ action, id: Number(item.id), note: note.trim() || undefined });
      toast.success(`${label}เรียบร้อย`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.desc}</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-5">
            <LeaveSummary item={item} />
            <div className="space-y-2">
              <label htmlFor="review-note" className="block text-sm font-medium text-slate-700">
                หมายเหตุ / เหตุผล
              </label>
              <Textarea
                id="review-note"
                placeholder={cfg.notePlaceholder}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (e.target.value.trim()) setNeedReason(false);
                }}
                rows={3}
                aria-invalid={needReason}
                aria-describedby={needReason ? "review-note-error" : undefined}
                className={needReason ? "border-red-500 focus-visible:ring-red-500" : undefined}
              />
              {needReason && (
                <p id="review-note-error" role="alert" className="text-sm text-red-600">
                  กรุณาระบุเหตุผลที่{cfg.no.label} เพื่อให้ผู้ยื่นทราบว่าต้องแก้ไขอะไร
                </p>
              )}
              {!canAct && <p className="text-xs text-amber-700">ใบลานี้ไม่อยู่ในสถานะที่พิจารณาได้ (อาจมีผู้อื่นดำเนินการไปแล้ว)</p>}
            </div>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={!!busy}>
            ปิด
          </Button>
          <div className="flex gap-2">
            <Button
              className="text-white bg-green-600 hover:bg-green-700"
              onClick={() => act(cfg.ok.action, cfg.ok.label)}
              disabled={!canAct || !!busy}
            >
              {busy === cfg.ok.action ? "กำลังบันทึก…" : cfg.ok.label}
            </Button>
            <Button
              className="text-white bg-red-600 hover:bg-red-700"
              onClick={() => act(cfg.no.action, cfg.no.label)}
              disabled={!canAct || !!busy}
            >
              {busy === cfg.no.action ? "กำลังบันทึก…" : cfg.no.label}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
