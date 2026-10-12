// app/supervisor/inbox/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/supervisor/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle, XCircle, Eye } from "lucide-react";

// ชนิดข้อมูลที่ API ส่งกลับ (ให้ตรงกับ /api/supervisor/inbox)
type InboxItem = {
  leave_request_id: number;
  status?: "pending" | "reviewed" | "approved" | "rejected";
  reason?: string;
  date_start?: string;       // YYYY-MM-DD
  date_end?: string;         // YYYY-MM-DD
  date_start_type?: string;  // "full" | "am" | "pm"
  date_end_type?: string;    // "full" | "am" | "pm"
  total_day?: number;
  leave_type_name?: string | null;
  user?: { name?: string; surname?: string; email?: string };
};

export default function LeaveReviewPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [leaveType, setLeaveType] = useState<string>("ทุกประเภท");

  // โหลดครั้งเดียว
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/supervisor/leave-review", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
        if (!cancelled) setItems(json.data || []);
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setItems([]);
          alert(e?.message || "เกิดข้อผิดพลาดในการโหลด");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ดึงรายการประเภทลา จากข้อมูลที่โหลดมา (เพื่อใส่ใน <Select>)
  const leaveTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const name = it.leave_type_name || "-";
      if (name) set.add(name);
    });
    return ["ทุกประเภท", ...Array.from(set)];
  }, [items]);

  // filter แบบง่าย: ตามประเภท + ค้นหาชื่อ/อีเมล/รหัส/เหตุผล
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((it) =>
        leaveType === "ทุกประเภท" ? true : (it.leave_type_name || "-") === leaveType
      )
      .filter((it) => {
        if (!q) return true;
        const idText = `L${String(it.leave_request_id).padStart(3, "0")}`.toLowerCase();
        const nameText = `${it.user?.name || ""} ${it.user?.surname || ""}`.toLowerCase();
        const emailText = (it.user?.email || "").toLowerCase();
        const reasonText = (it.reason || "").toLowerCase();
        return (
          idText.includes(q) ||
          nameText.includes(q) ||
          emailText.includes(q) ||
          reasonText.includes(q)
        );
      });
  }, [items, leaveType, searchQuery]);

  // helper แปลงวันที่ (พื้นฐาน)
  const formatDate = (d?: string) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  // ปุ่มดำเนินการ (ตอนนี้ยังไม่ต่อ PATCH — ทำแบบ placeholder ง่าย ๆ ไว้ก่อน)
  const handleView = (row: InboxItem) => {
    alert(`ดูรายละเอียดใบลา: L${String(row.leave_request_id).padStart(3, "0")}`);
    // ต่อไปสามารถ router.push(`/supervisor/requests/${row.leave_request_id}`)
  };
  const handleApprove = (id: number) => {
    alert(`(ตัวอย่าง) อนุมัติ L${String(id).padStart(3, "0")} — ภายหลังค่อยต่อ PATCH`);
  };
  const handleReject = (id: number) => {
    alert(`(ตัวอย่าง) ไม่อนุมัติ L${String(id).padStart(3, "0")} — ภายหลังค่อยต่อ PATCH`);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar ซ้าย */}
      <Sidebar pendingCount={items.filter((x) => x.status === "pending").length} />

      {/* เนื้อหา */}
      <div className="flex-1 p-6">
        {/* หัวหน้าเรื่อง */}
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-800">รายการรอตรวจสอบการลา</h1>
          <p className="text-gray-600">รายการขอลาที่รอการตรวจสอบและอนุมัติ</p>
        </div>

        {/* สรุปจำนวนที่ถูก filter แล้ว */}
        <div className="mb-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-blue-800">
              รายการที่แสดง: <span className="font-bold">{filtered.length}</span> รายการ
            </p>
          </div>
        </div>

        <Card className="border bg-white shadow-sm">
          <CardContent className="p-6">
            {/* แถบค้นหา + เลือกประเภท */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="ค้นหา ชื่อ/อีเมล/รหัส/เหตุผล..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="ประเภทการลา" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ตาราง */}
            {loading ? (
              <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล…</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-700">
                      <th className="px-4 py-3 font-medium">รหัสลา</th>
                      <th className="px-4 py-3 font-medium">ชื่อ - สกุล</th>
                      <th className="px-4 py-3 font-medium">ประเภทการลา</th>
                      <th className="px-4 py-3 font-medium">วันที่ลา</th>
                      <th className="px-4 py-3 font-medium">วันที่สิ้นสุดการลา</th>
                      <th className="px-4 py-3 text-center font-medium">จำนวนวัน</th>
                      <th className="px-4 py-3 text-center font-medium">การจัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      filtered.map((req, i) => (
                        <tr
                          key={req.leave_request_id}
                          className={`border-t ${i % 2 ? "bg-gray-50" : "bg-white"}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium text-blue-600">
                              L{String(req.leave_request_id).padStart(3, "0")}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {(req.user?.name || "-") + " " + (req.user?.surname || "")}
                            </div>
                            <div className="text-xs text-gray-500">{req.user?.email || "-"}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                              {req.leave_type_name || "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-gray-700">
                            {formatDate(req.date_start)}
                            {req.date_start_type ? ` (${req.date_start_type})` : ""}
                          </td>

                          <td className="px-4 py-3 text-gray-700">
                            {formatDate(req.date_end)}
                            {req.date_end_type ? ` (${req.date_end_type})` : ""}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                              {req.total_day ?? "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1 border-blue-300 px-3 py-1 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleView(req)}
                              >
                                <Eye className="h-3 w-3" />
                                ดูใบลา
                              </Button>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                                onClick={() => handleApprove(req.leave_request_id)}
                              >
                                <CheckCircle className="h-3 w-3" />
                                ผ่าน
                              </Button>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                                onClick={() => handleReject(req.leave_request_id)}
                              >
                                <XCircle className="h-3 w-3" />
                                ไม่ผ่าน
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
