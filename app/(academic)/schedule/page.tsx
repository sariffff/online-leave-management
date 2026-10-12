// app/academic/teaching-schedule/page.tsx
"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/academic/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  FaSearch,
  FaUser,
  FaUserGraduate,
  FaHome,
  FaCalendarAlt,
  FaBook,
  FaGraduationCap,
} from "react-icons/fa";
import { Loader2 } from "lucide-react";

/* =========================
   Types & Mock Data (เต็ม)
   ========================= */

interface TeachingSchedule {
  schedule_id?: string;
  teacher_name?: string;
  subject?: string;
  classroom?: string;
  day?: string;
  time_slot?: string;
  grade_level?: string;
}

// Mock data สำหรับตารางสอน (ตามที่ให้มา)
const mockTeachingSchedules: TeachingSchedule[] = [
  { schedule_id: "sch_012", teacher_name: "ครูปรีชา ใจดี", subject: "ประวัติศาสตร์", classroom: "104", day: "จันทร์", time_slot: "10:00-12:00", grade_level: "ป.2" },
  { schedule_id: "sch_013", teacher_name: "ครูสายฝน ภูผา", subject: "วิทยาการคำนวณ", classroom: "ห้องคอมพิวเตอร์ 1", day: "จันทร์", time_slot: "08:00-09:00", grade_level: "ป.3" },
  { schedule_id: "sch_014", teacher_name: "ครูอารี รักเรียน", subject: "ภาษาไทย", classroom: "105", day: "จันทร์", time_slot: "08:00-09:00", grade_level: "ป.1" },
  { schedule_id: "sch_015", teacher_name: "ครูนรินทร์ เทพศิลป์", subject: "สังคมศึกษา", classroom: "106", day: "จันทร์", time_slot: "09:00-10:00", grade_level: "ป.2" },
  { schedule_id: "sch_016", teacher_name: "ครูเยาว์ หัวใจ", subject: "ภาษาไทย", classroom: "102A", day: "จันทร์", time_slot: "09:00-10:00", grade_level: "ป.4" },
  { schedule_id: "sch_017", teacher_name: "ครูดนัย มั่นคง", subject: "การงานอาชีพ", classroom: "ห้องการงาน", day: "จันทร์", time_slot: "09:00-10:00", grade_level: "ป.5" },
  { schedule_id: "sch_018", teacher_name: "ครูปณิตา รุ่งเรือง", subject: "ภาษาไทย", classroom: "107", day: "อังคาร", time_slot: "08:00-09:00", grade_level: "ป.3" },
  { schedule_id: "sch_019", teacher_name: "ครูทศพล คิดไว", subject: "วิทยาศาสตร์การทดลอง", classroom: "ห้องวิทย์ 1", day: "อังคาร", time_slot: "08:00-09:00", grade_level: "ป.4" },
  { schedule_id: "sch_020", teacher_name: "ครูณัฐวดี ใส่ใจ", subject: "หน้าที่พลเมือง", classroom: "201A", day: "อังคาร", time_slot: "08:00-09:00", grade_level: "ป.5" },
  { schedule_id: "sch_021", teacher_name: "ครูศศิธร สายลม", subject: "ศิลปะประยุกต์", classroom: "202A", day: "จันทร์", time_slot: "10:00-11:00", grade_level: "ป.2" },
  { schedule_id: "sch_022", teacher_name: "ครูอธิชา ปัญญา", subject: "ภาษาจีน", classroom: "203A", day: "จันทร์", time_slot: "10:00-11:00", grade_level: "ป.3" },
  { schedule_id: "sch_023", teacher_name: "ครูสุรีย์พร ทองแท้", subject: "แนะแนว", classroom: "ห้องแนะแนว", day: "จันทร์", time_slot: "10:00-11:00", grade_level: "ป.6" },
  { schedule_id: "sch_024", teacher_name: "ครูชัยวัฒน์ กล้าหาญ", subject: "คอมพิวเตอร์", classroom: "ห้องคอมพิวเตอร์ 2", day: "พุธ", time_slot: "09:00-10:00", grade_level: "ป.4" },
  { schedule_id: "sch_025", teacher_name: "ครูปาณิสรา ศักดิ์ศรี", subject: "วรรณคดี", classroom: "204", day: "พุธ", time_slot: "09:00-10:00", grade_level: "ป.5" },
  { schedule_id: "sch_026", teacher_name: "ครูอรทัย พิถีพิถัน", subject: "Coding เบื้องต้น", classroom: "ห้องคอมพิวเตอร์ 3", day: "พุธ", time_slot: "09:00-10:00", grade_level: "ป.6" },
  { schedule_id: "sch_027", teacher_name: "ครูวีรพล สมถะ", subject: "การอ่านจับใจความ", classroom: "301A", day: "พฤหัสบดี", time_slot: "10:00-11:00", grade_level: "ป.5" },
  { schedule_id: "sch_028", teacher_name: "ครูจินตนา รื่นรมย์", subject: "วิทยาศาสตร์สิ่งแวดล้อม", classroom: "302A", day: "พฤหัสบดี", time_slot: "10:00-11:00", grade_level: "ป.6" },
  { schedule_id: "sch_029", teacher_name: "ครูพันธกานต์ ฉลาดคิด", subject: "ภาษาญี่ปุ่น", classroom: "ห้องภาษาต่างประเทศ", day: "พฤหัสบดี", time_slot: "10:00-11:00", grade_level: "ป.4" },
  { schedule_id: "sch_030", teacher_name: "ครูธีรวัฒน์ ตั้งใจ", subject: "ดนตรีสากล", classroom: "ห้องดนตรี 2", day: "ศุกร์", time_slot: "14:00-15:00", grade_level: "ป.5" },
  { schedule_id: "sch_031", teacher_name: "ครูเยาวเรศ ใฝ่รู้", subject: "สังคมศึกษา", classroom: "401A", day: "ศุกร์", time_slot: "14:00-15:00", grade_level: "ป.6" },
  { schedule_id: "sch_032", teacher_name: "ครูสุทธิสินี อ่อนโยน", subject: "การเงินพื้นฐาน", classroom: "402A", day: "ศุกร์", time_slot: "14:00-15:00", grade_level: "ป.6" },
  { schedule_id: "sch_033", teacher_name: "ครูอริสรา ยิ้มแย้ม", subject: "หุ่นยนต์พื้นฐาน", classroom: "ห้องสเต็ม", day: "อังคาร", time_slot: "13:00-14:00", grade_level: "ป.5" },
  { schedule_id: "sch_034", teacher_name: "ครูเกียรติศักดิ์ แสงทอง", subject: "ศิลปะ", classroom: "401B", day: "อังคาร", time_slot: "13:00-14:00", grade_level: "ป.4" },
  { schedule_id: "sch_035", teacher_name: "ครูพัชรี นิ่มนวล", subject: "ภาษาอังกฤษอ่านเขียน", classroom: "201B", day: "อังคาร", time_slot: "13:00-14:00", grade_level: "ป.3" },
  { schedule_id: "sch_036", teacher_name: "ครูนาถวดี ช่างคิด", subject: "สื่อสารภาษาอังกฤษ", classroom: "205", day: "พุธ", time_slot: "15:00-16:00", grade_level: "ป.5" },
  { schedule_id: "sch_037", teacher_name: "ครูทิพวรรณ มิตรแท้", subject: "การงานอาชีพ", classroom: "ห้องการงาน 2", day: "พุธ", time_slot: "15:00-16:00", grade_level: "ป.6" },
  { schedule_id: "sch_038", teacher_name: "ครูวชิรวิทย์ ศรีสุข", subject: "สุขศึกษา", classroom: "ห้องพยาบาล", day: "พุธ", time_slot: "15:00-16:00", grade_level: "ป.4" },
  { schedule_id: "sch_039", teacher_name: "ครูเชียงรุ้ง วิริยะ", subject: "ประวัติศาสตร์", classroom: "303", day: "ศุกร์", time_slot: "10:00-11:00", grade_level: "ป.6" },
  { schedule_id: "sch_040", teacher_name: "ครูภาคภูมิ ปัญญาดี", subject: "คณิตเพิ่มเติม", classroom: "304", day: "ศุกร์", time_slot: "10:00-11:00", grade_level: "ป.6" },
  { schedule_id: "sch_041", teacher_name: "ครูศักดิ์ดา เดชะ", subject: "ภาษามลายู", classroom: "ห้องภาษา 2", day: "ศุกร์", time_slot: "10:00-11:00", grade_level: "ป.5" },
  { schedule_id: "sch_042", teacher_name: "ครูปรีชา ใจดี", subject: "คอมพิวเตอร์กราฟิก", classroom: "ห้องคอมพิวเตอร์ 1", day: "อังคาร", time_slot: "10:00-12:00", grade_level: "ป.5" },
  { schedule_id: "sch_043", teacher_name: "ครูสายฝน ภูผา", subject: "วิทยาการคำนวณ", classroom: "ห้องคอมพิวเตอร์ 2", day: "อังคาร", time_slot: "11:00-12:00", grade_level: "ป.6" },
  { schedule_id: "sch_044", teacher_name: "ครูอารี รักเรียน", subject: "หน้าที่พลเมือง", classroom: "203B", day: "อังคาร", time_slot: "11:00-12:00", grade_level: "ป.4" },
  { schedule_id: "sch_045", teacher_name: "ครูนรินทร์ เทพศิลป์", subject: "การอ่านจับใจความ", classroom: "108", day: "จันทร์", time_slot: "08:00-09:00", grade_level: "ป.2" },
  { schedule_id: "sch_046", teacher_name: "ครูเยาว์ หัวใจ", subject: "สังคมศึกษา", classroom: "205A", day: "พุธ", time_slot: "09:00-10:00", grade_level: "ป.3" },
  { schedule_id: "sch_047", teacher_name: "ครูณัฐวดี ใส่ใจ", subject: "วรรณคดี", classroom: "402B", day: "อังคาร", time_slot: "13:00-14:00", grade_level: "ป.4" },
  { schedule_id: "sch_048", teacher_name: "ครูทศพล คิดไว", subject: "Coding เบื้องต้น", classroom: "ห้องคอมพิวเตอร์ 3", day: "ศุกร์", time_slot: "14:00-15:00", grade_level: "ป.5" },
  { schedule_id: "sch_049", teacher_name: "ครูสุรีย์พร ทองแท้", subject: "ภาษาไทย", classroom: "206A", day: "จันทร์", time_slot: "10:00-11:00", grade_level: "ป.1" },
  { schedule_id: "sch_050", teacher_name: "ครูอธิชา ปัญญา", subject: "ภาษาจีน", classroom: "ห้องภาษา 1", day: "ศุกร์", time_slot: "10:00-11:00", grade_level: "ป.6" },
  { schedule_id: "sch_051", teacher_name: "ครูศศิธร สายลม", subject: "ศิลปะประยุกต์", classroom: "204B", day: "อังคาร", time_slot: "11:00-12:00", grade_level: "ป.5" },
];

