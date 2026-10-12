// File: /components/director/EmployeeTable.tsx
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Download } from "lucide-react";

// ===================== Types =====================
export type LeaveRequest = {
  id: number;
  user_id?: number | null;
  leave_type_id: number;
  status: "pending" | "approved" | "rejected";
  total_day: number;
  date_start: string;
  date_end: string;
  leavetype?: { leave_type_name: string } | null;
  user?: { name?: string | null; surname?: string | null; email?: string | null } | null;
};

type EmployeeRow = {
  id: number;
  name: string;
  sickUsed: number;
  personalUsed: number;
  vacationUsed: number;
  studyUsed: number;
};

type EntitlementForUser = {
  sick?: number;
  personal?: number;
  vacation?: number;
  study?: number;
};

type Category = "sick" | "personal" | "vacation" | "study" | "other";

interface EmployeeTableProps {
  /** ข้อมูลใบลาที่ผ่านการกรองแล้ว (เช่น ปี/เดือน/สถานะ) จากเพจด้านนอก */
  filteredRequests: LeaveRequest[];
  /** เมื่อกดดูรายละเอียดของพนักงาน */
  onViewDetail: (employeeId: number) => void;
  /** เมื่อกด Export */
  onExport: () => void;
  /** สิทธิทั้งหมด/ปี ต่อประเภทของแต่ละ user; key = user_id (ออปชัน) */
  entitlements?: Record<number, EntitlementForUser>;
  /** ปิด/เปิดช่องค้นหาชื่อ (ออปชัน: default = true) */
  showSearch?: boolean;
  /**
   * mapping เสริม: กรณีอยาก map leave_type_id -> category ให้ชัดเจนแทนการเดาชื่อ
   * ตัวอย่าง: { 1: "sick", 2: "personal", 3: "vacation", 4: "study" }
   */
  leaveTypeIdToCategory?: Partial<Record<number, Exclude<Category, "other">>>;
}

