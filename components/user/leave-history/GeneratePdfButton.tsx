"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import LeavePdfDoc, { type LeavePdfData } from "@/components/user/leave-history/LeavePdfDoc";

function thaiDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const y = d.getFullYear() + 543;
  return `วัน${days[d.getDay()]} ที่ ${d.getDate()} ${months[d.getMonth()]} พ.ศ. ${y}`;
}
const pad = (n:number)=>n.toString().padStart(2,"0");
const dmyThai = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()+543}`;

export default function GeneratePdfButton({
  leave,
  filename = (id: string | number) => `leave-${id}.pdf`,
}: {
  /** อ็อบเจ็กต์ใบลาของคุณ (จะ map เป็น LeavePdfData ด้านล่าง) */
  leave: {
    leave_request_id: string | number;
    date_start: string | Date;
    date_end: string | Date;
    total_day: number | string;
    prename: string ; // คำนำหน้า
    name?: string; // ชื่อ
    surname?: string; // นามสกุล
    status?: string | null; // สถานะ (อนุมัติ/ไม่อนุมัติ/รอพิจารณา)
    reason: string;
    file?: string | null; // url ใบรับรองแพทย์ (ถ้ามี)
    // ข้อมูลอื่นๆที่ต้องการโชว์
  };
  /** สร้างชื่อไฟล์ */
  filename?: (id: string | number) => string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      // TODO: map ข้อมูลจริงให้ตรงของคุณ (ต่อ DB ภายหลังได้)
      const start = new Date(leave.date_start);
      const end   = new Date(leave.date_end);

      const data: LeavePdfData = {
        code: String(leave.leave_request_id),
        printedAtText: thaiDate(start),
        recipient: "ผู้อำนวยการโรงเรียนบ้านตาสา",
        prename: (leave.prename),
        name: "ซารีฟ",
        surname: "หะเล็ง",
        reason: leave.reason ?? "-",
        dateStartText: dmyThai(start),
        dateEndText: dmyThai(end),
        totalDaysText: `${leave.total_day} วัน`,
        attachmentLabel: leave.file ? "ใบรับรองแพทย์.pdf" : undefined,
        attachmentUrl: leave.file ?? undefined,
        approverName: "นายพลกรู ยุบเกง",
        approverTitle: "ผู้อำนวยการโรงเรียนบ้านตาสา",
        approvedDateText: `วันที่ ${thaiDate(end)}`,
        comment: "-",
      };

      // สร้าง Blob ของ PDF แบบ client-side
      const blob = await pdf(<LeavePdfDoc data={data} />).toBlob();

      // เปิดแท็บใหม่ (inline view)
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      // ถ้าอยาก "ดาวน์โหลดทันที": ใช้ <a download>
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename(leave.leave_request_id);
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={loading}
      aria-label="สร้างและดูไฟล์ PDF"
      title="สร้างและดูไฟล์ PDF"
    >
      <FileText className="w-5 h-5" />
    </Button>
  );
}
