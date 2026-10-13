import { redirect } from "next/navigation";
import LeaveOverviewClient from "./LeaveOverviewClient";
import { requireAuth } from "@/lib/guard";
import { computeQuota } from "@/lib/leave/quota";
import { quotaForDisplay } from "@/lib/leave/types";
import { getFiscalYearFromISO } from "@/utils/year";
import { perfPage } from "@/lib/perf";

// สิทธิ์ลาปีงบปัจจุบันคำนวณฝั่งเซิร์ฟเวอร์ แล้วส่งมากับ HTML
export default function Page() {
  return perfPage("/leave-overview", async () => {
    const g = await requireAuth();
    if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");

    const year = getFiscalYearFromISO(new Date().toISOString().slice(0, 10));
    let items;
    try {
      items = await quotaForDisplay(await computeQuota(g.user.id, year));
    } catch (e) {
      console.error("[leave-overview] initial load failed", e);
    }
    return <LeaveOverviewClient initialYear={year} initialItems={items} />;
  });
}
