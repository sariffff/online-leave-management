// leaveTypes.ts - ประเภทการลาของข้าราชการครู (ตามพระราชกำหนด)

export interface LeaveType {
  id: number;
  title: string;
  description: string;
  maxDays: string;
  color: string;
  bgColor: string;
  category: 'regular' | 'special' | 'welfare';
}

export const leaveTypes: LeaveType[] = [
  {
    id: 1,
    title: "ลาป่วย",
    description: "การลาเนื่องจากเจ็บป่วย มีใบรับรองแพทย์",
    maxDays: "60 วัน/ปี",
    color: "bg-red-100 text-red-800",
    bgColor: "bg-red-50",
    category: 'regular'
  },
  {
    id: 2,
    title: "ลากิจส่วนตัว",
    description: "การลาเพื่อจัดการธุระส่วนตัว",
    maxDays: "45 วัน/ปี",
    color: "bg-blue-100 text-blue-800",
    bgColor: "bg-blue-50",
    category: 'regular'
  },
  {
    id: 3,
    title: "ลาพักผ่อน",
    description: "การลาพักผ่อนประจำปี",
    maxDays: "10 วัน/ปี",
    color: "bg-green-100 text-green-800",
    bgColor: "bg-green-50",
    category: 'welfare'
  },
  {
    id: 4,
    title: "ลาคลอดบุตร",
    description: "การลาเพื่อคลอดบุตรสำหรับข้าราชการหญิง",
    maxDays: "90 วัน",
    color: "bg-pink-100 text-pink-800",
    bgColor: "bg-pink-50",
    category: 'special'
  },
  {
    id: 5,
    title: "ลาเลี้ยงดูบุตร",
    description: "การลาเพื่อเลี้ยงดูบุตรที่ยังไม่บรรลุนิติภาวะ",
    maxDays: "ไม่เกิน 2 ปี",
    color: "bg-purple-100 text-purple-800",
    bgColor: "bg-purple-50",
    category: 'special'
  },
  {
    id: 6,
    title: "ลาไปช่วยเหลือคู่สมรส",
    description: "การลาไปช่วยเหลือคู่สมรสที่ได้รับการแต่งตั้ง",
    maxDays: "ตามระยะเวลาการแต่งตั้ง",
    color: "bg-indigo-100 text-indigo-800",
    bgColor: "bg-indigo-50",
    category: 'special'
  },
  {
    id: 7,
    title: "ลาเพื่อรับราชการทหาร",
    description: "การลาเพื่อเกณฑ์ทหาร หรือเข้ารับการศึกษาวิชาทหาร",
    maxDays: "ตามกฎหมายเกณฑ์ทหาร",
    color: "bg-yellow-100 text-yellow-800",
    bgColor: "bg-yellow-50",
    category: 'special'
  },
  {
    id: 8,
    title: "ลาเพื่อศึกษา ฝึกอบรม ดูงาน",
    description: "การลาเพื่อเพิ่มพูนความรู้ที่เป็นประโยชน์ต่อราชการ",
    maxDays: "ตามหลักสูตรการศึกษา",
    color: "bg-teal-100 text-teal-800",
    bgColor: "bg-teal-50",
    category: 'special'
  },
  {
    id: 9,
    title: "ลาอุปสมบท หรือ ลาไปประกอบพิธีฮัจย์",
    description: "การลาเพื่อบวชนาคหรือไปประกอบพิธีฮัจย์",
    maxDays: "120 วัน (บวช), ตามที่จำเป็น (ฮัจย์)",
    color: "bg-orange-100 text-orange-800",
    bgColor: "bg-orange-50",
    category: 'special'
  },
  {
    id: 10,
    title: "ลาไปปฏิบัติงานให้แก่องค์การระหว่างประเทศ",
    description: "การลาเพื่อปฏิบัติงานระหว่างประเทศที่เป็นประโยชน์",
    maxDays: "ตามสัญญาการปฏิบัติงาน",
    color: "bg-cyan-100 text-cyan-800",
    bgColor: "bg-cyan-50",
    category: 'special'
  },
  {
    id: 11,
    title: "ลาไปติดตามคู่สมรส",
    description: "การลาไปติดตามคู่สมรสที่ไปปฏิบัติงานในสถานที่อื่น",
    maxDays: "ตามระยะเวลาที่คู่สมรสไปปฏิบัติงาน",
    color: "bg-gray-100 text-gray-800",
    bgColor: "bg-gray-50",
    category: 'special'
  }
];

// ฟังก์ชันช่วยในการจัดกลุ่มประเภทการลา
export const getLeaveTypesByCategory = (category: 'regular' | 'special' | 'welfare') => {
  return leaveTypes.filter(type => type.category === category);
};

// ฟังก์ชันหาประเภทการลาตาม ID
export const getLeaveTypeById = (id: number): LeaveType | undefined => {
  return leaveTypes.find(type => type.id === id);
};

// ประเภทการลาที่ใช้บ่อย (สำหรับแสดงใน UI หลัก)
export const commonLeaveTypes: LeaveType[] = [
  leaveTypes[0], // ลาป่วย
  leaveTypes[1], // ลากิจส่วนตัว
  leaveTypes[2], // ลาพักผ่อน
  leaveTypes[3], // ลาคลอดบุตร
  leaveTypes[4], // ลาเลี้ยงดูบุตร
  leaveTypes[8]  // ลาอุปสมบท/ฮัจย์
];

export type UILeaveFormData = {
  startDate: string;
  endDate: string;
  startType: "เต็มวัน" | "ครึ่งเช้า" | "ครึ่งบ่าย";
  endType: "เต็มวัน" | "ครึ่งเช้า" | "ครึ่งบ่าย";
  totalDays: number;
  reason: string;
  attachments: File[];

};

export function toFormData(ui: UILeaveFormData, leaveTypeId: number): FormData {
  const fd = new FormData();
  fd.append("leave_type_id", String(leaveTypeId));
  fd.append("date_start", ui.startDate);
  fd.append("date_end", ui.endDate);
  fd.append("date_start_type", ui.startType);
  fd.append("date_end_type", ui.endType);
  fd.append("total_day", String(ui.totalDays));
  fd.append("reason", ui.reason);
  for (const f of ui.attachments ?? []) fd.append("file", f);
  return fd;
}

export default leaveTypes;