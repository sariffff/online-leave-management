"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/leave/status";
import { thaiDate } from "@/lib/format";
import { leaveCode, type LeaveItem } from "@/components/shared/types";
import type { LeavePdfData } from "@/components/user/leave-history/LeavePdfDoc";
import { usePublicSettings } from "@/components/shell/SettingsContext";
import type { GeneralSettings } from "@/lib/settings-schema";

// ชื่อโรงเรียน/ตำแหน่งผู้อนุมัติ/โลโก้ มาจากการตั้งค่าระบบ (หมวดทั่วไป)
function toPdfData(item: LeaveItem, general: GeneralSettings): LeavePdfData {
  const approved = ["approved", "covered"].includes(item.status_code);
  return {
    code: leaveCode(item.id),
    printedAtText: `วันที่ ${thaiDate(new Date().toISOString().slice(0, 10))}`,
    recipient: general.approverTitle,
    schoolName: general.schoolName,
    logoUrl: general.logoUrl ?? undefined,
    applicantName: item.user.fullName,
    leaveTypeName: item.leaveType,
    reason: item.reason || "-",
    dateStartText: thaiDate(item.startDate),
    dateEndText: thaiDate(item.endDate),
    totalDaysText: `${item.totalDays} วัน`,
    attachmentCount: item.files.length,
    statusText: statusLabel(item.status_code),
    approverName: approved || item.status_code === "rejected" ? (item.approvedBy ?? undefined) : undefined,
    approverTitle: general.approverTitle,
    approvedDateText: item.approvedAt ? `วันที่ ${thaiDate(item.approvedAt.slice(0, 10))}` : undefined,
    comment: item.comment ?? undefined,
  };
}

/** สร้าง PDF ฝั่ง client — โหลด @react-pdf/renderer (~1MB) เฉพาะตอนกดปุ่ม ไม่รวมใน bundle ของหน้า */
export default function GeneratePdfButton({ item, label = "สร้าง/เปิด PDF" }: { item: LeaveItem; label?: string }) {
  const [loading, setLoading] = useState(false);
  const { general } = usePublicSettings();

  async function handleClick() {
    setLoading(true);
    try {
      const [{ pdf }, { default: LeavePdfDoc }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/user/leave-history/LeavePdfDoc")]);
      const blob = await pdf(<LeavePdfDoc data={toPdfData(item, general)} />).toBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `leave-${item.id}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error(e);
      toast.error("สร้างไฟล์ PDF ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}
