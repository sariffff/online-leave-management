"use client";

import CrudPage from "@/components/admin/CrudPage";
import { thaiDate } from "@/lib/format";

export default function HolidayManagementPage() {
  return (
    <CrudPage
      title="จัดการวันหยุด"
      subtitle="วันหยุดของสถานศึกษา (เช่น ปิดภาคเรียน, วันหยุดพิเศษ)"
      note="วันหยุดราชการดึงจาก Google Calendar อัตโนมัติ ไม่ต้องเพิ่มที่นี่ — วันหยุดที่เพิ่มในหน้านี้จะถูกหักออกจากวันลาด้วย"
      addLabel="เพิ่มวันหยุด"
      endpoint="/api/admin/holiday"
      idKey="holiday_id"
      columns={[
        { header: "วันที่", cell: (r) => thaiDate(String(r.holiday_date ?? "")), className: "w-56" },
        { header: "ชื่อวันหยุด", cell: (r) => String(r.holiday_name ?? "") },
      ]}
      fields={[
        { name: "holiday_name", label: "ชื่อวันหยุด", required: true },
        { name: "holiday_date", label: "วันที่", type: "date", required: true },
      ]}
      searchText={(r) => `${r.holiday_name} ${r.holiday_date}`}
      rowLabel={(r) => `${r.holiday_name} (${thaiDate(String(r.holiday_date ?? ""))})`}
    />
  );
}
