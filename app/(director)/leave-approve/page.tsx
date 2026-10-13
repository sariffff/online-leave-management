import LeaveApproveClient from "./LeaveApproveClient";
import { emptyFilters, listApproveQueue, toInitial } from "@/lib/leave/lists";
import { perfPage } from "@/lib/perf";

// ข้อมูลหน้าแรกโหลดฝั่งเซิร์ฟเวอร์แล้วส่งมากับ HTML — client ยิง API เฉพาะตอนกรอง/เปลี่ยนหน้า
export default function Page() {
  return perfPage("/leave-approve", async () => {
    const f = emptyFilters(10);
    const initial = await toInitial(listApproveQueue(f));
    return <LeaveApproveClient initial={initial} />;
  });
}
