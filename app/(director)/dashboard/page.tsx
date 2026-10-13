"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, FileText, Download, Calendar, ListFilter } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import EmployeeLeaveDetail from "@/components/director/EmployeeLeaveDetail";
import DirectorLeaveSidebar from "@/components/director/sidebar";

/* ===================== Types ===================== */
type LeaveStatus = "approved" | "rejected";
type ApiItem = {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  date_start_type: string;
  date_end_type: string;
  totalDays: number;
  status: string;
  status_code: string;
  outcome: LeaveStatus;
  submittedAt: string | null;
  reason: string | null;
  comment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  user: { name: string; surname: string; email: string };
};

type ApiSummary = {
  byUser?: { userId: string; name?: string; surname?: string; email?: string; count: number }[];
  byType?: { name: string; count: number }[];
  byStatus?: { approved: number; rejected: number };
} | undefined;

type ApiResponse = {
  data: ApiItem[];
  total: number;
  requestCount: number;
  summary?: ApiSummary;
  yearsInData?: number[];
  monthsInYear?: { month: number; count: number }[];
  page: number;
  pageSize: number;
  totalPages: number;
  mode?: string;
  year?: number;
  month?: number;
};

/* ===================== Utils ===================== */
type View = "dashboard" | "detail";
type TimeMode = "fy" | "month"; // ใช้ปีงบประมาณเป็นค่าเริ่มต้น
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const M_EN_TO_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function toDateSafe(s?: string | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}
function toDateOnlyStr(s?: string | null): string | null {
  if (!s) return null;
  if (s.includes("T")) return s.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = toDateSafe(s);
  return d ? ymd(d) : null;
}

// แปลงวันที่ → ปีงบประมาณ (ค.ศ.)  FY(y) = 1 ต.ค. (y-1) – 30 ก.ย. (y)
function toFiscalYear(date: Date): number {
  const m = date.getMonth() + 1; // 1-12
  const y = date.getFullYear();
  return m >= 10 ? y + 1 : y;
}

