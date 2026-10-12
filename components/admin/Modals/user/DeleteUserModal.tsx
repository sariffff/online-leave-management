"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userName?: string;
  onDeleted?: () => void;
}

export default function DeleteUserModal({ open, onOpenChange, userId, userName, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usermanagement/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      onDeleted?.();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถลบผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ยืนยันการลบผู้ใช้</DialogTitle>
        </DialogHeader>
        <p>คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ <strong>{userName}</strong> ? ข้อมูลนี้จะหายไปถาวร</p>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button className="bg-red-700 hover:bg-red-800" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "ลบ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
