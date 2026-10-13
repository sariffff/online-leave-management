import { redirect } from "next/navigation";
import DashboardUserClient, { type LeaveRow } from "./DashboardUserClient";
import { requireAuth } from "@/lib/guard";
import { emptyFilters, listOwnLeavesInRange } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// แดชบอร์ดเริ่มที่ "ปีปฏิทินปัจจุบัน ทั้งปี" — โหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML
export default function Page() {
  return perfPage("/dashbord-user", async () => {
    const g = await requireAuth();
    if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");

    const year = new Date().getFullYear();
    let rows: LeaveRow[] | undefined;
    try {
      const page = await listOwnLeavesInRange(g.user.id, emptyFilters(), `${year}-01-01`, `${year}-12-31`);
      rows = page.data as unknown as LeaveRow[];
    } catch (e) {
      console.error("[dashbord-user] initial load failed", e);
    }
    return <DashboardUserClient initialYear={year} initialRows={rows} />;
  });
}
