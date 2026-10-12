"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Copy } from "lucide-react";
import { useCallback } from "react";
import toast from "react-hot-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** ชื่อครูที่จะแสดงในหัวข้อ */
  teacherName: string;
  /** อีเมล (ใส่เป็น "" ได้ ถ้าไม่มี) */
  email?: string | null;
  /** เบอร์โทร (ใส่เป็น "" ได้ ถ้าไม่มี) */
  phone?: string | null;
};

export default function ContactTeacherModal({
  open,
  onOpenChange,
  teacherName,
  email,
  phone,
}: Props) {
  const copy = useCallback(async (text?: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("คัดลอกแล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            ช่องทางการติดต่อกับครู{teacherName ? ` ${teacherName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="mx-auto w-full max-w-[520px]">
          {/* Email row */}
          <div className="flex items-center gap-3 px-3 py-2 mb-3 border rounded-md">
            <Mail size={18} className="shrink-0" />
            <a
              href={email ? `mailto:${email}` : undefined}
              className={`flex-1 font-medium truncate ${
                email ? "hover:underline" : "opacity-60 pointer-events-none"
              }`}
              title={email ?? ""}
            >
              {email || "ไม่พบอีเมล"}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => copy(email)}
              disabled={!email}
              title="คัดลอกอีเมล"
            >
              <Copy size={16} />
            </Button>
          </div>

          {/* Phone row */}
          <div className="flex items-center gap-3 px-3 py-2 border rounded-md">
            <Phone size={18} className="shrink-0" />
            <a
              href={phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : undefined}
              className={`flex-1 font-medium ${phone ? "" : "opacity-60 pointer-events-none"}`}
              title={phone ?? ""}
            >
              {phone || "ไม่พบบุคคลสำหรับติดต่อ"}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => copy(phone)}
              disabled={!phone}
              title="คัดลอกเบอร์โทร"
            >
              <Copy size={16} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
