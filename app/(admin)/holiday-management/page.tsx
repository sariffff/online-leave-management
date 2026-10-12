"use client";

import { useState, useMemo } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Table as TableIcon, Plus, Edit, Trash2, Globe, GraduationCap, Search } from "lucide-react";

// mock data
const mockHolidays = [
  { id: 1, name: "วันปีใหม่", start: "2025-01-01", end: "2025-01-01", type: "Public", status: "active" },
  { id: 2, name: "วันสงกรานต์", start: "2025-04-13", end: "2025-04-15", type: "Public", status: "active" },
  { id: 3, name: "ปิดภาคเรียน", start: "2025-10-01", end: "2025-10-15", type: "School", status: "active" },
  { id: 4, name: "วันแม่แห่งชาติ", start: "2025-08-12", end: "2025-08-12", type: "Public", status: "active" },
  { id: 5, name: "วันพ่อแห่งชาติ", start: "2025-12-05", end: "2025-12-05", type: "Public", status: "active" },
  { id: 6, name: "วันหยุดพิเศษ", start: "2025-07-28", end: "2025-07-29", type: "School", status: "inactive" },
];

export default function HolidayPage() {
  const [holidays] = useState(mockHolidays);
  const [holidayType, setHolidayType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (start === end) {
      return startDate.toLocaleDateString('th-TH', { 
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    
    return `${startDate.toLocaleDateString('th-TH', { 
      day: 'numeric',
      month: 'short'
    })} - ${endDate.toLocaleDateString('th-TH', { 
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`;
  };

  const filteredHolidays = useMemo(() => {
    return holidays
      .filter(h => (holidayType === "ALL" ? true : h.type === holidayType))
      .filter(h => (status === "ALL" ? true : h.status === status))
      .filter(h => {
        const searchText = `${h.name}`.toLowerCase();
        return searchText.includes(searchQuery.toLowerCase());
      });
  }, [holidays, holidayType, status, searchQuery]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 p-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-800">
                จัดการวันหยุด
              </h1>
            </div>
            
            <Button className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700">
              <Plus className="w-4 h-4" />
              เพิ่มวันหยุด
            </Button>
          </div>
          <p className="mt-2 text-gray-600">
            จัดการวันหยุดราชการ วันหยุดสถานศึกษา และวันหยุดพิเศษต่างๆ
          </p>
        </div>

        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <Tabs defaultValue="table" className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="p-1 bg-gray-100 border-0">
                  <TabsTrigger 
                    value="table" 
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center space-x-2"
                  >
                    <TableIcon className="w-4 h-4" />
                    <span>ตาราง</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="calendar"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center space-x-2"
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>ปฏิทิน</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Search and Filter Section */}
              <div className="p-4 mb-6 border rounded-lg bg-gray-50">
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                    <Input
                      placeholder="ค้นหาวันหยุด..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 pl-10 bg-white border-gray-200"
                    />
                  </div>
                  
                  <Select value={holidayType} onValueChange={(v) => setHolidayType(v)}>
                    <SelectTrigger className="w-[180px] h-10 bg-white border-gray-200">
                      <SelectValue placeholder="ประเภทวันหยุด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทุกประเภท</SelectItem>
                      <SelectItem value="Public">วันหยุดราชการ</SelectItem>
                      <SelectItem value="School">วันหยุดสถานศึกษา</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={status} onValueChange={(v) => setStatus(v)}>
                    <SelectTrigger className="w-[160px] h-10 bg-white border-gray-200">
                      <SelectValue placeholder="สถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                      <SelectItem value="active">ใช้งาน</SelectItem>
                      <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ตารางวันหยุด */}
              <TabsContent value="table">
                <div className="overflow-hidden bg-white border rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                            ชื่อวันหยุด
                          </th>
                          <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                            วันที่
                          </th>
                          <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                            ประเภท
                          </th>
                          <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">
                            สถานะ
                          </th>
                          <th className="px-6 py-4 text-sm font-semibold text-center text-gray-700">
                            การจัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHolidays.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                              <div className="flex flex-col items-center">
                                <CalendarDays className="w-12 h-12 mb-4 text-gray-300" />
                                <p className="mb-2 text-lg font-medium">ไม่พบข้อมูลวันหยุด</p>
                                <p className="text-sm text-gray-400">
                                  ลองเปลี่ยนเงื่อนไขการค้นหาดู
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredHolidays.map((h, index) => (
                            <tr
                              key={h.id}
                              className={`border-b hover:bg-gray-50 transition-colors ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                              }`}
                            >
                              <td className="px-6 py-4">
                                <span className="font-medium text-gray-900">{h.name}</span>
                              </td>
                              <td className="px-6 py-4 text-gray-700">
                                {formatDateRange(h.start, h.end)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                  h.type === "Public" 
                                    ? "bg-blue-100 text-blue-700" 
                                    : "bg-green-100 text-green-700"
                                }`}>
                                  {h.type === "Public" ? (
                                    <>
                                      <Globe className="w-3 h-3" />
                                      วันหยุดราชการ
                                    </>
                                  ) : (
                                    <>
                                      <GraduationCap className="w-3 h-3" />
                                      วันหยุดสถานศึกษา
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  h.status === "active" 
                                    ? "bg-green-100 text-green-800" 
                                    : "bg-gray-100 text-gray-600"
                                }`}>
                                  {h.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-1 px-3 py-1 text-sm text-white transition-colors bg-green-600 rounded hover:bg-green-700"
                                  >
                                    <Edit className="w-3 h-3" />
                                    แก้ไข
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-1 px-3 py-1 text-sm text-white transition-colors bg-red-600 rounded hover:bg-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    ลบ
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* ปฏิทินวันหยุด */}
              <TabsContent value="calendar">
                <div className="flex justify-center">
                  <div className="p-6 bg-white border shadow-sm rounded-xl">
                    <Calendar
                      className="react-calendar-modern"
                      tileContent={({ date }) => {
                        const hasHoliday = filteredHolidays.find(
                          (h) => {
                            const startDate = new Date(h.start);
                            const endDate = new Date(h.end);
                            return date >= startDate && date <= endDate;
                          }
                        );
                        return hasHoliday ? (
                          <div className="mt-1">
                            <div className={`w-2 h-2 rounded-full mx-auto ${
                              hasHoliday.type === "Public" ? "bg-blue-500" : "bg-green-500"
                            }`}></div>
                            <div className={`text-xs font-medium mt-1 leading-tight ${
                              hasHoliday.type === "Public" ? "text-blue-600" : "text-green-600"
                            }`}>
                              {hasHoliday.name.length > 8 ? hasHoliday.name.slice(0, 8) + "..." : hasHoliday.name}
                            </div>
                          </div>
                        ) : null;
                      }}
                    />
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center mt-6">
                  <div className="flex gap-6 p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">วันหยุดราชการ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">วันหยุดสถานศึกษา</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Custom CSS for Calendar */}
        <style jsx global>{`
          .react-calendar-modern {
            width: 100% !important;
            max-width: 500px;
            font-family: inherit;
            border: none !important;
            background: transparent !important;
          }
          
          .react-calendar-modern .react-calendar__navigation {
            height: 44px;
            margin-bottom: 1em;
            background: #7c3aed !important;
            border-radius: 8px;
            border: none !important;
          }
          
          .react-calendar-modern .react-calendar__navigation button {
            color: white !important;
            min-width: 44px;
            background: none;
            font-size: 16px;
            font-weight: 600;
            border: none !important;
            border-radius: 6px;
            margin: 4px;
            transition: all 0.2s ease;
          }
          
          .react-calendar-modern .react-calendar__navigation button:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
          }
          
          .react-calendar-modern .react-calendar__month-view__weekdays {
            text-align: center;
            text-transform: uppercase;
            font-weight: 600;
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 8px;
          }
          
          .react-calendar-modern .react-calendar__tile {
            max-width: 100%;
            text-align: center;
            padding: 12px 4px;
            background: none;
            border: none !important;
            border-radius: 8px;
            margin: 2px;
            transition: all 0.2s ease;
            position: relative;
            min-height: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
          }
          
          .react-calendar-modern .react-calendar__tile:hover {
            background-color: #f3f4f6 !important;
          }
          
          .react-calendar-modern .react-calendar__tile--active {
            background: #7c3aed !important;
            color: white !important;
          }
          
          .react-calendar-modern .react-calendar__tile--now {
            background: #f59e0b !important;
            color: white !important;
            font-weight: bold;
          }
          
          .react-calendar-modern .react-calendar__tile abbr {
            font-weight: 600;
            font-size: 14px;
          }
        `}</style>
      </div>
    </div>
  );
}