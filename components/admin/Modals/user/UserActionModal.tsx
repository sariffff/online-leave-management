"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/api";

export type UserAction = "deactivate" | "reactivate" | "delete";

const CONFIG: Record<UserAction, { title: string; verb: string; url: string; method: "PUT" | "DELETE"; btn: string; done: string; warn?: string }> = {
  deactivate: { title: "ยืนยันการปิดใช้งานผู้ใช้", verb: "ปิดใช้งาน", url: "/api/admin/usermanagement/deactivate-user", method: "PUT", btn: "bg-red-600 hover:bg-red-700", done: "ปิดใช้งานเรียบร้อย" },
  reactivate: { title: "เปิดใช้งานผู้ใช้", verb: "เปิดใช้งาน", url: "/api/admin/usermanagement/reactivate-user", method: "PUT", btn: "bg-green-600 hover:bg-green-700", done: "เปิดใช้งานเรียบร้อย" },
  delete: {
    title: "ยืนยันการลบผู้ใช้",
    verb: "ลบ",
    url: "/api/admin/usermanagement/delete-user",
    method: "DELETE",
    btn: "bg-red-700 hover:bg-red-800",
    done: "ลบผู้ใช้เรียบร้อย",
    warn: "ข้อมูลจะหายถาวร ผู้ใช้ที่มีประวัติการลาจะลบไม่ได้ (ให้ใช้ปิดใช้งานแทน)",
  },
};

/** ยืนยันการ ปิดใช้งาน / เปิดใช้งาน / ลบ ผู้ใช้ (รวม 3 modal เดิมเป็นไฟล์เดียว) */
export default function UserActionModal({
  action,
  userId,
  userName,
  onClose,
  onDone,
}: {
  action: UserAction | null;
  userId?: string;
  userName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cfg = action ? CONFIG[action] : null;

  async function run() {
    if (!cfg || !userId) return;
    setBusy(true);
    try {
      await apiFetch(cfg.url, { method: cfg.method, json: { user_id: userId } });
      toast.success(cfg.done);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{cfg?.title}</DialogTitle>
          <DialogDescription>
            คุณแน่ใจหรือไม่ว่าต้องการ{cfg?.verb}ผู้ใช้ <strong>{userName}</strong> ?
            {cfg?.warn && <span className="block mt-2 text-red-600">{cfg.warn}</span>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button className={cfg?.btn} onClick={run} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : cfg?.verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
