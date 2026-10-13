import ReviewQueueClient from "./ReviewQueueClient";
import { emptyFilters, listReviewQueue, toInitial } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// ข้อมูลหน้าแรกโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML — client ยิง API เฉพาะตอนกรอง/เปลี่ยนหน้า
export default function Page() {
  return perfPage("/reviewed-page", async () => {
    const f = emptyFilters(10);
    const initial = await toInitial(listReviewQueue(f));
    return <ReviewQueueClient initial={initial} />;
  });
}
