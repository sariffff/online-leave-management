// app/academic/leave/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import AcademicSidebar from "@/components/academic/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReviewLeaveModal, { type InboxItem } from "@/components/academic/modals/ReviewLeaveModal";
import PlanSubstituteModal from "@/components/academic/modals/PlanSubstituteModal";

type LeaveListRow = {
  id: string;
  staffCode: string;
  fullName: string;
  email?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type?: string;
  date_end_type?: string;
  totalDays: number;
  status: string;
  submittedAt?: string;
  reason?: string | null;
  approvedBy?: string | null;
  comment?: string | null;
};

type ApiListResponse = {
  data: LeaveListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DetailResponse = {
  id: string;
  user: { id: string; code?: string; name: string; email?: string };
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type?: string;
  date_end_type?: string;
  totalDays: number;
  status: string;
  submittedAt?: string;
  reason?: string | null;
  comment?: string | null;
  reviewed_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  files?: { name: string; path: string; url: string }[];
  // ถ้า GET ใส่ช่วงวัน จะมี schedule/substitutions ด้วย แต่ตอนดูใบลาเฉย ๆ ไม่ได้ใช้
};

const API_LIST = "/api/academic/leaves";
const API_DETAIL = (id: string | number) => `/api/academic/leaves/${id}`;

function thDate(iso: string) {
  const d = new Date(iso);
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function normalizeHalf(v?: string | null): "full" | "am" | "pm" | undefined {
  const s = (v || "").toString().trim().toLowerCase();
  if (!s) return undefined;
  if (s === "full" || s === "am" || s === "pm") return s as any;
  if (["เต็มวัน", "ทั้งวัน"].includes(v as string)) return "full";
  if (["เช้า", "ครึ่งเช้า"].includes(v as string)) return "am";
  if (["บ่าย", "ครึ่งบ่าย"].includes(v as string)) return "pm";
  return undefined;
}

function mapDetailToInboxItem(d: DetailResponse): InboxItem {
  return {
    leave_request_id: Number(d.id),
    status: "pending",
    reason: d.reason ?? undefined,
    date_start: d.startDate,
    date_end: d.endDate,
    date_start_type: normalizeHalf(d.date_start_type) ?? "full",
    date_end_type: normalizeHalf(d.date_end_type) ?? "full",
    total_day: d.totalDays,
    leave_type_name: d.leaveType,
    user: {
      name: d.user?.name || "",
      surname: "",
      email: d.user?.email || "",
    },
    files: (d.files || []).map((f) => ({
      key: f.name || f.path,
      url: f.url || null,
    })),
  };
}

function LeaveRequestsTable({
  items,
  total,
  onReload,
}: {
  items: LeaveListRow[];
  total: number;
  onReload?: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<InboxItem | null>(null);

  const [planOpen, setPlanOpen] = useState(false);
  const [planCtx, setPlanCtx] = useState<{
    leaveId: string;              // ✅ เพิ่ม leaveId
    teacherName: string;
    subjectGroup?: string;
    dateRange: { start: string; end: string };
  } | null>(null);

  const handleAction = async ({
    action,
    id,
    note,
  }: {
    action: "reviewed" | "fail";
    id: number;
    note?: string;
  }) => {
    console.log("review action:", { action, id, note });
    setReviewOpen(false);
    onReload?.();
  };

  async function openReview(leaveId: string) {
    try {
      const res = await fetch(API_DETAIL(leaveId), { cache: "no-store" });
      const j: any = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "failed");
      const inbox = mapDetailToInboxItem(j as DetailResponse);
      setReviewItem(inbox);
      setReviewOpen(true);
    } catch (e: any) {
      alert(e?.message || "โหลดรายละเอียดใบลาไม่สำเร็จ");
    }
  }

  return (
    <>
      <div className="border rounded-lg bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold">รายการลา (ทั้งหมด {total} รายการ)</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>รหัสบุคลากร</th>
                <th>ชื่อ - สกุล</th>
                <th>ประเภทการลา</th>
                <th>วันที่ลา</th>
                <th>ถึงวันที่</th>
                <th className="text-center">จำนวนวัน</th>
                <th>เหตุผล</th>
                <th className="text-center">ใบลา</th>
                <th className="text-center">จัดครูผู้สอนแทน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t [&>td]:px-3 [&>td]:py-2">
                  <td className="font-medium">{r.staffCode || "-"}</td>
                  <td>{r.fullName}</td>
                  <td>
                    <Badge variant="secondary">{r.leaveType}</Badge>
                  </td>
                  <td>{thDate(r.startDate)}</td>
                  <td>{thDate(r.endDate)}</td>
                  <td className="text-center">{r.totalDays}</td>
                  <td className="max-w-[220px] truncate" title={r.reason || ""}>
                    {r.reason || "-"}
                  </td>
                  <td className="text-center">
                    <Button size="sm" variant="outline" onClick={() => openReview(r.id)}>
                      ดูใบลา
                    </Button>
                  </td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      style={{ backgroundColor: "#2563eb", color: "white" }}
                      onClick={() => {
                        setPlanCtx({
                          leaveId: r.id,                       // ✅ ส่ง leaveId
                          teacherName: r.fullName,
                          dateRange: { start: r.startDate, end: r.endDate },
                        });
                        setPlanOpen(true);
                      }}
                    >
                      จัดตาราง
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReviewLeaveModal
        open={reviewOpen}
        item={reviewItem}
        onClose={() => setReviewOpen(false)}
        onAction={handleAction}
      />

      {planCtx && (
        <PlanSubstituteModal
          open={planOpen}
          onOpenChange={setPlanOpen}
          leaveId={planCtx.leaveId}                 // ✅ ส่งเข้าโมดอล
          teacherName={planCtx.teacherName}
          subjectGroup={planCtx.subjectGroup}
          dateRange={planCtx.dateRange}
        />
      )}
    </>
  );
}

export default function AcademicLeavePage() {
  const [list, setList] = useState<LeaveListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadList() {
    try {
      setLoading(true);
      setErr(null);
      const url = new URL(API_LIST, window.location.origin);
      url.searchParams.set("status", "approved");
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));

      const res = await fetch(url.toString(), { cache: "no-store" });
      const j: any = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "failed");

      const data = (j as ApiListResponse).data || [];
      setList(data);
      setTotal((j as ApiListResponse).total || data.length);
    } catch (e: any) {
      setErr(e?.message || "โหลดรายการลาไม่สำเร็จ");
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  return (
    <div className="flex">
      <AcademicSidebar pendingCount={total} />
      <main className="flex-1 min-h-screen p-4 bg-gray-100 md:p-6">
        <div className="mx-auto max-w-[1200px] space-y-4">
          <div className="">
            <h1 className="text-lg font-semibold">รายการลา (ฝ่ายวิชาการ)</h1>
            {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}
          </div>

          {loading ? (
            <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground">
              กำลังโหลดข้อมูล…
            </div>
          ) : (
            <LeaveRequestsTable items={list} total={total} onReload={loadList} />
          )}
        </div>
      </main>
    </div>
  );
}
