// File: /components/director/ChartsSection.tsx
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  TrendingUp,
  FileText,
  ListFilter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// Types
type LeaveRequest = {
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

type TypeData = {
  name: string;
  value: number;
  color: string;
};

type TrendData = {
  month?: string;
  day?: number;
  leaves: number;
};

// Props interface
interface ChartsSectionProps {
  filteredRequests: LeaveRequest[];
  selectedYear: number;
  selectedMonth: number;
  timeMode: "year" | "month";
  TH_MONTHS: string[];
}

// Reusable dropdown component
function TypeChecklistDropdown({
  title,
  triggerText,
  allItems,
  selected,
  onChange,
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
    onChange(
      checked
        ? Array.from(new Set([...selected, name]))
        : selected.filter((n) => n !== name)
    );

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
          <Button size="sm" variant="secondary" onClick={selectAll}>
            เลือกทั้งหมด
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>
            ล้างทั้งหมด
          </Button>
        </div>
        <DropdownMenuSeparator />
        {allItems.map((t) => (
          <DropdownMenuCheckboxItem
            key={t.name}
            checked={selected.includes(t.name)}
            onCheckedChange={(c) => toggle(t.name, !!c)}
            className="cursor-pointer"
          >
            <span
              className="inline-block w-3 h-3 mr-2 rounded"
              style={{ backgroundColor: t.color }}
            />
            {t.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ChartsSection({
  filteredRequests,
  selectedYear,
  selectedMonth,
  timeMode,
  TH_MONTHS,
}: ChartsSectionProps) {
  const [barTypes, setBarTypes] = React.useState<string[]>([]);
  const [pieTypes, setPieTypes] = React.useState<string[]>([]);
  const [trendMonthPick, setTrendMonthPick] = React.useState("ทั้งหมด");

  // Helper function
  const toDate = (s?: string) => (s ? new Date(s) : null);

  // Calculate type breakdown - same logic as the original table
  const typeBreakdown: TypeData[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRequests) {
      const key = r.leavetype?.leave_type_name || "อื่นๆ";
      map.set(key, (map.get(key) || 0) + 1);
    }
    const palette = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#a855f7"];
    return Array.from(map, ([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [filteredRequests]);

  // Update selected types when typeBreakdown changes
  React.useEffect(() => {
    const names = typeBreakdown.map((d) => d.name);
    setBarTypes((prev) => (prev.length ? prev.filter((n) => names.includes(n)) : names));
    setPieTypes((prev) => (prev.length ? prev.filter((n) => names.includes(n)) : names));
  }, [typeBreakdown]);

  // Prepare chart data
  const barData = useMemo(
    () => typeBreakdown.filter((d) => barTypes.includes(d.name)),
    [typeBreakdown, barTypes]
  );

  const pieData = useMemo(() => {
    const arr = typeBreakdown.filter((d) => pieTypes.includes(d.name));
    const total = arr.reduce((a, d) => a + d.value, 0) || 1;
    return arr.map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }));
  }, [typeBreakdown, pieTypes]);

  // Monthly trend data
  const monthlyTrend: TrendData[] = useMemo(() => {
    const bucket: Record<string, number> = {};
    for (const r of filteredRequests) {
      const d = toDate(r.date_start) ?? toDate(r.date_end);
      if (!d || d.getFullYear() !== selectedYear) continue;
      const label = TH_MONTHS[d.getMonth()];
      bucket[label] = (bucket[label] || 0) + 1;
    }
    return TH_MONTHS.map((m) => ({ month: m, leaves: bucket[m] || 0 }));
  }, [filteredRequests, selectedYear, TH_MONTHS]);

  // Daily trend data
  const dailyTrend: TrendData[] = useMemo(() => {
    if (timeMode !== "month") return [];
    const days = new Date(selectedYear, selectedMonth, 0).getDate();
    const bucket: Record<number, number> = {};
    for (let i = 1; i <= days; i++) bucket[i] = 0;
    for (const r of filteredRequests) {
      const d = toDate(r.date_start) ?? toDate(r.date_end);
      if (!d || d.getFullYear() !== selectedYear || d.getMonth() + 1 !== selectedMonth) continue;
      bucket[d.getDate()] = (bucket[d.getDate()] || 0) + 1;
    }
    return Array.from({ length: days }, (_, i) => ({ day: i + 1, leaves: bucket[i + 1] || 0 }));
  }, [filteredRequests, timeMode, selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Charts Row 1: Bar + Pie */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-lg lg:col-span-2 bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              จำนวนการลาแต่ละประเภท
            </CardTitle>
            <TypeChecklistDropdown
              title="แสดงประเภท (Bar)"
              triggerText="เลือกประเภท"
              allItems={typeBreakdown}
              selected={barTypes}
              onChange={setBarTypes}
            />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!barData.length && (
              <p className="mt-3 text-sm text-center text-slate-500">
                ยังไม่ได้เลือกประเภทที่จะแสดง
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              สัดส่วนประเภทการลา (%)
            </CardTitle>
            <TypeChecklistDropdown
              title="แสดงประเภท (Pie)"
              triggerText="เลือกประเภท"
              allItems={typeBreakdown}
              selected={pieTypes}
              onChange={setPieTypes}
            />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n: any, i: any) => [
                    `${v} รายการ (${i?.payload?.pct ?? 0}%)`,
                    i?.payload?.name,
                  ]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-1 gap-2 mt-3 text-sm">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                    <span>{d.name}</span>
                  </div>
                  <span className="text-slate-600">{d.pct}%</span>
                </div>
              ))}
              {!pieData.length && (
                <p className="mt-1 text-sm text-center text-slate-500">
                  ยังไม่ได้เลือกประเภทที่จะแสดง
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Trend */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {timeMode === "year"
              ? "เทรนด์การลารายเดือน"
              : `เทรนด์การลา - ${TH_MONTHS[selectedMonth - 1]} ${selectedYear + 543}`}
          </CardTitle>
          {timeMode === "year" && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">เดือน:</label>
              <select
                value={trendMonthPick}
                onChange={(e) => setTrendMonthPick(e.target.value)}
                className="px-2 py-1 text-sm border rounded-md"
              >
                <option value="ทั้งหมด">ทั้งหมด</option>
                {TH_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {timeMode === "year" ? (
              <LineChart
                data={trendMonthPick === "ทั้งหมด" ? monthlyTrend : monthlyTrend.filter((d) => d.month === trendMonthPick)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <Line type="monotone" dataKey="leaves" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            ) : (
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <Line type="monotone" dataKey="leaves" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}