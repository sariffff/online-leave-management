// components/supervisor/modals/ReviewHistoryModal.tsx
"use client";

import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// โครงเดียวกับ ReviewModals เพื่อความเข้ากันได้
export type ReviewStatus = "pending" | "reviewed" | "fail";
export type InboxItem = {
  leave_request_id: number;
  status?: ReviewStatus;
  reason?: string;
  date_start?: string;
  date_end?: string;
  date_start_type?: "full" | "am" | "pm";
  date_end_type?: "full" | "am" | "pm";
  total_day?: number;
  leave_type_name?: string | null;
  user?: { name?: string; surname?: string; email?: string };
  files?: { key: string; url: string | null }[];
};

type Props = { open: boolean; item: InboxItem | null; onClose: () => void; };

const prettyHalf = (v?: string) => (v === "am" ? "เช้า" : v === "pm" ? "บ่าย" : v ? "เต็มวัน" : "");
const fmtDate = (d?: string) =>
  !d ? "-" : new Date(d).toLocaleDateString("th-TH",{ day:"numeric", month:"long", year:"numeric" });
const statusTH = (s?: ReviewStatus) =>
  s === "pending" ? "รอพิจารณา" : s === "reviewed" ? "ผ่าน" : s === "fail" ? "ไม่ผ่าน" : "-";
const badgeClass = (s?: ReviewStatus) =>
  s === "pending" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
  s === "reviewed" ? "bg-green-100 text-green-800 border-green-200" :
  s === "fail" ? "bg-red-100 text-red-800 border-red-200" :
  "bg-gray-100 text-gray-800 border-gray-200";

export default function ReviewHistoryModal({ open, item, onClose }: Props) {
  const fullName = React.useMemo(() => {
    if (!item?.user) return "-";
    const name = item.user.name ?? ""; const surname = item.user.surname ?? "";
    return `${name} ${surname}`.trim() || "-";
  }, [item]);

  const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

  return (
    <Dialog open={open} onOpenChange={(v)=>(!v?onClose():undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>รายละเอียดใบลา (ประวัติการตรวจสอบ)</DialogTitle>
          <DialogDescription>โหมดอ่านอย่างเดียว</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">รหัสลา</div>
                <div className="font-mono font-semibold text-blue-600">L{String(item.leave_request_id).padStart(3,"0")}</div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={badgeClass(item.status)}>สถานะ: {statusTH(item.status)}</Badge>
              </div>

              <div className="col-span-2">
                <div className="text-slate-500">ผู้ยื่น</div>
                <div className="font-medium">{fullName}</div>
                {item.user?.email ? <div className="text-xs text-slate-500">{item.user.email}</div> : null}
              </div>

              <div>
                <div className="text-slate-500">ประเภทการลา</div>
                <div className="font-medium">{item.leave_type_name ?? "-"}</div>
              </div>
              <div>
                <div className="text-slate-500">จำนวนวัน</div>
                <div className="font-medium">{item.total_day ?? "-"} วัน</div>
              </div>

              <div>
                <div className="text-slate-500">วันที่เริ่ม</div>
                <div className="font-medium">
                  {fmtDate(item.date_start)} {item.date_start_type ? `(${prettyHalf(item.date_start_type)})` : ""}
                </div>
              </div>
              <div>
                <div className="text-slate-500">วันที่สิ้นสุด</div>
                <div className="font-medium">
                  {fmtDate(item.date_end)} {item.date_end_type ? `(${prettyHalf(item.date_end_type)})` : ""}
                </div>
              </div>

              {item.reason ? (
                <div className="col-span-2">
                  <div className="text-slate-500">เหตุผลที่ผู้ยื่นระบุ</div>
                  <div className="p-3 border rounded-md bg-slate-50 text-slate-700">{item.reason}</div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="block mb-1">ไฟล์แนบ</Label>
              {!item.files || item.files.length === 0 ? (
                <div className="p-3 text-sm border rounded-md bg-muted/30 text-muted-foreground">ไม่มีไฟล์แนบ</div>
              ) : (
                <ul className="space-y-2" aria-label="ไฟล์แนบ">
                  {item.files.map((f) => {
                    const name = f.key.split("/").pop() ?? f.key;
                    const canOpen = !!(f.url && f.url.startsWith("http"));
                    return (
                      <li key={f.key} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center min-w-0 gap-2">
                          <span aria-hidden>📄</span>
                          <span className="text-sm font-medium truncate" title={name}>{name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button type="button" variant="outline" size="sm" className="h-8"
                            onClick={(e)=>{e.stopPropagation(); if (canOpen && f.url) window.open(f.url,"_blank","noopener");}}
                            title={canOpen ? "เปิดไฟล์ในแท็บใหม่" : "ไม่มีลิงก์ไฟล์"} disabled={!canOpen}>
                            เปิดไฟล์
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8"
                            onClick={(e)=>{e.stopPropagation(); if (f.url) copyToClipboard(f.url);}}
                            title="คัดลอกลิงก์" disabled={!f.url}>
                            คัดลอกลิงก์
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

