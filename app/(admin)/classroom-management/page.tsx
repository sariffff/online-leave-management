"use client";

import CrudPage from "@/components/admin/CrudPage";

export default function ClassroomManagementPage() {
  return (
    <CrudPage
      title="จัดการห้องเรียน"
      subtitle="แสดงรายการห้องเรียนทั้งหมด"
      addLabel="เพิ่มห้อง"
      endpoint="/api/admin/classroommanagement"
      idKey="classroom_id"
      columns={[
        { header: "รหัสห้อง", cell: (r) => <span className="font-medium">{String(r.classroom_id)}</span>, className: "w-32" },
        { header: "ชื่อห้อง", cell: (r) => String(r.classroom_name ?? "") },
        { header: "ระดับชั้น", cell: (r) => String(r.level_name ?? "ส่วนรวม") },
      ]}
      fields={[
        { name: "classroom_name", label: "ชื่อห้องเรียน", required: true, placeholder: "เช่น ห้อง ป.1/1" },
        {
          name: "classroom_level",
          label: "ระดับชั้น",
          type: "select",
          emptyLabel: "ส่วนรวม",
          optionsFrom: { endpoint: "/api/admin/levelmanagement", value: "level_id", label: "level_name" },
        },
      ]}
      searchText={(r) => `${r.classroom_id} ${r.classroom_name} ${r.level_name ?? "ส่วนรวม"}`}
      rowLabel={(r) => String(r.classroom_name)}
    />
  );
}
