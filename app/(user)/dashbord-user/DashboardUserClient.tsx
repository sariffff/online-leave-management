// app/user/dashboard/page.tsx
"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, CheckCircle2, XCircle, Filter, ChevronDown } from "lucide-react";
import UserSidebar from "@/components/user/UserSidebar";

export type LeaveRow = {
  id: string;
  leaveType: string;
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  status: string;        // ไทย
  status_code?: string;  // raw code จาก API (optional)
  submittedAt: string | null;
  reason?: string | null;
  approvedBy?: string | null;
};

const API = "/api/user/dashboard-user";

const COLORS = { approved: "#10B981", rejected: "#EF4444", pending: "#F59E0B", grid: "#E5E7EB" };
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const FY_MONTHS_TH = ["ต.ค.","พ.ย.","ธ.ค.","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย."]; // ต.ค.→ก.ย.

function getCurrentFY() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 10 ? y + 1 : y; // ต.ค.-ธ.ค. = FY ถัดไป
}

const utils = {
  formatMonthTH: (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTHS_TH[(m ?? 1) - 1]} ${String((y ?? 0) + 543)}`;
  },
  formatMonthTHFiscal: (fy: number, fmonth: number) => {
    // fmonth: 1..12 => ต.ค..ก.ย.
    const label = FY_MONTHS_TH[(fmonth - 1 + 12) % 12];
    return `${label} ${String(fy + 543)}`;
  },
  mapStatus: (statusOrCode: string) => {
    const s = (statusOrCode ?? "").trim().toLowerCase();
    // รหัสสถานะจริงจาก API ตัดสินก่อน (ป้ายภาษาไทย "ไม่อนุมัติ" มีคำว่า "อนุมัติ" อยู่ข้างใน)
    if (s === "approved" || s === "covered") return "อนุมัติ";
    if (s === "rejected" || s === "failed" || s === "cancelled") return "ไม่อนุมัติ";
    if (s === "pending" || s === "reviewed") return "รอพิจารณา";
    if (s.includes("ไม่อนุมัติ") || s.includes("ไม่ผ่าน") || s.includes("ยกเลิก")) return "ไม่อนุมัติ";
    if (s.includes("อนุมัติ")) return "อนุมัติ";
    return "รอพิจารณา";
  },
  formatPercent: (value: number, total: number) =>
    total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%",
  getStatusConfig: (status: string) => {
    const configs = {
      "อนุมัติ": { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
      "รอพิจารณา": { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
      "ไม่อนุมัติ": { icon: XCircle, color: "text-red-600", bg: "bg-red-50" }
    };
    return configs[status as keyof typeof configs] || configs["รอพิจารณา"];
  }
};

const chartStyles = {
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
  },
  axis: { fontSize: 12, fill: '#6B7280' },
  grid: { strokeDasharray: "3 3", stroke: COLORS.grid, opacity: 0.7 }
};

type Mode = "calendar" | "fiscal";

export default function UserDashboardClient({ initialYear, initialRows }: { initialYear: number; initialRows?: LeaveRow[] }) {
  const currentYear = initialYear || new Date().getFullYear();
  const currentFY = getCurrentFY();

  const [mode, setMode] = useState<Mode>("calendar"); // โหมดค้นหา
  const [filters, setFilters] = useState({
    year: currentYear,          // ใช้เมื่อ mode = calendar
    month: 0,                   // 0 = ทั้งปี (calendar)
    fy: currentFY,              // ใช้เมื่อ mode = fiscal
    fmonth: 0,                  // 0 = ทั้งปี (fiscal; 1=ต.ค.,...,12=ก.ย.)
    selectedTypes: [] as string[]
  });

  const typesOf = (rows: LeaveRow[]) => [...new Set(rows.map((r) => (r.leaveType ?? "").trim()).filter(Boolean) as string[])];
  const [data, setData] = useState({
    rows: initialRows ?? ([] as LeaveRow[]),
    types: initialRows ? typesOf(initialRows) : ([] as string[]),
    loading: !initialRows,
    error: null as string | null
  });
  // ข้อมูลเริ่มต้น (ปีปฏิทินปัจจุบัน ทั้งปี) มาจากเซิร์ฟเวอร์แล้ว → ไม่ต้องโหลดซ้ำ
  const loadedKey = useRef<string | null>(initialRows ? `calendar|${initialYear}|0|0|0` : null);

  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );
  const fyOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentFY - i),
    [currentFY]
  );

  // Fetch data
  useEffect(() => {
    const key = `${mode}|${filters.year}|${filters.month}|${filters.fy}|${filters.fmonth}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true }));

        const params = new URLSearchParams();
        if (mode === "fiscal") {
          params.set("fy", String(filters.fy));
          if (filters.fmonth > 0) params.set("fmonth", String(filters.fmonth));
        } else {
          params.set("year", String(filters.year));
          if (filters.month > 0) params.set("month", String(filters.month).padStart(2, "0"));
        }

        const response = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const result = await response.json();
        const rows: LeaveRow[] = result?.data ?? [];

        setData({
          rows,
          types: [...new Set(rows.map((r) => (r.leaveType ?? "").trim()).filter(Boolean) as string[])],
          loading: false,
          error: null
        });
      } catch (err) {
        setData(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ" }));
      }
    };

    fetchData();
  }, [mode, filters.year, filters.month, filters.fy, filters.fmonth]);

  // Filter data based on selected types
  const filteredRows = useMemo(() => {
    if (filters.selectedTypes.length === 0) return data.rows;
    return data.rows.filter(row =>
      filters.selectedTypes.includes((row.leaveType ?? "ไม่ระบุ").trim())
    );
  }, [data.rows, filters.selectedTypes]);

  // Process statistics
  const stats = useMemo(() => {
    const typeStats = new Map<string, { display: string; approved: number; rejected: number; pending: number }>();
    const monthlyStats = new Map<string, number>(); // key: calendar "YYYY-MM" (สำหรับ calendar) หรือ "FY-<fy>-<fmonth>"
    const statusStats = { อนุมัติ: 0, "ไม่อนุมัติ": 0, รอพิจารณา: 0 };
    let totalDays = 0;

    data.types.forEach(type =>
      typeStats.set(type.toLowerCase(), { display: type, approved: 0, rejected: 0, pending: 0 })
    );

    filteredRows.forEach(row => {
      const days = Number(row.totalDays || 0);
      const key = row.status_code ? row.status_code : row.status;
      const group = utils.mapStatus(key);

      totalDays += days;
      statusStats[group as keyof typeof statusStats] += days;

      const typeKey = (row.leaveType || "ไม่ระบุ").toLowerCase();
      if (!typeStats.has(typeKey)) {
        typeStats.set(typeKey, { display: row.leaveType || "ไม่ระบุ", approved: 0, rejected: 0, pending: 0 });
      }
      const acc = typeStats.get(typeKey)!;
      if (group === "อนุมัติ") acc.approved += days;
      else if (group === "ไม่อนุมัติ") acc.rejected += days;
      else acc.pending += days;

      if (group === "อนุมัติ" && row.startDate) {
        const d = new Date(row.startDate);
        if (mode === "calendar") {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthlyStats.set(monthKey, (monthlyStats.get(monthKey) || 0) + days);
        } else {
          // นับเป็น fmonth (ต.ค.=1)
          const calMonth = d.getMonth() + 1;
          const fy = calMonth >= 10 ? d.getFullYear() + 1 : d.getFullYear();
          const fmonth = ((calMonth + 2) % 12) + 1; // map: 10->1, 11->2, 12->3, 1->4 ... 9->12
          const key = `FY-${fy}-${fmonth}`;
          monthlyStats.set(key, (monthlyStats.get(key) || 0) + days);
        }
      }
    });

    const byType = Array.from(typeStats.values())
      .sort((a, b) => data.types.indexOf(a.display) - data.types.indexOf(b.display))
      .map(stat => ({
        type: stat.display,
        อนุมัติ: +stat.approved.toFixed(1),
        "ไม่อนุมัติ": +stat.rejected.toFixed(1),
        รอพิจารณา: +stat.pending.toFixed(1)
      }));

    let monthlyTrend: { monthTH: string; days: number }[] = [];

    if (mode === "calendar") {
      monthlyTrend = (filters.month === 0
        ? Array.from({ length: 12 }, (_, i) => {
            const monthKey = `${filters.year}-${String(i + 1).padStart(2, "0")}`;
            return { monthTH: utils.formatMonthTH(monthKey), days: monthlyStats.get(monthKey) || 0 };
          })
        : [{
            monthTH: utils.formatMonthTH(`${filters.year}-${String(filters.month).padStart(2, "0")}`),
            days: monthlyStats.get(`${filters.year}-${String(filters.month).padStart(2, "0")}`) || 0
          }]
      );
    } else {
      // โหมดปีงบประมาณ (FY)
      const fy = filters.fy;
      if (filters.fmonth === 0) {
        monthlyTrend = Array.from({ length: 12 }, (_, i) => {
          const fmonth = i + 1; // 1..12
          const key = `FY-${fy}-${fmonth}`;
          return { monthTH: utils.formatMonthTHFiscal(fy, fmonth), days: monthlyStats.get(key) || 0 };
        });
      } else {
        const fmonth = filters.fmonth;
        const key = `FY-${fy}-${fmonth}`;
        monthlyTrend = [{ monthTH: utils.formatMonthTHFiscal(fy, fmonth), days: monthlyStats.get(key) || 0 }];
      }
    }

    const statusPieData = Object.entries(statusStats).map(([name, value]) => ({ name, value }));

    return { byType, monthlyTrend, statusPieData, totalDays: +totalDays.toFixed(1), statusStats };
  }, [filteredRows, data.types, filters.year, filters.month, filters.fy, filters.fmonth, mode]);

  // Loading
  if (data.loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <UserSidebar />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto border-4 border-gray-200 rounded-full border-t-indigo-600 animate-spin" />
            <p className="mt-4 font-medium text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (data.error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <UserSidebar />
        <div className="flex-1 p-6">
          <div className="max-w-md p-6 mx-auto mt-20 border border-red-200 bg-red-50 rounded-xl">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="font-semibold text-red-800">เกิดข้อผิดพลาด</h3>
                <p className="mt-1 text-sm text-red-600">{data.error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // UI
  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">แดชบอร์ดการลาของฉัน</h1>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Mode switch */}
              <div className="flex items-center gap-2">
                <Button
                  variant={mode === "calendar" ? "default" : "outline"}
                  onClick={() => setMode("calendar")}
                >ปีปฏิทิน</Button>
                <Button
                  variant={mode === "fiscal" ? "default" : "outline"}
                  onClick={() => setMode("fiscal")}
                >ปีงบประมาณ</Button>
              </div>

              {/* Leave Type Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-white border-gray-200 shadow-sm">
                    <Filter className="w-4 h-4 mr-2" />
                    ประเภทการลา
                    {filters.selectedTypes.length > 0 && (
                      <span className="px-2 py-1 ml-2 text-xs text-indigo-700 bg-indigo-100 rounded-full">
                        {filters.selectedTypes.length}
                      </span>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <h4 className="text-sm font-semibold">เลือกประเภทการลา</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, selectedTypes: [] }))}
                        className="h-auto p-1 text-xs text-gray-500"
                      >
                        ล้างตัวเลือก
                      </Button>
                    </div>
                    {data.types.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={filters.selectedTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            setFilters(prev => ({
                              ...prev,
                              selectedTypes: checked
                                ? [...prev.selectedTypes, type]
                                : prev.selectedTypes.filter(t => t !== type)
                            }));
                          }}
                        />
                        <label htmlFor={type} className="flex-1 text-sm cursor-pointer">
                          {type}
                        </label>
                      </div>
                    ))}
                    {data.types.length === 0 && (
                      <p className="py-2 text-sm text-center text-gray-500">ไม่มีข้อมูลประเภทการลา</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Year/FY filter */}
              {mode === "calendar" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">ปี (พ.ศ.)</span>
                  <Select value={String(filters.year)} onValueChange={(v) => setFilters(prev => ({ ...prev, year: Number(v) }))}>
                    <SelectTrigger className="bg-white border-gray-200 shadow-sm w-36">
                      <SelectValue placeholder="เลือกปี" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">ปีงบ (พ.ศ.)</span>
                  <Select value={String(filters.fy)} onValueChange={(v) => setFilters(prev => ({ ...prev, fy: Number(v) }))}>
                    <SelectTrigger className="bg-white border-gray-200 shadow-sm w-36">
                      <SelectValue placeholder="เลือกปีงบ" />
                    </SelectTrigger>
                    <SelectContent>
                      {fyOptions.map(fy => (
                        <SelectItem key={fy} value={String(fy)}>{fy + 543}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Month/FMonth filter */}
              {mode === "calendar" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">เดือน</span>
                  <Select value={String(filters.month)} onValueChange={(v) => setFilters(prev => ({ ...prev, month: Number(v) }))}>
                    <SelectTrigger className="bg-white border-gray-200 shadow-sm w-44">
                      <SelectValue placeholder="เลือกเดือน" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">ทั้งปี</SelectItem>
                      {MONTHS_TH.map((m, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">เดือน (ปีงบ)</span>
                  <Select value={String(filters.fmonth)} onValueChange={(v) => setFilters(prev => ({ ...prev, fmonth: Number(v) }))}>
                    <SelectTrigger className="bg-white border-gray-200 shadow-sm w-44">
                      <SelectValue placeholder="เลือกเดือน (ปีงบ)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">ทั้งปีงบ</SelectItem>
                      {FY_MONTHS_TH.map((m, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats cards */}
          <div className="grid grid-cols-1 gap-4 mt-6 md:grid-cols-3">
            {(() => {
              const summaryTotal = filteredRows.reduce((sum, r) => sum + (Number(r.totalDays) || 0), 0);
              const cards = Object.entries(stats.statusStats).map(([status, days]) => {
                const config = utils.getStatusConfig(status);
                const IconComponent = config.icon;
                return (
                  <div key={status} className={`${config.bg} rounded-xl p-4 border border-opacity-20`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{status}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{days}</p>
                        <p className="text-xs text-gray-500">
                          คิดเป็น {utils.formatPercent(days, summaryTotal)} ของทั้งหมด
                        </p>
                      </div>
                      <IconComponent className={`w-8 h-8 ${config.color}`} />
                    </div>
                  </div>
                );
              });
              return cards;
            })()}
          </div>
        </div>

        {/* Charts */}
        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            {/* Bar Chart */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <h2 className="mb-6 text-xl font-bold text-gray-900">สรุปการลาตามประเภท</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.byType} barCategoryGap="20%">
                    <CartesianGrid {...chartStyles.grid} />
                    <XAxis dataKey="type" tick={chartStyles.axis} axisLine={{ stroke: COLORS.grid }} />
                    <YAxis allowDecimals={false} tick={chartStyles.axis} axisLine={{ stroke: COLORS.grid }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} วัน`, name]}
                      contentStyle={chartStyles.tooltip}
                    />
                    <Legend />
                    <Bar dataKey="อนุมัติ" stackId="a" fill={COLORS.approved} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ไม่อนุมัติ" stackId="a" fill={COLORS.rejected} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="รอพิจารณา" stackId="a" fill={COLORS.pending} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stats Panel */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <h2 className="mb-6 text-xl font-bold text-gray-900">สถิติการลา</h2>

                {/* Line Chart */}
                <div className="mb-8">
                  <h3 className="mb-4 text-sm font-semibold text-gray-700">
                    เทรนด์การลาที่อนุมัติ — {mode === "calendar"
                      ? (filters.month === 0 ? "ทั้งปี (ปฏิทิน)" : "เฉพาะเดือน (ปฏิทิน)")
                      : (filters.fmonth === 0 ? "ทั้งปีงบ" : "เฉพาะเดือน (ปีงบ)")}
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={stats.monthlyTrend}>
                      <CartesianGrid {...chartStyles.grid} />
                      <XAxis dataKey="monthTH" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: COLORS.grid }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: COLORS.grid }} />
                      <Tooltip
                        formatter={(value: number) => [`${value} วัน`, "อนุมัติ"]}
                        contentStyle={{ ...chartStyles.tooltip, borderRadius: '8px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="days"
                        stroke={COLORS.approved}
                        strokeWidth={3}
                        dot={{ r: 4, fill: COLORS.approved }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div>
                  <h3 className="mb-4 text-sm font-semibold text-gray-700">สัดส่วนตามสถานะ</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                        paddingAngle={2}
                        label={({ name, value }) =>
                          `${name}: ${value} วัน (${utils.formatPercent(value, stats.totalDays)})`
                        }
                        labelLine={false}
                      >
                        {stats.statusPieData.map((entry, index) => {
                          const color =
                            entry.name === "อนุมัติ" ? COLORS.approved :
                            entry.name === "ไม่อนุมัติ" ? COLORS.rejected :
                            COLORS.pending;
                          return <Cell key={index} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} วัน (${utils.formatPercent(value, stats.totalDays)})`,
                          name
                        ]}
                        contentStyle={{ ...chartStyles.tooltip, borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
