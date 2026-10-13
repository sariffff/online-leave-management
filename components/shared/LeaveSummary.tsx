"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { normalizeHalf, statusBadge, statusLabel } from "@/lib/leave/status";
import { thaiDate } from "@/lib/format";
import { leaveCode, type LeaveFileDTO, type LeaveItem } from "@/components/shared/types";

export function StatusPill({ code }: { code: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(code)}`}>
      {statusLabel(code)}
    </span>
  );
}

export function FileList({ files }: { files: LeaveFileDTO[] }) {
  if (!files.length) {
    return <div className="p-3 text-sm border rounded-md bg-muted/30 text-muted-foreground">ไม่มีไฟล์แนบ</div>;
  }
  return (
    <ul className="space-y-2" aria-label="ไฟล์แนบ">
      {files.map((f) => (
        <li key={f.path} className="flex items-center justify-between p-2 border rounded-lg">
          <span className="min-w-0 text-sm font-medium truncate" title={f.name}>
            📄 {f.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!f.url}
              onClick={() => f.url && window.open(f.url, "_blank", "noopener")}
            >
              เปิดไฟล์
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!f.url}
              onClick={() => f.url && navigator.clipboard.writeText(f.url).catch(() => undefined)}
            >
              คัดลอกลิงก์
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** รายละเอียดใบลา (อ่านอย่างเดียว) ใช้ใน modal ของทุกบทบาท */
export default function LeaveSummary({ item }: { item: LeaveItem }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-500">รหัสลา</div>
          <div className="font-mono font-semibold text-blue-600">{leaveCode(item.id)}</div>
        </div>
        <div className="text-right">
          <StatusPill code={item.status_code} />
        </div>

        <div className="col-span-2">
          <div className="text-slate-500">ผู้ยื่น</div>
          <div className="font-medium">{item.user.fullName || "-"}</div>
          {item.user.email ? <div className="text-xs text-slate-500">{item.user.email}</div> : null}
        </div>

        <div>
          <div className="text-slate-500">ประเภทการลา</div>
          <div className="font-medium">{item.leaveType}</div>
        </div>
        <div>
          <div className="text-slate-500">จำนวนวัน</div>
          <div className="font-medium">{item.totalDays} วัน</div>
        </div>

        <div>
          <div className="text-slate-500">วันที่เริ่ม</div>
          <div className="font-medium">
            {thaiDate(item.startDate)} ({normalizeHalf(item.date_start_type)})
          </div>
        </div>
        <div>
          <div className="text-slate-500">วันที่สิ้นสุด</div>
          <div className="font-medium">
            {thaiDate(item.endDate)} ({normalizeHalf(item.date_end_type)})
          </div>
        </div>

        {item.reason ? (
          <div className="col-span-2">
            <div className="text-slate-500">เหตุผลที่ผู้ยื่นระบุ</div>
            <div className="p-3 whitespace-pre-wrap border rounded-md bg-slate-50 text-slate-700">{item.reason}</div>
          </div>
        ) : null}

        {item.comment ? (
          <div className="col-span-2">
            <div className="text-slate-500">ความเห็นผู้พิจารณา</div>
            <div className="p-3 whitespace-pre-wrap border rounded-md bg-amber-50 text-slate-700">{item.comment}</div>
          </div>
        ) : null}

        {(item.reviewedBy || item.approvedBy) && (
          <div className="col-span-2 text-xs text-slate-500">
            {item.reviewedBy ? <>ตรวจโดย {item.reviewedBy} </> : null}
            {item.approvedBy ? <>• พิจารณาโดย {item.approvedBy}</> : null}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="block mb-1">ไฟล์แนบ</Label>
        <FileList files={item.files} />
      </div>
    </div>
  );
}
