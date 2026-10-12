'use client';

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Pencil, Trash2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import {
  fetchLeaveRequestsByUserMock,
  fetchEntitlementByUserMock,
  type LeaveRequest as LeaveReqMock
} from "@/lib/services/leave.mock";

type Props = {
  employeeId: number;
  onBack?: () => void;
  onToggleSidebar?: () => void;
};

// แปลงเลขเดือน → label ไทยแบบสั้น
const TH_MONTH_LABELS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// คืน array 6 เดือนล่าสุด (เรียงเวลาเก่า→ใหม่), เช่น ['เม.ย.','พ.ค.','...','ก.ย.']
function getLastSixThaiMonths(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(TH_MONTH_LABELS[d.getMonth()]);
  }
  return out;
}

export default function EmployeeLeaveDetail({ employeeId, onBack }: Props) {
  const [allRequests, setAllRequests] = useState<LeaveReqMock[]>([]);
  const [entitlement, setEntitlement] = useState<{ total: number; used: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // โหลดเฉพาะของพนักงานคนนี้ (mock)
  const fetchEmployeeRequests = async () => {
    try {
      const { items } = await fetchLeaveRequestsByUserMock(employeeId);
      setAllRequests(items);
      const e = await fetchEntitlementByUserMock(employeeId);
      setEntitlement({ total: e.total, used: e.used });
    } catch (e) {
      console.error("Error fetching employee mock:", e);
      setAllRequests([]);
      setEntitlement(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchEmployeeRequests();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // โปรไฟล์จากคำขอลาทั้งหมดของ user นี้
  const profile = useMemo(() => {
    const byUser = allRequests.find((r) => r.user_id === employeeId)?.user;
    return {
      name: byUser ? `${byUser.name ?? ''} ${byUser.surname ?? ''}`.trim() : `User#${employeeId}`,
      position: byUser?.position ?? '-',
      department: byUser?.department ?? '-',
    };
  }, [allRequests, employeeId]);

  // Progress: รวมวันลา "อนุมัติแล้ว" แยกประเภท (สเกลเทียบประเภทที่ใช้มากสุด)
  const progress = useMemo(() => {
    const sumByType = new Map<string, number>();
    for (const r of allRequests) {
      if (r.status !== 'approved') continue;
      const key = r.leavetype?.leave_type_name || 'อื่นๆ';
      sumByType.set(key, (sumByType.get(key) || 0) + (r.total_day || 0));
    }
    const entries = Array.from(sumByType.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const maxUsed = entries[0]?.[1] || 1;
    return entries.map(([label, used]) => ({
      label,
      used,
      percent: Math.round((used / maxUsed) * 100) || 0,
      color: label.includes('ป่วย') ? 'bg-blue-600' : label.includes('กิจ') ? 'bg-emerald-600' : 'bg-amber-500',
    }));
  }, [allRequests]);

  // Timeline (6 เดือนล่าสุดแบบ dynamic) — นับตามเดือนเริ่มลา
  const lastSix = useMemo(() => getLastSixThaiMonths(), []);
  const timeline = useMemo(() => {
    const map: Record<string, number> = Object.fromEntries(lastSix.map(m => [m, 0]));
    for (const r of allRequests) {
      const m = new Date(r.date_start).getMonth();
      const label = TH_MONTH_LABELS[m];
      if (label in map) map[label] += 1;
    }
    return lastSix.map((m) => ({ m, v: map[m] || 0 }));
  }, [allRequests, lastSix]);

  // Radar: สัดส่วนประเภทการลา (ทุกสถานะ)
  const radar = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allRequests) {
      const key = r.leavetype?.leave_type_name || 'อื่นๆ';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ k, v }));
  }, [allRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto border-b-2 border-indigo-600 rounded-full animate-spin" />
          <p className="mt-3 text-slate-600">กำลังโหลดข้อมูลพนักงาน...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="ย้อนกลับ">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">สถิติการลาของ {profile.name} ประจำปี 2568</h2>
            <p className="mt-1 text-sm text-slate-600">
              ตำแหน่ง: {profile.position} | แผนก: {profile.department} | ID: {employeeId}
            </p>
            {entitlement && (
              <p className="mt-1 text-xs text-slate-500">
                สิทธิ์รวม: {entitlement.total} วัน | ใช้แล้ว: {entitlement.used} วัน | คงเหลือ: {entitlement.total - entitlement.used} วัน
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="text-white bg-emerald-600 hover:bg-emerald-700">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            ลบ
          </Button>
          <Button variant="secondary">
            <Pencil className="w-4 h-4 mr-2" />
            แก้ไข
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {progress.length ? progress.map((p) => (
          <Card key={p.label}>
            <CardHeader>
              <CardTitle className="text-base">{p.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-3 rounded-full bg-slate-200">
                <div className={`h-3 rounded-full ${p.color}`} style={{ width: `${p.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">ใช้แล้ว {p.used} วัน</p>
            </CardContent>
          </Card>
        )) : (
          <Card className="md:col-span-3">
            <CardContent className="py-8 text-center text-slate-500">ยังไม่มีข้อมูลการลาที่อนุมัติ</CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline - ประวัติการลาย้อนหลัง 6 เดือน</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="m" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รูปแบบการลา</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radar}>
              <PolarGrid />
              <PolarAngleAxis dataKey="k" />
              <PolarRadiusAxis />
              <Radar dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ประวัติการลา</CardTitle>
          <Badge variant="outline">ทั้งหมด {allRequests.length} รายการ</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="p-3 text-left">รหัสใบลา</th>
                  <th className="p-3 text-left">ประเภท</th>
                  <th className="p-3 text-left">ช่วงวันที่</th>
                  <th className="p-3 text-center">จำนวนวัน</th>
                  <th className="p-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {allRequests.map((r) => (
                  <tr key={r.leave_request_id} className="border-b border-slate-100">
                    <td className="p-3">{r.leave_request_id}</td>
                    <td className="p-3">{r.leavetype?.leave_type_name ?? '—'}</td>
                    <td className="p-3">
                      {r.date_start?.split('T')[0]} - {r.date_end?.split('T')[0]}
                    </td>
                    <td className="p-3 text-center">{r.total_day ?? 0}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">
                        {r.status === 'pending' ? 'รออนุมัติ' : r.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!allRequests.length && (
                  <tr>
                    <td className="p-6 text-center text-slate-500" colSpan={5}>ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}