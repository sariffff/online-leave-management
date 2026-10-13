import { redirect } from "next/navigation";
import ReviewedHistoryClient from "./ReviewedHistoryClient";
import { requireAuth } from "@/lib/guard";
import { emptyFilters, listReviewedHistory, toInitial } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// ข้อมูลหน้าแรกโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML — client ยิง API เฉพาะตอนกรอง/เปลี่ยนหน้า
export default function Page() {
  return perfPage("/reviewed-history", async () => {
    const g = await requireAuth();
    if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");
    const f = emptyFilters(10);
    const initial = await toInitial(listReviewedHistory(g.user.id, f));
    return <ReviewedHistoryClient initial={initial} />;
  });
}
