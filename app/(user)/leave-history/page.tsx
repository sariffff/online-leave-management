import { redirect } from "next/navigation";
import LeaveHistoryClient from "./LeaveHistoryClient";
import { requireAuth } from "@/lib/guard";
import { emptyFilters, listOwnLeaves, toInitial } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// ข้อมูลหน้าแรกโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML — client ยิง API เฉพาะตอนกรอง/เปลี่ยนหน้า
export default function Page() {
  return perfPage("/leave-history", async () => {
    const g = await requireAuth();
    if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");
    const f = emptyFilters(8);
    const initial = await toInitial(listOwnLeaves(g.user.id, f));
    return <LeaveHistoryClient initial={initial} />;
  });
}
