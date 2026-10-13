"use client";

import CrudPage from "@/components/admin/CrudPage";

export default function SubjectManagementPage() {
  return (
    <CrudPage
      title="จัดการรายวิชา"
      subtitle="จัดการข้อมูลรายวิชาทั้งหมดในระบบ"
      addLabel="เพิ่มรายวิชาใหม่"
      endpoint="/api/admin/subjectmanagement/subject"
      idKey="subject_id"
      columns={[
        { header: "รหัสวิชา", cell: (r) => <span className="font-medium">{String(r.subject_code ?? "")}</span>, className: "w-40" },
        { header: "ชื่อวิชา", cell: (r) => String(r.subject_name ?? "") },
        { header: "กลุ่มสาระ", cell: (r) => String(r.subject_group || "-") },
        { header: "ระดับชั้น", cell: (r) => String(r.subject_level || "-") },
      ]}
      fields={[
        { name: "subject_code", label: "รหัสวิชา", required: true, placeholder: "เช่น ท11101" },
        { name: "subject_name", label: "ชื่อวิชา", required: true, placeholder: "เช่น ภาษาไทย" },
        { name: "subject_group_id", label: "กลุ่มสาระ", type: "select", optionsFrom: { endpoint: "/api/admin/subjectmanagement/subject-group", value: "subject_group_id", label: "subject_group_name" } },
        { name: "subject_level_id", label: "ระดับชั้น", type: "select", optionsFrom: { endpoint: "/api/admin/levelmanagement", value: "level_id", label: "level_name" } },
      ]}
      searchText={(r) => `${r.subject_code} ${r.subject_name} ${r.subject_group}`}
      rowLabel={(r) => `${r.subject_code} ${r.subject_name}`}
      filterBy={{ label: "ทุกกลุ่มสาระ", value: (r) => String(r.subject_group ?? "") }}
    />
  );
}
