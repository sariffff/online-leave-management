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
  onUpdated?: () => void;
}

export default function ReactivateUserModal({ open, onOpenChange, userId, userName, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);

  const handleReactivate = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usermanagement/reactivate-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      onUpdated?.();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเปิดใช้งานผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เปิดใช้งานผู้ใช้</DialogTitle>
        </DialogHeader>
        <p>คุณต้องการเปิดใช้งานผู้ใช้ <strong>{userName}</strong> อีกครั้งหรือไม่?</p>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleReactivate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "เปิดใช้งาน"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