/* =========================
   Constants & Helpers
   ========================= */

const timeSlots = [
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
];

const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];

const uniq = <T,>(arr: T[]) => [...new Set(arr)].filter(Boolean) as T[];

/* =========================
   Page Component
   ========================= */

export default function TeachingSchedulePage() {
  // ฟิลเตอร์ + การค้นหา
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const loading = false; // hook ไว้ให้ UI เดิมทำงานเหมือนเดิม

  // รายการสำหรับ dropdown/แนะนำ (unique)
  const allTeachers = useMemo(
    () => uniq(mockTeachingSchedules.map((s) => s.teacher_name ?? "")),
    []
  );
  const allSubjects = useMemo(
    () => uniq(mockTeachingSchedules.map((s) => s.subject ?? "")),
    []
  );
  const allGrades = useMemo(
    () => uniq(mockTeachingSchedules.map((s) => s.grade_level ?? "")),
    []
  );

  // กรองตารางสอนแบบ reactive (แทนการกดค้นหา)
  const schedules = useMemo(() => {
    if (!selectedTeacher) return [];
    return mockTeachingSchedules.filter((s) => {
      if (s.teacher_name !== selectedTeacher) return false;
      if (selectedGrade !== "all" && s.grade_level !== selectedGrade) return false;
      if (selectedSubject !== "all" && s.subject !== selectedSubject) return false;
      return true;
    });
  }, [selectedTeacher, selectedGrade, selectedSubject]);

  // แผนที่ day+slot -> รายการสำหรับ cell
  const slotMap = useMemo(() => {
    const map = new Map<string, TeachingSchedule[]>();
    for (const s of schedules) {
      const key = `${s.day}|${s.time_slot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [schedules]);

  const getSchedulesForSlot = (day: string, timeSlot: string) =>
    slotMap.get(`${day}|${timeSlot}`) ?? [];

  // สรุป conflict
  const conflicts = useMemo(() => {
    const list: { day: string; slot: string; count: number }[] = [];
    for (const d of days) {
      for (const slot of timeSlots) {
        const arr = getSchedulesForSlot(d, slot);
        if (arr.length > 1) list.push({ day: d, slot, count: arr.length });
      }
    }
    return list;
  }, [slotMap]);

  // ค้นหาครูแบบแนะนำ
  const handleTeacherSearch = (value: string) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setSearchResults([]);
      setSelectedTeacher("");
      return;
    }
    setSearchResults(
      allTeachers.filter((t) => t.toLowerCase().includes(value.toLowerCase()))
    );
  };

  // กดปุ่มค้นหา -> เลือก match แรก
  const handleTeacherSearchClick = () => {
    if (!searchTerm.trim()) return;
    const matches = allTeachers.filter((t) =>
      t.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (matches.length > 0) {
      setSelectedTeacher(matches[0]);
      setSearchTerm(matches[0]);
      setSearchResults([]);
    } else {
      setSelectedTeacher("");
      setSearchResults([]);
    }
  };

  const selectTeacher = (name: string) => {
    setSelectedTeacher(name);
    setSearchTerm(name);
    setSearchResults([]);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSelectedTeacher("");
    setSelectedGrade("all");
    setSelectedSubject("all");
    setSearchResults([]);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-3 sm:p-6">
        {/* Enhanced Search Section */}
        <div className="p-4 mb-4 bg-white border rounded-lg shadow-sm sm:mb-6">
          <div className="mb-4">
            <h3 className="mb-4 text-base font-medium text-gray-800 sm:text-lg">
              ค้นหาและกรองข้อมูล
            </h3>

            {/* Search by Teacher */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                ค้นหาอาจารย์
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FaUser className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <Input
                    placeholder="ค้นหาชื่อออาจารย์..."
                    value={searchTerm}
                    onChange={(e) => handleTeacherSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTeacherSearchClick()}
                    className="h-10 pl-10"
                  />

                  {/* Search suggestions dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      {searchResults.map((teacher, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectTeacher(teacher)}
                          className="px-4 py-2 cursor-pointer hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex items-center">
                            <FaUser className="w-4 h-4 mr-2 text-gray-400" />
                            {teacher}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <Button
                  onClick={handleTeacherSearchClick}
                  disabled={!searchTerm.trim()}
                  className="flex items-center h-10 gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <FaSearch className="w-4 h-4" />
                  <span className="hidden sm:inline">ค้นหา</span>
                </Button>
              </div>
            </div>

            {/* Filter Section */}
            <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Grade Filter */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  <FaGraduationCap className="inline w-4 h-4 mr-1" />
                  ชั้นเรียน
                </label>
                <Select
                  value={selectedGrade}
                  onValueChange={setSelectedGrade}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="เลือกชั้นเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกชั้นเรียน</SelectItem>
                    {allGrades.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Filter */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  <FaBook className="inline w-4 h-4 mr-1" />
                  รายวิชา
                </label>
                <Select
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="เลือกรายวิชา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกรายวิชา</SelectItem>
                    {allSubjects.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Button */}
              <div className="flex items-end">
                <Button
                  onClick={clearSearch}
                  className="w-full h-10 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            <div className="flex flex-wrap gap-2">
              {selectedTeacher && (
                <div className="flex items-center gap-2 px-3 py-1 text-sm border border-blue-200 rounded-full bg-blue-50">
                  <FaUserGraduate className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-800">อาจารย์: {selectedTeacher}</span>
                </div>
              )}
              {selectedGrade !== "all" && (
                <div className="flex items-center gap-2 px-3 py-1 text-sm border border-green-200 rounded-full bg-green-50">
                  <FaGraduationCap className="w-4 h-4 text-green-600" />
                  <span className="text-green-800">ชั้น: {selectedGrade}</span>
                </div>
              )}
              {selectedSubject !== "all" && (
                <div className="flex items-center gap-2 px-3 py-1 text-sm border border-purple-200 rounded-full bg-purple-50">
                  <FaBook className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-800">วิชา: {selectedSubject}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule Table Section */}
        <div className="overflow-hidden bg-white border rounded-lg shadow-sm">
          <div className="p-3 border-b sm:p-4 bg-gray-50">
            <h3 className="text-base font-medium text-gray-800 sm:text-lg">
              {!selectedTeacher
                ? "ตารางสอน - กรุณาเลือกอาจารย์"
                : schedules.length > 0
                ? `ตารางสอนของ ${selectedTeacher} (${schedules.length} รายการ)`
                : `ตารางสอนของ ${selectedTeacher} - ไม่พบข้อมูล`}
            </h3>
          </div>

          {!selectedTeacher ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 sm:p-16">
              <FaUserGraduate className="w-12 h-12 mb-4 text-gray-400 sm:w-16 sm:h-16" />
              <p className="text-base font-medium sm:text-lg">กรุณาเลือกอาจารย์</p>
              <p className="text-xs text-center sm:text-sm">
                ค้นหาและเลือกอาจารย์เพื่อดูตารางสอน
              </p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 sm:p-16">
              <FaCalendarAlt className="w-12 h-12 mb-4 text-gray-400 sm:w-16 sm:h-16" />
              <p className="text-base font-medium sm:text-lg">ไม่พบตารางสอน</p>
              <p className="text-xs text-center sm:text-sm">
                อาจารย์ท่านนี้ไม่มีตารางสอนในเงื่อนไขที่เลือก
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 sm:p-16">
              <Loader2 className="w-8 h-8 mb-4 text-blue-500 animate-spin sm:w-12 sm:h-12" />
              <p className="text-base sm:text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden">
                <div className="p-4 space-y-4">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.schedule_id}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900">
                            {schedule.subject}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {schedule.teacher_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="px-2 py-1 text-xs text-white bg-blue-600 rounded">
                            {schedule.grade_level}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <FaCalendarAlt className="w-3 h-3 text-gray-500" />
                          <span>{schedule.day}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FaHome className="w-3 h-3 text-gray-500" />
                          <span>ห้อง {schedule.classroom}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="px-2 py-1 text-xs text-green-800 bg-green-100 rounded">
                            {schedule.time_slot}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table View with Horizontal Scroll */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <div className="min-w-full" style={{ minWidth: "800px" }}>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="sticky left-0 z-10 px-3 py-3 text-xs font-semibold text-center text-gray-700 border-r bg-gray-50 sm:text-sm min-w-20">
                            วัน/เวลา
                          </th>
                          {timeSlots.map((slot) => (
                            <th
                              key={slot}
                              className="px-2 py-3 text-xs font-semibold text-center text-gray-700 border-r sm:px-4 sm:text-sm min-w-32"
                            >
                              <div className="whitespace-nowrap">{slot}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((day) => (
                          <tr
                            key={day}
                            className="transition-colors border-b hover:bg-gray-50"
                          >
                            <td className="sticky left-0 z-10 px-3 py-4 font-medium text-gray-900 border-r bg-gray-50 sm:py-6">
                              <div className="text-xs whitespace-nowrap sm:text-sm">
                                {day}
                              </div>
                            </td>
                            {timeSlots.map((slot) => {
                              const slotSchedules = getSchedulesForSlot(day, slot);
                              const hasConflict = slotSchedules.length > 1;

                              return (
                                <td
                                  key={`${day}-${slot}`}
                                  className="relative px-1 py-4 border-r sm:px-2 sm:py-6"
                                >
                                  <div className="flex items-center justify-center text-center min-h-12 sm:min-h-16">
                                    {slotSchedules.length > 0 ? (
                                      <div
                                        className={`w-full p-2 text-xs border rounded-lg sm:p-3 ${
                                          hasConflict
                                            ? "bg-red-100 border-red-300"
                                            : "bg-blue-100 border-blue-200"
                                        }`}
                                      >
                                        {hasConflict && (
                                          <div className="mb-1 text-xs font-bold text-red-600">
                                            ⚠️ ตารางซ้อนทับ ({slotSchedules.length})
                                          </div>
                                        )}

                                        {slotSchedules.slice(0, 2).map((sc, idx) => (
                                          <div
                                            key={sc.schedule_id}
                                            className={`${
                                              idx > 0 ? "mt-2 pt-2 border-t border-gray-300" : ""
                                            }`}
                                          >
                                            <div
                                              className={`mb-1 font-semibold truncate ${
                                                hasConflict ? "text-red-900" : "text-blue-900"
                                              }`}
                                            >
                                              {sc.subject}
                                            </div>
                                            <div
                                              className={`mb-1 truncate ${
                                                hasConflict ? "text-red-700" : "text-blue-700"
                                              }`}
                                            >
                                              ห้อง {sc.classroom}
                                            </div>
                                            <div
                                              className={
                                                hasConflict ? "text-red-600" : "text-blue-600"
                                              }
                                            >
                                              {sc.grade_level}
                                            </div>
                                            <div
                                              className={`mt-1 text-xs truncate ${
                                                hasConflict ? "text-red-500" : "text-blue-500"
                                              }`}
                                            >
                                              {sc.teacher_name}
                                            </div>
                                          </div>
                                        ))}

                                        {slotSchedules.length > 2 && (
                                          <div className="mt-2 text-xs font-medium text-gray-600">
                                            +{slotSchedules.length - 2} รายการ
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-full p-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-lg sm:p-3">
                                        ว่าง
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Summary section */}
          {schedules.length > 0 && (
            <div className="p-3 border-t sm:p-4 bg-gray-50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-600 sm:text-sm">
                  รวมทั้งหมด {schedules.length} ชั่วโมงสอน
                </div>
                <div className="flex flex-col gap-1 text-xs sm:flex-row sm:gap-4 sm:text-sm">
                  <div className="text-gray-600">
                    อาจารย์: {uniq(schedules.map((s) => s.teacher_name)).length} คน
                  </div>
                  <div className="text-gray-600">
                    วิชา: {uniq(schedules.map((s) => s.subject)).length} วิชา
                  </div>
                  {conflicts.length > 0 && (
                    <div className="font-medium text-red-600">
                      ⚠️ ตารางซ้อนทับ: {conflicts.length} ช่วงเวลา
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal placeholders for Add/Edit/Delete - Ready for backend integration */}
    </div>
  );
}
