"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LeaveSummary from "@/components/shared/LeaveSummary";
import type { LeaveItem } from "@/components/shared/types";

/** modal ดูรายละเอียดใบลาแบบอ่านอย่างเดียว (แทน ReviewHistoryModal ที่เคยซ้ำกัน 2 ไฟล์ + ReviewLeaveModal) */
export default function LeaveDetailModal({
  open,
  item,
  onClose,
  title = "รายละเอียดใบลา",
}: {
  open: boolean;
  item: LeaveItem | null;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>โหมดอ่านอย่างเดียว</DialogDescription>
        </DialogHeader>
        {item ? <LeaveSummary item={item} /> : null}
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
