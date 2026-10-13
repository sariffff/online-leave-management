"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/LeaveSummary";
import type { LeaveItem } from "@/components/shared/types";
import { apiFetch } from "@/lib/client/api";
import { thaiDate, TH_MONTHS_SHORT } from "@/lib/format";
import { getFiscalYearFromISO } from "@/utils/year";

type QuotaRow = { leave_type_id: number; name: string; used: number; total: number | null; unlimited: boolean };

/** ย้อนหลัง 6 เดือนล่าสุด (เก่า → ใหม่) เป็น { key: 'YYYY-MM', label } */
function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: TH_MONTHS_SHORT[d.getMonth()] };
  });
}

export default function EmployeeLeaveDetail({ employeeId, onBack }: { employeeId: string; onBack?: () => void }) {
  const [rows, setRows] = useState<LeaveItem[]>([]);
  const [quota, setQuota] = useState<QuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const fy = getFiscalYearFromISO(new Date().toISOString().slice(0, 10));
    setLoading(true);
    Promise.all([
      apiFetch<{ data: LeaveItem[] }>(`/api/director/dashboard-data?mode=all&userId=${employeeId}`, { signal: ac.signal }),
      apiFetch<{ items: QuotaRow[] }>(`/api/director/employee-quota?userId=${employeeId}&year=${fy}`, { signal: ac.signal }),
    ])
      .then(([d, q]) => {
        setRows(d.data);
        setQuota(q.items);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [employeeId]);

  const name = rows[0]?.user.fullName || "บุคลากร";

  const timeline = useMemo(() => {
    const months = lastSixMonths();
    const count = new Map(months.map((m) => [m.key, 0]));
    for (const r of rows) {
      const k = r.startDate.slice(0, 7);
      if (count.has(k)) count.set(k, (count.get(k) ?? 0) + 1);
    }
    return months.map((m) => ({ m: m.label, v: count.get(m.key) ?? 0 }));
  }, [rows]);

  const radar = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.leaveType, (map.get(r.leaveType) ?? 0) + 1);
    return [...map].map(([k, v]) => ({ k, v }));
  }, [rows]);

  const usedTypes = quota.filter((q) => q.used > 0 || (!q.unlimited && ["ลาป่วย", "ลากิจส่วนตัว", "ลาพักผ่อน"].includes(q.name)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-b-2 border-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" className="shrink-0" onClick={onBack} aria-label="ย้อนกลับ">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">สถิติการลาของ {name}</h2>
          <p className="mt-1 text-sm text-slate-600">ปีงบประมาณปัจจุบัน • ใบลาทั้งหมด {rows.length} รายการ</p>
        </div>
      </div>

      {error && <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{error}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {usedTypes.length ? (
          usedTypes.slice(0, 6).map((q) => {
            const pct = q.total ? Math.min(100, Math.round((q.used / q.total) * 100)) : 0;
            return (
              <Card key={q.leave_type_id}>
                <CardHeader>
                  <CardTitle className="text-base">{q.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-3 rounded-full bg-slate-200">
                    <div className="h-3 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    ใช้แล้ว {q.used} {q.unlimited ? "วัน (ไม่จำกัดสิทธิ์)" : `/ ${q.total} วัน`}
                  </p>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-slate-500">ยังไม่มีการใช้สิทธิ์ลาในปีงบประมาณนี้</CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการลาย้อนหลัง 6 เดือน (จำนวนใบลา)</CardTitle>
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

      {radar.length > 1 && (
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
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ประวัติการลา</CardTitle>
          <Badge variant="outline">ทั้งหมด {rows.length} รายการ</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="p-3 text-left">ประเภท</th>
                  <th className="p-3 text-left">ช่วงวันที่</th>
                  <th className="p-3 text-center">จำนวนวัน</th>
                  <th className="p-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-3">{r.leaveType}</td>
                    <td className="p-3">
                      {r.startDate === r.endDate ? thaiDate(r.startDate, true) : `${thaiDate(r.startDate, true)} – ${thaiDate(r.endDate, true)}`}
                    </td>
                    <td className="p-3 text-center">{r.totalDays}</td>
                    <td className="p-3 text-center">
                      <StatusPill code={r.status_code} />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="p-6 text-center text-slate-500" colSpan={4}>
                      ไม่มีข้อมูล
                    </td>
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
