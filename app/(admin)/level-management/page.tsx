"use client";

import CrudPage from "@/components/admin/CrudPage";

export default function LevelPage() {
  return (
    <CrudPage
      title="จัดการระดับชั้น"
      subtitle="แสดงรายการระดับชั้น (เช่น ป.1, ป.2, …)"
      addLabel="เพิ่มระดับชั้น"
      endpoint="/api/admin/levelmanagement"
      idKey="level_id"
      columns={[
        { header: "รหัส", cell: (r) => <span className="font-medium">{String(r.level_id)}</span>, className: "w-40" },
        { header: "ชื่อระดับชั้น", cell: (r) => String(r.level_name ?? "") },
      ]}
      fields={[{ name: "level_name", label: "ชื่อระดับชั้น", required: true }]}
      searchText={(r) => `${r.level_id} ${r.level_name}`}
      rowLabel={(r) => String(r.level_name)}
    />
  );
}