// ===================== Component =====================
export default function EmployeeTable({
  filteredRequests,
  onViewDetail,
  onExport,
  entitlements,
  showSearch = true,
  leaveTypeIdToCategory,
}: EmployeeTableProps) {
  const [employeeQuery, setEmployeeQuery] = useState("");

  // จัดหมวดประเภทลา 4 กลุ่ม
  const categorize = (r: LeaveRequest): Category => {
    // 1) หากมี mapping แบบ id -> category ให้ใช้ก่อน
    const mapped = leaveTypeIdToCategory?.[r.leave_type_id];
    if (mapped) return mapped;

    // 2) เดาจากชื่อประเภท
    const name = (r.leavetype?.leave_type_name || "").toLowerCase();
    if (name.includes("ป่วย")) return "sick";
    if (name.includes("กิจ")) return "personal";
    if (name.includes("พักผ่อน") || name.includes("ประจำปี")) return "vacation";
    if (name.includes("ศึกษา") || name.includes("ดูงาน") || name.includes("อบรม")) return "study";

    // 3) fallback
    return "other";
  };

  // รวมยอดต่อคน/ต่อประเภท (นับเฉพาะที่อนุมัติ approved)
  const employeeSummary: EmployeeRow[] = useMemo(() => {
    const map = new Map<number | string, EmployeeRow>();

    for (const r of filteredRequests) {
      const safeId = (r.user_id ?? r.id ?? "NA") as number | string;
      const parts = [r.user?.name, r.user?.surname].filter(Boolean) as string[];
      const safeName = parts.length ? parts.join(" ") : `User#${safeId}`;

      if (!map.has(safeId)) {
        map.set(safeId, {
          id: Number.isFinite(Number(safeId)) ? Number(safeId) : -1,
          name: safeName,
          sickUsed: 0,
          personalUsed: 0,
          vacationUsed: 0,
          studyUsed: 0,
        });
      }

      if (r.status !== "approved") continue;

      const used = r.total_day || 0;
      const type = categorize(r);
      const row = map.get(safeId)!;
      if (type === "sick") row.sickUsed += used;
      else if (type === "personal") row.personalUsed += used;
      else if (type === "vacation") row.vacationUsed += used;
      else if (type === "study") row.studyUsed += used;
    }

    const q = employeeQuery.trim().toLowerCase();
    return Array.from(map.values())
      .filter((e) => !q || e.name.toLowerCase().includes(q)) // ค้นหาเฉพาะชื่อ
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [filteredRequests, employeeQuery, leaveTypeIdToCategory]);

  // format number: สูงสุด 2 ทศนิยม, ตัดศูนย์ทิ้ง
  const fmtNum = (n: number) => Number(n.toFixed(2)).toString();
  // แสดง "ใช้/สิทธิ" เช่น 10/45 ; ถ้าไม่มีสิทธิทั้งหมด → 10/—
  const fmtUsedTotal = (used: number, total?: number) =>
    `${fmtNum(used)}${typeof total === "number" ? `/${fmtNum(total)}` : "/—"}`;

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          รายชื่อบุคลากร - สิทธิการลา
        </CardTitle>
        <div className="flex items-center gap-2">
          {showSearch && (
            <input
              value={employeeQuery}
              onChange={(e) => setEmployeeQuery(e.target.value)}
              placeholder="ค้นหา: ชื่อ"
              className="w-64 px-3 py-2 text-sm bg-white border rounded-md outline-none focus:ring focus:ring-blue-100"
            />
          )}
          <Button
            onClick={onExport}
            size="sm"
            variant="outline"
            className="border-green-200 hover:bg-green-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="p-4 font-semibold text-left text-slate-700">ชื่อ-นามสกุล</th>
                <th className="p-4 font-semibold text-center text-slate-700">ลาป่วย (ใช้/สิทธิ)</th>
                <th className="p-4 font-semibold text-center text-slate-700">ลากิจ (ใช้/สิทธิ)</th>
                <th className="p-4 font-semibold text-center text-slate-700">ลาพักผ่อน (ใช้/สิทธิ)</th>
                <th className="p-4 font-semibold text-center text-slate-700">ลาศึกษา/ดูงาน (ใช้/สิทธิ)</th>
                <th className="p-4 font-semibold text-center text-slate-700">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {employeeSummary.length > 0 ? (
                employeeSummary.map((emp, idx) => {
                  const quota = entitlements?.[emp.id] ?? {};
                  return (
                    <tr
                      key={`emp-${emp.id !== -1 ? emp.id : "na"}-${idx}`}
                      className="transition-colors border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-4 font-medium text-slate-900">{emp.name}</td>

                      {/* ลาป่วย */}
                      <td className="p-4 text-center">
                        <Badge className="text-red-700 border-red-200 bg-red-50 hover:bg-red-100">
                          {fmtUsedTotal(emp.sickUsed, quota.sick)}
                        </Badge>
                      </td>

                      {/* ลากิจ */}
                      <td className="p-4 text-center">
                        <Badge className="text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100">
                          {fmtUsedTotal(emp.personalUsed, quota.personal)}
                        </Badge>
                      </td>

                      {/* ลาพักผ่อน */}
                      <td className="p-4 text-center">
                        <Badge className="text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100">
                          {fmtUsedTotal(emp.vacationUsed, quota.vacation)}
                        </Badge>
                      </td>

                      {/* ลาศึกษา/ดูงาน */}
                      <td className="p-4 text-center">
                        <Badge className="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
                          {fmtUsedTotal(emp.studyUsed, quota.study)}
                        </Badge>
                      </td>

                      <td className="p-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:bg-blue-50"
                          onClick={() => {
                            if (emp.id !== -1) onViewDetail(emp.id);
                          }}
                          disabled={emp.id === -1}
                          title={emp.id === -1 ? "ไม่พบรหัสผู้ใช้" : "รายละเอียด"}
                        >
                          รายละเอียด
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={6}>
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
