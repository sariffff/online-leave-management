import { redirect } from "next/navigation";
import ApprovedHistoryClient from "./ApprovedHistoryClient";
import { requireAuth } from "@/lib/guard";
import { emptyFilters, listApprovedHistory, toInitial } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// ข้อมูลหน้าแรกโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML — client ยิง API เฉพาะตอนกรอง/เปลี่ยนหน้า
export default function Page() {
  return perfPage("/approved-history", async () => {
    const g = await requireAuth();
    if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");
    const f = emptyFilters(10);
    const initial = await toInitial(listApprovedHistory(g.user.id, f));
    return <ApprovedHistoryClient initial={initial} />;
  });
}
