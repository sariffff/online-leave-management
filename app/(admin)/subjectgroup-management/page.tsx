"use client";

import CrudPage from "@/components/admin/CrudPage";

export default function SubjectGroupManagementPage() {
  return (
    <CrudPage
      title="จัดการกลุ่มสาระการเรียนรู้"
      subtitle="แสดงรายการกลุ่มสาระ (รหัส / ชื่อ)"
      addLabel="เพิ่มกลุ่มสาระใหม่"
      endpoint="/api/admin/subjectmanagement/subject-group"
      idKey="subject_group_id"
      columns={[
        { header: "รหัสกลุ่มสาระ", cell: (r) => <span className="font-medium">{String(r.subject_group_id)}</span>, className: "w-40" },
        { header: "ชื่อกลุ่มสาระ", cell: (r) => String(r.subject_group_name ?? "") },
      ]}
      fields={[{ name: "subject_group_name", label: "ชื่อกลุ่มสาระ", required: true }]}
      searchText={(r) => `${r.subject_group_id} ${r.subject_group_name}`}
      rowLabel={(r) => String(r.subject_group_name)}
    />
  );
}