function TypeChecklistDropdown({
  title, triggerText, allItems, selected, onChange,
}: {
  title: string;
  triggerText: string;
  allItems: { name: string; color: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectAll = () => onChange(allItems.map((d) => d.name));
  const clearAll = () => onChange([]);
  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? Array.from(new Set([...selected, name])) : selected.filter((n) => n !== name));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListFilter className="w-4 h-4" /> {triggerText}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 flex gap-2">
          <Button size="sm" variant="secondary" onClick={selectAll}>เลือกทั้งหมด</Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>ล้างทั้งหมด</Button>
        </div>
        <DropdownMenuSeparator />
        {allItems.map((t) => (
          <DropdownMenuCheckboxItem
            key={t.name}
            checked={selected.includes(t.name)}
            onCheckedChange={(c) => toggle(t.name, !!c)}
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
  const [view, setView] = useState<View>("dashboard");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiItem[]>([]);
  const [apiSummary, setApiSummary] = useState<ApiSummary>(undefined);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const defaultFY = toFiscalYear(now);
  const [timeMode, setTimeMode] = useState<TimeMode>("fy");                 // เริ่มที่ปีงบ
  const [selectedYear, setSelectedYear] = useState(defaultFY);              // ปีงบ (ค.ศ.)
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);   // 1-12 (ค.ศ.)

  const [yearsInData, setYearsInData] = useState<number[]>([]);
  const [barTypes, setBarTypes] = useState<string[]>([]);
  const [pieTypes, setPieTypes] = useState<string[]>([]);

  /* ===================== Fetch ===================== */
  const buildUrl = () => {
    if (timeMode === "month") {
      // เดือน ต.ค.–ธ.ค. เป็นปลายปีก่อนของปีงบ → แปลงปีค.ศ. ก่อนยิง API
      const calendarYearForMonth = selectedMonth >= 10 ? (selectedYear - 1) : selectedYear;
      return `/api/director/dashboard-data?mode=month&year=${calendarYearForMonth}&month=${selectedMonth}`;
    }
    return `/api/director/dashboard-data?mode=fy&year=${selectedYear}`;
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(buildUrl(), { cache: "no-store" });
      const json: ApiResponse & { error?: string } = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || "FETCH_FAILED");

      const list = Array.isArray(json?.data) ? json.data : [];
      setRows(list);
      setApiSummary(json?.summary);

      // สร้างชุดปีสำหรับดรอปดาวน์
      if (timeMode === "fy") {
        // คำนวณปีงบจาก rows เพื่อความแม่นยำกับข้อมูลจริง
        const fySet = new Set<number>();
        for (const r of list) {
          const ds = toDateSafe(r.startDate); if (ds) fySet.add(toFiscalYear(ds));
          const de = toDateSafe(r.endDate);   if (de) fySet.add(toFiscalYear(de));
        }
        const arr = Array.from(fySet).sort((a, b) => a - b);
        setYearsInData(arr.length ? arr : [selectedYear]);
      } else {
        // โหมดรายเดือน: ใช้ yearsInData จาก server ถ้ามี ไม่งั้นคำนวณจากปีค.ศ.
        if (Array.isArray(json?.yearsInData) && json.yearsInData.length) {
          setYearsInData(json.yearsInData.sort((a: number, b: number) => a - b));
        } else {
          const ys = new Set<number>();
          list.forEach((r: ApiItem) => {
            const ds = toDateSafe(r.startDate); if (ds) ys.add(ds.getFullYear());
            const de = toDateSafe(r.endDate);   if (de) ys.add(de.getFullYear());
          });
          const arr = Array.from(ys).sort((a, b) => a - b);
          setYearsInData(arr.length ? arr : [selectedYear]);
        }
      }
    } catch (e) {
      console.error(e);
      setRows([]);
      setApiSummary(undefined);
      setYearsInData([selectedYear]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, timeMode]);

  /* ===================== Derivations ===================== */
  const filtered = useMemo(() => rows, [rows]);

  const todayISO = useMemo(() => ymd(new Date()), []);
  const totalRequestsToday = useMemo(() => {
    return rows.filter((r) => {
      const s = toDateOnlyStr(r.startDate);
      const e = toDateOnlyStr(r.endDate);
      return s === todayISO || e === todayISO;
    }).length;
  }, [rows, todayISO]);

  // Breakdown ประเภท
  const typeBreakdown = useMemo(() => {
    const palette = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#a855f7","#22c55e","#f97316"];
    if (apiSummary?.byType?.length) {
      return apiSummary.byType.map((t, i) => ({
        name: t.name,
        value: t.count,
        color: palette[i % palette.length],
      }));
    }
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = r.leaveType || "ไม่ระบุ";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map, ([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [apiSummary, filtered]);

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

  // เทรนด์รายเดือน (ถ้าโหมด FY เรียง Oct→Sep)
  const monthlyTrend = useMemo(() => {
    const bucket: Record<number, number> = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0};
    for (const r of filtered) {
      const d = toDateSafe(r.startDate) ?? toDateSafe(r.endDate);
      if (!d) continue;
      const m = d.getMonth() + 1;
      bucket[m] = (bucket[m] || 0) + 1;
    }
    if (timeMode === "fy") {
      const order = [10,11,12,1,2,3,4,5,6,7,8,9];
      return order.map((m) => ({ month: M_EN_TO_TH[m-1], leaves: bucket[m] || 0 }));
    }
    return Array.from({ length: 12 }, (_, i) => ({ month: TH_MONTHS[i], leaves: bucket[i + 1] || 0 }));
  }, [filtered, timeMode]);

  const dailyTrend = useMemo(() => {
    if (timeMode !== "month") return [];
    // แปลงปีค.ศ.ตามเดือน (ต.ค.–ธ.ค. ย้อนปี)
    const calendarYearForMonth = selectedMonth >= 10 ? (selectedYear - 1) : selectedYear;
    const days = new Date(calendarYearForMonth, selectedMonth, 0).getDate();
    const bucket: Record<number, number> = {};
    for (let i = 1; i <= days; i++) bucket[i] = 0;
    for (const r of filtered) {
      const d = toDateSafe(r.startDate) ?? toDateSafe(r.endDate);
      if (!d) continue;
      if (d.getFullYear() !== calendarYearForMonth || d.getMonth() + 1 !== selectedMonth) continue;
      bucket[d.getDate()] = (bucket[d.getDate()] || 0) + 1;
    }
    return Array.from({ length: days }, (_, i) => ({ day: i + 1, leaves: bucket[i + 1] || 0 }));
  }, [filtered, timeMode, selectedYear, selectedMonth]);

  // ตาราง “นับใบลาต่อคน”
  type EmpRow = { employeeId: string; name: string; email: string; leaveCount: number };
  const employeeSummary: EmpRow[] = useMemo(() => {
    if (apiSummary?.byUser?.length) {
      return apiSummary.byUser
        .map((u) => ({
          employeeId: u.userId,
          name: [u.name, u.surname].filter(Boolean).join(" ") || u.email || u.userId,
          email: u.email || "—",
          leaveCount: u.count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
    }
    const map = new Map<string, EmpRow>();
    for (const r of filtered) {
      const employeeId = r.userId || r.user?.email || r.id;
      const fullName = [r.user?.name, r.user?.surname].filter(Boolean).join(" ") || r.user?.email || employeeId;
      const email = r.user?.email || "—";
      const existed = map.get(employeeId);
      if (existed) existed.leaveCount += 1;
      else map.set(employeeId, { employeeId, name: fullName, email, leaveCount: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [apiSummary, filtered]);

  const handleExport = () => {
    const data = {
      filters: { timeMode, selectedYear, selectedMonth, barTypes, pieTypes },
      kpis: { totalRequestsToday },
      charts: { bar: barData, pie: pieData, trend: timeMode === "fy" ? monthlyTrend : (timeMode === "month" ? dailyTrend : monthlyTrend) },
      employeeSummary,
      raw: filtered,
      apiSummary,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-dashboard-${ymd(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto border-b-2 border-blue-600 rounded-full animate-spin" />
          <p className="mt-4 text-slate-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <DirectorLeaveSidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          {view === "detail" && selectedEmployeeId ? (
            <EmployeeLeaveDetail
              employeeId={selectedEmployeeId}
              onBack={() => { setView("dashboard"); setSelectedEmployeeId(null); }}
            />
          ) : (
            <div className="container mx-auto space-y-6">
              {/* Header + Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                    สถิติสรุปการลา
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 border rounded-md bg-white/70">
                    <Button
                      size="sm"
                      variant={timeMode === "fy" ? "default" : "ghost"}
                      onClick={() => setTimeMode("fy")}
                    >
                      รายปี (ปีงบ)
                    </Button>
                    <Button
                      size="sm"
                      variant={timeMode === "month" ? "default" : "ghost"}
                      onClick={() => setTimeMode("month")}
                    >
                      รายเดือน
                    </Button>
                  </div>

                  {/* ปี: แสดง พ.ศ. แต่เก็บค่าเป็น ค.ศ. */}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(+e.target.value)}
                    className="px-2 py-2 text-sm border rounded-md bg-white/80"
                    title="เลือกปี"
                  >
                    {(yearsInData.length ? yearsInData : [selectedYear]).map((y) => (
                      <option key={y} value={y}>{y + 543}</option>
                    ))}
                  </select>

                  {/* เดือน: แสดงเฉพาะโหมดรายเดือน */}
                  {timeMode === "month" && (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(+e.target.value)}
                      className="px-2 py-2 text-sm border rounded-md bg-white/80"
                      title="เลือกเดือน"
                    >
                      {TH_MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
                    </select>
                  )}

                  <Button onClick={load} variant="outline" className="border-blue-200 hover:bg-blue-50">รีเฟรช</Button>
                  <Button onClick={handleExport} className="text-white shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </div>
              </div>

              {/* KPI: แสดง 2 การ์ด */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="text-white border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">ใบลาวันนี้</CardTitle>
                    <Calendar className="w-5 h-5 opacity-80" />
                  </CardHeader>
                  <CardContent><div className="text-3xl font-bold">{totalRequestsToday} ใบ</div></CardContent>
                </Card>

                <Card className="text-white border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">พนักงานที่มีใบลา (ช่วงที่เลือก)</CardTitle>
                    <Users className="w-5 h-5 opacity-80" />
                  </CardHeader>
                  <CardContent><div className="text-3xl font-bold">{employeeSummary.length} คน</div></CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="border-0 shadow-lg lg:col-span-2 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> จำนวนใบลาแยกตามประเภท</CardTitle>
                    <TypeChecklistDropdown title="แสดงประเภท (Bar)" triggerText="เลือกประเภท" allItems={typeBreakdown} selected={barTypes} onChange={setBarTypes} />
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={typeBreakdown.filter((d)=>barTypes.includes(d.name))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }} />
                        <Bar dataKey="value" radius={[4,4,0,0]}>
                          {typeBreakdown.filter((d)=>barTypes.includes(d.name)).map((e,i)=>(<Cell key={i} fill={e.color} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> สัดส่วนใบลา (%)</CardTitle>
                    <TypeChecklistDropdown title="แสดงประเภท (Pie)" triggerText="เลือกประเภท" allItems={typeBreakdown} selected={pieTypes} onChange={setPieTypes} />
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                          {pieData.map((e,i)=>(<Cell key={i} fill={e.color} />))}
                        </Pie>
                        <Tooltip
                          formatter={(v, _n, i) => [`${v} ใบ (${(i?.payload as { pct?: number } | undefined)?.pct ?? 0}%)`, (i?.payload as { name?: string } | undefined)?.name ?? ""]}
                          contentStyle={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* ตารางนับใบลาต่อคน */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> รายชื่อบุคลากร - นับจำนวนใบลา</CardTitle>
                  <Button onClick={handleExport} size="sm" variant="outline" className="border-green-200 hover:bg-green-50">
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="w-1/3 p-4 font-semibold text-left text-slate-700">ลำดับ</th>
                          <th className="p-4 font-semibold text-left text-slate-700">ชื่อ-นามสกุล</th>
                          <th className="p-4 font-semibold text-left text-slate-700">อีเมล</th>
                          <th className="p-4 font-semibold text-center text-slate-700">จำนวนใบลา</th>
                          <th className="p-4 font-semibold text-center text-slate-700">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeSummary.length ? employeeSummary.map((emp) => (
                          <tr key={emp.employeeId} className="transition-colors border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-4 font-medium text-slate-900">{emp.name}</td>
                            <td className="p-4 text-slate-600">{emp.email}</td>
                            <td className="p-4 text-center">
                              <Badge className="text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100">{emp.leaveCount} ใบ</Badge>
                            </td>
                            <td className="p-4 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => { setSelectedEmployeeId(emp.employeeId); setView("detail"); }}
                                title="ดูรายละเอียด"
                              >
                                ดูรายละเอียด
                              </Button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td className="p-6 text-center text-slate-500" colSpan={4}>ไม่มีข้อมูล</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
