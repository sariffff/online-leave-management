"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type ReviewStatus = "pending" | "reviewed" | "fail";
export type InboxItem = {
  leave_request_id: number;
  status?: ReviewStatus;
  reason?: string;
  date_start?: string;
  date_end?: string;
  date_start_type?: string;
  date_end_type?: string;
  total_day?: number;
  leave_type_name?: string | null;
  user?: { name?: string; surname?: string; email?: string };
  files?: { key: string; url: string | null }[];
};
export default function ReviewLeaveModal({ open, item, onClose, onAction }:{
  open:boolean; item:InboxItem|null; onClose:()=>void;
  onAction:(p:{ action:"reviewed"|"fail"; id:number; note?:string })=>void|Promise<void>;
}) {
  const [note,setNote]=useState("");
  useEffect(()=>{ if(!open) setNote(""); },[open]);
  const fullName = useMemo(()=>`${item?.user?.name||""} ${item?.user?.surname||""}`.trim()||"-",[item]);
  const pretty = (v?:string)=> v==="am"?"เช้า": v==="pm"?"บ่าย":"เต็มวัน";
  const fmt = (d?:string)=> !d?"-":new Date(d).toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});

  return (
    <Dialog open={open} onOpenChange={(v)=>!v&&onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>รายละเอียดใบลา</DialogTitle></DialogHeader>
        {item && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-muted-foreground">รหัสใบลา</div><div className="font-mono">L{String(item.leave_request_id).padStart(3,"0")}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground">ผู้ยื่น</div><div className="font-medium">{fullName}</div><div className="text-xs text-muted-foreground">{item.user?.email}</div></div>
              <div><div className="text-muted-foreground">ประเภท</div><div className="font-medium">{item.leave_type_name||"-"}</div></div>
              <div><div className="text-muted-foreground">จำนวนวัน</div><div className="font-medium">{item.total_day??"-"} วัน</div></div>
              <div><div className="text-muted-foreground">เริ่ม</div><div className="font-medium">{fmt(item.date_start)} ({pretty(item.date_start_type)})</div></div>
              <div><div className="text-muted-foreground">สิ้นสุด</div><div className="font-medium">{fmt(item.date_end)} ({pretty(item.date_end_type)})</div></div>
              {item.reason && <div className="col-span-2"><div className="text-muted-foreground">เหตุผล</div><div className="p-3 border rounded bg-muted/30">{item.reason}</div></div>}
            </div>
            <div>
              <Label className="block mb-1">ไฟล์แนบ</Label>
              {!item.files?.length ? (
                <div className="p-3 border rounded bg-muted/30 text-muted-foreground">ไม่มีไฟล์</div>
              ) : (
                <ul className="space-y-2">
                  {item.files.map(f=>(
                    <li key={f.key} className="flex items-center justify-between p-2 border rounded">
                      <span className="truncate">{f.key.split("/").pop()}</span>
                      <Button size="sm" variant="outline" disabled={!f.url} onClick={()=>f.url && window.open(f.url,"_blank","noopener")}>เปิด</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
