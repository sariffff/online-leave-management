"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AlertTriangle, BarChart3, CalendarCheck, Download, FileText, ListFilter, RefreshCw, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import EmployeeLeaveDetail from "@/components/director/EmployeeLeaveDetail";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import { apiFetch } from "@/lib/client/api";

/* ===================== Types ===================== */
type ApiItem = {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status_code: string;
  outcome: "approved" | "rejected";
  user: { name: string; surname: string; email: string };
};

type ApiSummary =
  | {
      byUser?: { userId: string; name?: string; surname?: string; email?: string; count: number }[];
      byType?: { name: string; count: number }[];
      byStatus?: { approved: number; rejected: number };
    }
  | undefined;

type ApiResponse = { data: ApiItem[]; total: number; summary?: ApiSummary };

/* ===================== Utils ===================== */
type TimeMode = "fy" | "month";
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** เดือนเรียงตามปีงบ ต.ค. → ก.ย. */
const FY_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const PALETTE = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#a855f7", "#22c55e", "#f97316"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toFiscalYear = (d: Date) => (d.getMonth() + 1 >= 10 ? d.getFullYear() + 1 : d.getFullYear());
/** ปี ค.ศ. ของเดือนนั้นในปีงบ (ต.ค.–ธ.ค. อยู่ปีก่อน) */
const calYearOf = (fy: number, month: number) => (month >= 10 ? fy - 1 : fy);

/** ส่งออก CSV (เปิดด้วย Excel ได้ — ใส่ BOM ให้อ่านภาษาไทยถูก) */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function TypeChecklistDropdown({
  title,
  allItems,
  selected,
  onChange,
}: {
  title: string;
  allItems: { name: string; color: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? Array.from(new Set([...selected, name])) : selected.filter((n) => n !== name));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <ListFilter className="w-4 h-4" /> <span className="hidden sm:inline">เลือกประเภท</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex gap-2 px-2 py-1.5">
          <Button size="sm" variant="secondary" onClick={() => onChange(allItems.map((d) => d.name))}>เลือกทั้งหมด</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>ล้าง</Button>
        </div>
        <DropdownMenuSeparator />
        {allItems.map((t) => (
          <DropdownMenuCheckboxItem
            key={t.name}
            checked={selected.includes(t.name)}
            onCheckedChange={(c) => toggle(t.name, !!c)}
            onSelect={(e) => e.preventDefault()}
            className="cursor-pointer"
          >
            <span className="inline-block w-3 h-3 mr-2 rounded" style={{ backgroundColor: t.color }} />
            {t.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function LeaveDashboard() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiItem[]>([]);
  const [apiSummary, setApiSummary] = useState<ApiSummary>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const currentFY = toFiscalYear(now);
  const [timeMode, setTimeMode] = useState<TimeMode>("fy");
  const [selectedYear, setSelectedYear] = useState(currentFY); // ปีงบ (ค.ศ.)
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  const [barTypes, setBarTypes] = useState<string[]>([]);
  const [pieTypes, setPieTypes] = useState<string[]>([]);

  // ปีงบย้อนหลัง 6 ปี — เลือกได้เสมอแม้ปีนั้นยังไม่มีข้อมูล (เดิมสร้างจากข้อมูลของปีที่เลือกอยู่ จึงเปลี่ยนปีไม่ได้)
  const fyOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => currentFY - i), [currentFY]);

  /* ===================== Fetch ===================== */
  const url = useMemo(
    () =>
      timeMode === "month"
        ? `/api/director/dashboard-data?mode=month&year=${calYearOf(selectedYear, selectedMonth)}&month=${selectedMonth}`
        : `/api/director/dashboard-data?mode=fy&year=${selectedYear}`,
    [timeMode, selectedYear, selectedMonth]
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiFetch<ApiResponse>(url, { signal });
        setRows(Array.isArray(json?.data) ? json.data : []);
        setApiSummary(json?.summary);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  /* ===================== Derivations ===================== */
  const todayISO = ymd(now);
  // ลาวันนี้: ใบที่อนุมัติแล้วและช่วงลาครอบคลุมวันนี้ (เดิมนับเฉพาะใบที่เริ่ม/สิ้นสุดวันนี้)
  const onLeaveToday = useMemo(
    () => new Set(rows.filter((r) => r.outcome === "approved" && r.startDate <= todayISO && todayISO <= r.endDate).map((r) => r.userId)).size,
    [rows, todayISO]
  );
  const showToday = timeMode === "fy" ? selectedYear === currentFY : calYearOf(selectedYear, selectedMonth) === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  const typeBreakdown = useMemo(() => {
    if (apiSummary?.byType?.length) {
      return apiSummary.byType.map((t, i) => ({ name: t.name, value: t.count, color: PALETTE[i % PALETTE.length] }));
    }
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.leaveType || "ไม่ระบุ", (map.get(r.leaveType || "ไม่ระบุ") || 0) + 1);
    return Array.from(map, ([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  }, [apiSummary, rows]);

  useEffect(() => {
    const names = typeBreakdown.map((d) => d.name);
    setBarTypes((prev) => (prev.length ? prev.filter((n) => names.includes(n)) : names));
    setPieTypes((prev) => (prev.length ? prev.filter((n) => names.includes(n)) : names));
  }, [typeBreakdown]);

  const barData = useMemo(() => typeBreakdown.filter((d) => barTypes.includes(d.name)), [typeBreakdown, barTypes]);
  const pieData = useMemo(() => {
    const arr = typeBreakdown.filter((d) => pieTypes.includes(d.name));
    const total = arr.reduce((a, d) => a + d.value, 0) || 1;
    return arr.map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }));
  }, [typeBreakdown, pieTypes]);

  // แนวโน้ม: โหมดปีงบ = รายเดือน ต.ค.→ก.ย., โหมดรายเดือน = รายวัน
  const trend = useMemo(() => {
    if (timeMode === "fy") {
      const bucket = new Map<number, number>();
      for (const r of rows) {
        const m = Number(r.startDate.slice(5, 7));
        bucket.set(m, (bucket.get(m) ?? 0) + 1);
      }
      return FY_ORDER.map((m) => ({ label: TH_MONTHS[m - 1], leaves: bucket.get(m) ?? 0 }));
    }
    const y = calYearOf(selectedYear, selectedMonth);
    const days = new Date(y, selectedMonth, 0).getDate();
    const bucket = new Map<number, number>();
    for (const r of rows) {
      if (Number(r.startDate.slice(0, 4)) !== y || Number(r.startDate.slice(5, 7)) !== selectedMonth) continue;
      const d = Number(r.startDate.slice(8, 10));
      bucket.set(d, (bucket.get(d) ?? 0) + 1);
    }
    return Array.from({ length: days }, (_, i) => ({ label: String(i + 1), leaves: bucket.get(i + 1) ?? 0 }));
  }, [rows, timeMode, selectedYear, selectedMonth]);

  type EmpRow = { employeeId: string; name: string; email: string; leaveCount: number };
  const employeeSummary: EmpRow[] = useMemo(() => {
    if (apiSummary?.byUser?.length) {
      return apiSummary.byUser.map((u) => ({
        employeeId: u.userId,
        name: [u.name, u.surname].filter(Boolean).join(" ") || u.email || u.userId,
        email: u.email || "—",
        leaveCount: u.count,
      }));
    }
    const map = new Map<string, EmpRow>();
    for (const r of rows) {
      const name = [r.user?.name, r.user?.surname].filter(Boolean).join(" ") || r.user?.email || r.userId;
      const e = map.get(r.userId);
      if (e) e.leaveCount += 1;
      else map.set(r.userId, { employeeId: r.userId, name, email: r.user?.email || "—", leaveCount: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.leaveCount - a.leaveCount || a.name.localeCompare(b.name, "th"));
  }, [apiSummary, rows]);

  const periodText =
    timeMode === "fy" ? `ปีงบ ${selectedYear + 543}` : `${TH_MONTHS[selectedMonth - 1]} ${calYearOf(selectedYear, selectedMonth) + 543}`;

  const handleExport = () => {
    downloadCsv(`สรุปการลา-${periodText.replace(/\s/g, "-")}.csv`, [
      ["สรุปการลา", periodText],
      [],
      ["ลำดับ", "ชื่อ-นามสกุล", "อีเมล", "จำนวนใบลา"],
      ...employeeSummary.map((e, i) => [i + 1, e.name, e.email, e.leaveCount]),
      [],
      ["ประเภทการลา", "จำนวนใบลา"],
      ...typeBreakdown.map((t) => [t.name, t.value]),
    ]);
  };

  if (selectedEmployeeId) {
    return (
      <PageContainer>
        <EmployeeLeaveDetail employeeId={selectedEmployeeId} onBack={() => setSelectedEmployeeId(null)} />
      </PageContainer>
    );
  }

  const selectCls = "h-10 px-3 text-sm bg-white border rounded-md";
  const dim = loading ? "opacity-50 pointer-events-none" : "";

  return (
    <PageContainer>
      <PageHeader
        title="สถิติสรุปการลา"
        description={`ใบลาที่อนุมัติ / ไม่อนุมัติ — ${periodText}`}
        actions={
          <Button onClick={handleExport} disabled={loading || rows.length === 0} className="h-10 text-white bg-emerald-600 hover:bg-emerald-700">
            <Download className="w-4 h-4" /> ส่งออก Excel (CSV)
          </Button>
        }
      />

      {/* ตัวเลือกช่วงเวลา */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-white border shadow-sm sm:flex sm:flex-wrap sm:items-center sm:p-4 rounded-xl">
        <div className="flex col-span-2 gap-1 p-1 border rounded-md bg-gray-50">
          <Button size="sm" className="flex-1" variant={timeMode === "fy" ? "default" : "ghost"} onClick={() => setTimeMode("fy")}>
            รายปี (ปีงบ)
          </Button>
          <Button size="sm" className="flex-1" variant={timeMode === "month" ? "default" : "ghost"} onClick={() => setTimeMode("month")}>
            รายเดือน
          </Button>
        </div>
        <select aria-label="ปีงบประมาณ" value={selectedYear} onChange={(e) => setSelectedYear(+e.target.value)} className={`${selectCls} ${timeMode === "fy" ? "col-span-2 sm:col-span-1" : ""}`}>
          {fyOptions.map((y) => (
            <option key={y} value={y}>ปีงบ {y + 543}</option>
          ))}
        </select>
        {timeMode === "month" && (
          <select aria-label="เดือน" value={selectedMonth} onChange={(e) => setSelectedMonth(+e.target.value)} className={selectCls}>
            {FY_ORDER.map((m) => (
              <option key={m} value={m}>{TH_MONTHS[m - 1]} {calYearOf(selectedYear, m) + 543}</option>
            ))}
          </select>
        )}
        <Button onClick={() => load()} variant="outline" className="h-10 col-span-2 sm:col-span-1" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
        </Button>
      </div>

      {error && (
        <div className="flex flex-col gap-2 p-4 text-sm text-red-700 border border-red-200 sm:flex-row sm:items-center sm:justify-between bg-red-50 rounded-xl">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> โหลดข้อมูลไม่สำเร็จ: {error}</span>
          <Button size="sm" variant="outline" onClick={() => load()}>ลองใหม่</Button>
        </div>
      )}

      {/* KPI */}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 transition-opacity ${dim}`} aria-busy={loading}>
        <Card className="text-white border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium opacity-90">ลาวันนี้</CardTitle>
            <CalendarCheck className="w-5 h-5 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{showToday ? `${onLeaveToday} คน` : "–"}</div>
            {!showToday && <p className="mt-1 text-xs opacity-80">แสดงเมื่อเลือกช่วงเวลาปัจจุบัน</p>}
          </CardContent>
        </Card>
        <Card className="text-white border-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium opacity-90">บุคลากรที่มีใบลา</CardTitle>
            <Users className="w-5 h-5 opacity-80" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{employeeSummary.length} คน</div></CardContent>
        </Card>
        <Card className="text-white border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium opacity-90">ใบลาทั้งหมด</CardTitle>
            <FileText className="w-5 h-5 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rows.length} ใบ</div>
            <p className="mt-1 text-xs opacity-90">
              อนุมัติ {apiSummary?.byStatus?.approved ?? 0} · ไม่อนุมัติ {apiSummary?.byStatus?.rejected ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 transition-opacity ${dim}`}>
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="w-5 h-5" /> ใบลาแยกตามประเภท</CardTitle>
            <TypeChecklistDropdown title="แสดงประเภท" allItems={typeBreakdown} selected={barTypes} onChange={setBarTypes} />
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} ใบ`, "จำนวน"]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Users className="w-5 h-5" /> สัดส่วน (%)</CardTitle>
            <TypeChecklistDropdown title="แสดงประเภท" allItems={typeBreakdown} selected={pieTypes} onChange={setPieTypes} />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="42%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v, n, i) => [`${v} ใบ (${(i?.payload as { pct?: number } | undefined)?.pct ?? 0}%)`, String(n)]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(name: string) => `${name} ${pieData.find((d) => d.name === name)?.pct ?? 0}%`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BarChart3 className="w-5 h-5" /> แนวโน้มจำนวนใบลา{timeMode === "fy" ? "รายเดือน" : "รายวัน"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={timeMode === "fy" ? 0 : "preserveStartEnd"} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} ใบ`, "ใบลา"]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="leaves" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* รายชื่อบุคลากร + จำนวนใบลา */}
      <Card className={`border shadow-sm transition-opacity ${dim}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Users className="w-5 h-5" /> รายชื่อบุคลากร — จำนวนใบลา</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {employeeSummary.length === 0 ? (
            <p className="py-8 text-center text-gray-500">{loading ? "กำลังโหลด..." : "ไม่มีข้อมูลในช่วงที่เลือก"}</p>
          ) : (
            <>
              {/* มือถือ: การ์ด */}
              <ul className="border-t divide-y md:hidden">
                {employeeSummary.map((emp, i) => (
                  <li key={emp.employeeId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{i + 1}. {emp.name}</div>
                      <div className="text-xs text-gray-500 truncate">{emp.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="text-blue-700 border-blue-200 bg-blue-50">{emp.leaveCount} ใบ</Badge>
                      <Button size="sm" variant="outline" className="h-9" onClick={() => setSelectedEmployeeId(emp.employeeId)}>ดู</Button>
                    </div>
                  </li>
                ))}
              </ul>
              {/* จอ md ขึ้นไป: ตาราง (หัวตาราง 5 คอลัมน์ ตรงกับข้อมูล) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-slate-700">
                      <th className="w-16 p-3 font-semibold text-left">ลำดับ</th>
                      <th className="p-3 font-semibold text-left">ชื่อ-นามสกุล</th>
                      <th className="p-3 font-semibold text-left">อีเมล</th>
                      <th className="p-3 font-semibold text-center">จำนวนใบลา</th>
                      <th className="p-3 font-semibold text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeSummary.map((emp, i) => (
                      <tr key={emp.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{i + 1}</td>
                        <td className="p-3 font-medium text-slate-900">{emp.name}</td>
                        <td className="p-3 break-all text-slate-600">{emp.email}</td>
                        <td className="p-3 text-center">
                          <Badge className="text-blue-700 border-blue-200 bg-blue-50">{emp.leaveCount} ใบ</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50" onClick={() => setSelectedEmployeeId(emp.employeeId)}>
                            ดูรายละเอียด
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
